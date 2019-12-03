console.log('FetchQ Client // Examples // App01')
const fetchq = require('fetchq');

const q1wkr = {
  queue: 'q1',
  delay: 1,
  handler: (doc) => {
    console.log(doc);
    return { action: 'drop' };
  },
};

const client = fetchq({
  connectionString: 'postgres://postgres:postgres@localhost:5432/postgres',
  maintenance: {
    limit: 3,
    sleep: 1500,
  },
  workers: [
    q1wkr,
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
