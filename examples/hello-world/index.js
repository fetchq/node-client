const fetchq = require('fetchq');
const DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/postgres';

console.log('');
console.log('###');
console.log('### FetchQ Client // Examples // Hello World');
console.log('###');
console.log('');

const client = fetchq({
  clientName: 'c1',
  logLevel: 'info',
  connectionString: process.env.DATABASE_URL || DATABASE_URL,
  queues: [
    {
      name: 'q1',
      workerHandler: (doc, { fetchq }) => {
        fetchq.logger.info(` Working on: ${doc.subject.split('-').shift()}...`);
        return doc.complete();
      },
    },
  ],
});

console.log('###');
console.log('### Connecting to: ');
console.log('###', client.settings.connectionString);
console.log('###');
console.log('');

client
  .boot()
  .then((client) => {
    setInterval(() => client.doc.append('q1'), 1000);
  })
  .catch((err) => {
    console.log('Failed boot');
    console.error(err);
  });
