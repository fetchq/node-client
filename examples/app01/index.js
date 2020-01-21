console.log('FetchQ Client // Examples // App01')
const fetchq = require('fetchq');

const client = fetchq({
  logLevel: 'info',
  connectionString: 'postgres://postgres:postgres@localhost:5432/postgres',

  // Try to create a free Postgres database at: https://elephantsql.com
  // FetchQ will automatically initialize the db on the first run!
  // ------
  // connectionString: 'postgres://xxx:yyy@manny.db.elephantsql.com:5432/zzz',
  // pool: { max: 1 },

  /**
   * Maintenance
   * ===========
   * Each FetchQ client runs maintenance jobs that are meant to groom the queue data
   * and help improving performances.
   */
  maintenance: {
    limit: 3,
    delay: 250,
    sleep: 5000,
  },

  /**
   * Queues
   * ===========
   * This is an optional declaration of which queues should be available into the system
   * at boot time the client will ensure those queues exist and update settings according
   * to the informations that you provide here.
   *
   * You can also provide a `workerHandler` function and a `workerOptions` that will be used
   * to prepare a worker definition out of this single setting.
   *
   * This definition list is normally handled by the service that puts stuff into the queue.
   * It would be best for this service to be a singleton (no horizontal scalability) just to
   * avoid racing conditions in creating and updating queues at boot time.
   *
   * Some of the configuration options will trigger index flushing that may be time consuming
   * in large datasets. In any case, for large dataset projects we recomment to handle queues
   * and settings manually with dabase migration tools.
   */
  queues: [
    // Q1
    // this is the simple or the queues, it does very little so we write the worker
    // handler's implementation directly here. It simply pushes documents into another queue
    // with a decorated payload :-)
    //
    // once processed, the document is dropped
    {
      name: 'q1',
      isActive: true,
      enableNotifications: true,
      workerHandler: async (doc, { client }) => {
        client.logger.info(doc.queue, doc.payload);
        await doc.forward('q2', { q1: true });
        return doc.drop();
      },
    },
    // Q2
    // here we just define the queue and it's settings
    // the worker definition is provided later on.
    //
    // the interesting point here is that we know that this queue will reschedule
    // a lot with short delays, so we reconfigure the maintenance job to run
    // every second instead of the default (30s).
    //
    // this queue will also retain documents that are reschedules, so we want to
    // keep a close eye on the stats, so we increase the snapshot frequency to
    // 10 seconds instead of the default (1m)
    {
      name: 'q2',
      isActive: true,
      enableNotifications: true,
      maintenance: {
        mnt: { delay: '1s', duration: '1m', limit: 100 },
        sts: { delay: '10s', duration: '1m' },
      },
    },
    // Q3
    // here we just define the queue and it's settings
    // the worker definition is provided later on.
    //
    // the interesting point is that we allow this queue's workers to fail only
    // once, so at the first rejection or unhandled exception the document will
    // be killed.
    {
      name: 'q3',
      isActive: true,
      enableNotifications: true,
      maxAttempts: 1,
    },
  ],

  /**
   * Workers
   * ===========
   * you can declare and configure workers outside the queue optional definition.
   *
   * This is the classic configuration of a "worker node", it just performs
   * data-processing and queue maintenance.
   *
   * Also, we strongly recommend to write your handlers as Node modules and import
   * them into the worker's configuration as dependencies.
   */
  workers: [
    // Q2
    // reschedule a document a few times just because we think it's fun,
    // the document get then added into yet another queue.
    //
    // once processed, the document is dropped
    {
      queue: 'q2',
      concurrency: 5,
      handler: async (doc, { client }) => {
        client.logger.info(`${doc.queue} (${doc.iterations})`, doc.payload);

        // after a few repetition, this document gets re-routed into
        // yet another queue for further processing.
        if (doc.iterations >= 3) {
          await doc.forward('q3', {
            q2: true,
            iterations: doc.iterations,
          });
          return doc.drop();
        }

        // Just a custom persistent log bound to the current document
        // error message [ error payload | reference id ]
        await doc.logError('not yet time to process', doc);

        return doc.reschedule('+1ms');
      },
    },
    // Q3
    // find out is the document's subject begins with a digit [0-9] and take different
    // actions based on this intelligence.
    //
    // An interesting detail about this worker is that it customizes the default document
    // lock time (5 minutes) to just 5 seconds so the cleanup maintenance process will
    // quickly collect rejected documents and kill them.
    {
      queue: 'q3',
      lock: '5s',
      handler: async (doc, { client }) => {
        client.logger.info(`${doc.queue} - ${doc.subject}`, doc.payload);

        // if the subject begins with a number, the process is finally completed
        if (doc.subject.substr(0, 1) === parseInt(doc.subject.substr(0, 1), 10).toString()) {
          return doc.complete();

          // else we reject the document with a reason that will be logged into
          // the errors table. the cleanup maintenance will eventually kill the document
        } else {
          return doc.reject('not a number');
        }
      }
    },
  ],
});

// Boot
; (async () => {
  await client.init();
  await client.start();

  // Push random items into the queue
  setInterval(() => {
    client.doc.append('q1', { foo: 123 });
  }, 2500)

})();
