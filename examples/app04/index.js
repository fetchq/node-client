const fetchq = require('fetchq');

const connectionString =
  process.env.DATABASE_URL ||
  'postgres://postgres:postgres@localhost:5432/postgres';

console.log('FetchQ Client // Examples // App03');
console.log('connecting to: ', connectionString);

fetchq({
  logLevel: 'info',
  connectionString,
  queues: [{ name: 'q1', enableNotifications: true }],
  decorateContext: {
    foo: 1,
  },
  workers: [
    {
      queue: 'q1',
      decorateContext: {
        faa: 2,
      },
      handler: (doc, { foo, faa }) => {
        console.log(doc.subject, foo, faa);

        // Combine payload and context to decorate the document's
        // payload while marking it as completed.
        return doc.complete({
          payload: { ...doc.payload, foo, faa },
        });
      },
    },
  ],
})
  .boot()
  .then(async (client) => {
    const data = await client.doc.append('q1', { fii: 3 });
    client.logger.info('Appended document', data);
  });
