const fetchq = require('fetchq');

module.exports = (config = {}) =>
  fetchq({
    ...config,

    clientName: 'client1',

    /**
     * Maintenance
     * ===========
     * Each FetchQ client runs maintenance jobs that are meant to groom the queue data
     * and help improving performances.
     */
    maintenance: {
      limit: 1,
      delay: 1,
      sleep: 250,
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
          mnt: { delay: '100ms', duration: '1m', limit: 100 },
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
      {
        queue: 'q1',
        handler: async (doc, { client }) => {
          client.logger.info(doc.queue, doc.payload);
          await doc.forward('q2', { q1: true });
          return doc.drop();
        },
      },
    ],

    onReady: async (client) => {
      // Push random items into the queue
      client.logger.info('>> Append');
      client.doc.append('q1', { foo: 123 });
    },

    autoStart: true,
  });
