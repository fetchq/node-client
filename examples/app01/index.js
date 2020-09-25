const fetchq = require('fetchq');

const connectionString =
  process.env.DATABASE_URL ||
  'postgres://postgres:postgres@localhost:5432/postgres';

console.log('FetchQ Client // Examples // App01');
console.log('connecting to: ', connectionString);

fetchq({
  logLevel: 'verbose',
  connectionString,
  pool: { max: 1 },
  connect: {},
}).boot();
