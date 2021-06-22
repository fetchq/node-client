const fetchq = require('fetchq');

const logLevel = process.env.LOG_LEVEL || 'info';

const connectionString =
  process.env.DATABASE_URL ||
  'postgres://postgres:postgres@localhost:5432/postgres';

console.log('');
console.log('###');
console.log('### FetchQ Client // Examples // App04');
console.log('### connecting to: ', connectionString);
console.log('###');
console.log('');

/**
 * DEFINE HANDLERS FUNCTIONS
 * those functions should be pure, they should rely entirele on the parameters
 * that are given into by Fetchq.
 */

const handler1 = async (doc, { fetchq, foo, faa, fii }) => {
  fetchq.logger.info('WKR - 1', doc.subject, foo, faa, fii);

  await doc.forward('q2');

  // Combine payload and context to decorate the document's
  // payload while marking it as completed.
  return doc.complete({
    payload: { ...doc.payload, foo, faa, fii },
  });
};

const handler2 = async (doc, { fetchq, foo, faa, fii }) => {
  fetchq.logger.info('WKR 2 -', doc.subject, foo, faa, fii);

  // Combine payload and context to decorate the document's
  // payload while marking it as completed.
  return doc.complete({
    payload: { ...doc.payload, foo, faa, fii },
  });
};

const onReady = async (client) => {
  client.logger.info('Fetchq is ready');
  const data = await client.doc.append('q1', { fii: 3 });
  client.logger.info('Appended document', data);

  setTimeout(() => {
    console.log('Add a worker after the system was launched');
    client.workers.register({
      queue: 'q2',
      handler: handler2,
      decorateContext: {
        foo: 5,
        faa: 6,
        fii: 7,
      },
    });
  }, 1000);
};

/**
 * SETUP THE SYSTEM
 */

const client = fetchq({
  logLevel,
  connectionString,
  decorateContext: {
    foo: 1,
  },
  initializationRetry: {
    retries: 0,
  },
  queues: [
    {
      name: 'q1',
    },
    { name: 'q2' },
  ],
  workers: [
    {
      queue: 'q1',
      handler: handler1,
      decorateContext: { fii: 3 },
    },
  ],
  onReady,
});

client.decorateContext({ faa: 2 });

client.boot();
