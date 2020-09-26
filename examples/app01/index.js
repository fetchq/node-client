/**
 * Fetchq - distributed queue pipeline
 *
 * In this example we simulate a complex document pipeline processing using 3 different modules
 * to represent 3 different responsibilities.
 *
 * NOTE: In a real-world scenario, those modules may be deployed into independent processes
 *       or even into independent servers. PostgreSQL is the component that enables cross-process
 *       communication and makes possible a correct processing of the queue.
 *
 * CLIENT 1:
 * this is a `document produrer`.
 * it connects to the queue and once the connection is established,
 * it `appends` a new document into the pipeline for processing.
 *
 * CLIENT 2:
 * this is a `consumer middleware`.
 * it processes documents from a queue, makes some decisions, and eventually forwards
 * those documents into a `next queue` for further elaboration.
 *
 * CLIENT 3:
 * [[ TO BE COMPLETED ]]
 */

const createClient1 = require('./client1');
const createClient2 = require('./client2');
const createClient3 = require('./client3');

const connectionString =
  process.env.DATABASE_URL ||
  'postgres://postgres:postgres@localhost:5432/postgres';

const config = {
  logLevel: 'info',

  // https://github.com/fetchq/node-client#configure-the-postgres-connection
  connectionString,

  // Try to create a free Postgres database at: https://elephantsql.com
  // FetchQ will automatically initialize the db on the first run!
  // ------
  // connectionString: 'postgres://xxx:yyy@manny.db.elephantsql.com:5432/zzz',
  pool: { max: 1 },
};

/**
 * BOOT THE CLIENTS
 */

console.log('');
console.log('###');
console.log('### FetchQ Client // Examples // App01');
console.log('### connecting to: ', connectionString);
console.log('###');
console.log('');

createClient1(config);
createClient2(config);
createClient3(config);
