console.log('FetchQ Client // Examples // App01')
const fetchq = require('fetchq');

const client = fetchq({
  logLevel: 'error',
  connectionString: 'postgres://postgres:postgres@localhost:5432/postgres',
  // Declare maintenance behaviours
  maintenance: {
    limit: 3,
    sleep: 1500,
  },
  // Declare queues with settings
  // this is optional, but will override any current setting at startup
  queues: [
    {
      name: 'q1',
      isActive: true,
      enableNotifications: true,
    },
    {
      name: 'q2',
      isActive: true,
      enableNotifications: true,
      maxAttempts: 1,
      errorsRetention: '5m',
      currentVersion: 2,
      maintenance: {
        mnt: { delay: '3s', duration: '1m', limit: 100 },
        sts: { delay: '30m', duration: '1m' },
        drp: { delay: '10m', duration: '1m' },
        cmp: { delay: '30m', duration: '1m' },
      },
    },
  ],
  // Declare workers
  workers: [
    {
      queue: 'q1',
      delay: 0,
      concurrency: 10,
      // sleep: 10000,
      handler: async ({ subject, payload }, { ctx }) => {
        console.log(`Q1 - ${subject}`, payload);
        await ctx.doc.push('q2', {
          subject,
          payload: { ...payload, q1: true },
        });
        return { action: 'drop' };
      },
    },
    {
      queue: 'q2',
      delay: 0,
      concurrency: 10,
      // sleep: 10000,
      handler: (doc) => {
        console.log(`Q2`, doc);
        return { action: 'drop'};
      },
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
  }, 1000)

})();
