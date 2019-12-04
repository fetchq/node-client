console.log('FetchQ Client // Examples // App01')
const fetchq = require('fetchq');

const client = fetchq({
  logLevel: 'info',
  connectionString: 'postgres://postgres:postgres@localhost:5432/postgres',
  // Declare maintenance behaviours
  maintenance: {
    limit: 3,
    delay: 250,
    sleep: 5000,
  },
  // Declare queues with settings
  // this is optional, but will override any current setting at startup
  queues: [
    {
      name: 'q1',
      isActive: true,
      enableNotifications: true,
      maintenance: {
        sts: { delay: '30s', duration: '1m' },
      },
    },
    {
      name: 'q2',
      isActive: true,
      enableNotifications: true,
      maintenance: {
        mnt: { delay: '100ms', duration: '1m', limit: 100 },
        drp: { delay: '10m', duration: '1m' },
        sts: { delay: '30s', duration: '1m' },
        cmp: { delay: '30m', duration: '1m' },
      },
    },
    {
      name: 'q3',
      isActive: true,
      enableNotifications: true,
      maxAttempts: 1,
      errorsRetention: '24h',
      maintenance: {
        mnt: { delay: '10s', duration: '1m', limit: 100 },
        drp: { delay: '10s', duration: '1m' },
        sts: { delay: '1y', duration: '1m' },
        cmp: { delay: '1y', duration: '1m' },
      },
    },
  ],
  // Declare workers
  workers: [
    {
      queue: 'q1',
      handler: async (doc, { client }) => {
        client.logger.info(doc.queue, doc.payload);

        await client.doc.push('q2', {
          subject: doc.subject,
          payload: { ...doc.payload, q1: true },
        });

        return { action: 'drop' };
      },
    },
    {
      queue: 'q2',
      concurrency: 5,
      handler: async (doc, { client }) => {
        client.logger.info(`${doc.queue} (${doc.iterations})`, doc.payload);

        // after a few repetition, this document gets re-routed into
        // yet another queue for further processing.
        if (doc.iterations >= 3) {
          await client.doc.push('q3', {
            subject: doc.subject,
            payload: {
              ...doc.payload,
              q2: true,
              iterations: doc.iterations,
            },
          });
          return { action: 'drop' };
        }

        // Just a custom persistent log...
        await client.queue.logError(doc.queue, doc.subject, 'just for fun');

        return {
          action: 'reschedule',
          nextIteration: '+1ms',
        };
      },
    },
    {
      queue: 'q3',
      handler: async (doc, { client }) => {
        client.logger.info(`${doc.queue} - ${doc.subject}`, doc.payload);

        // if the subject begins with a number, the process is finally completed
        if (doc.subject.substr(0, 1) === parseInt(doc.subject.substr(0, 1), 10).toString()) {
          return { action: 'complete'}

        // else we reject the document with a reason that will be logged into
        // the errors table. the cleanup maintenance will eventually kill the document
        } else {
          return {
            action: 'reject',
            message: 'not a number',
          }
        }
      }
    },
  ],
});

// Boot
;(async () => {
  await client.init();
  await client.start();

  // Push random items into the queue
  setInterval(() => {
    client.doc.append('q1', { foo: 123 });
  }, 500)

})();
