const fetchq = require('fetchq');
const DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/postgres';

console.log('');
console.log('###');
console.log('### FetchQ Client // Examples // Ticker');
console.log('###');
console.log('');

const pause = (timeout = 0) => new Promise((r) => setTimeout(r, timeout));

fetchq({
  clientName: 'c1',
  logLevel: 'info',
  connectionString: process.env.DATABASE_URL || DATABASE_URL,

  // This flag disables the maintenance daemon for this client.
  // Only tasks that are created into "now" or in the past will be
  // visible for execution
  skipMaintenance: true,

  // These flag kills the ability of this client to
  // run any kind of real time communication with the db
  //
  // Skipping the emitter will spare one connection towards the db
  // and some memory, but the system is completely relying on a
  // polling mechanism.
  //
  // That is good for this example as we want to initiate a ticker
  // session where each next execution should happen as soon as
  // possible.
  skipEmitter: true,

  workers: [
    {
      queue: 'ticker',
      delay: 0,
      sleep: 5000,
      handler: async (doc, { fetchq }) => {
        fetchq.logger.info(`Exec task: ${doc.subject} > ${doc.iterations}`);
        await pause(1000);
        return doc.reschedule();
      },
    },
  ],

  // Run your custom logic once the client is ready.
  onReady: async (client) => {
    // This destroy and recreate the queue so to have fresh data
    // for the running example:
    console.log('> Reset ticker queue state');
    await client.queue.drop('ticker');
    await client.queue.create('ticker');
    await client.queue.enableNotifications('ticker');

    // This pause is to make sure that the workers pool gets started
    // before the document is created (next instruction).
    //
    // This will cause a bit of an issue because the worker is likey
    // in a "sleep" state now.
    //
    // You will notice a delay of approximately 5s before the ticker
    // starts. That's because of `skipEmitter: true`.
    //
    // With that option, the client relies solely on polling and
    // workers are not able to get out of the sleep mode in case new
    // documents are added.
    //
    // Try to simply comment out that line, and experience an immediate
    // processing of the ticker :-)
    await pause(500);

    // Push a task into the queue, such task will be handled by
    // the queue's handler in the workers definition.
    console.log('> Push a task into the queue');
    console.log('(It may take up to {worker.sleep}ms for the ticker to start)');
    await client.doc.push('ticker', {
      subject: 'task1',
    });
  },

  // Start the client, connect to Postgres and run
  // initial configuration and queue upserts.
  autoStart: true,
});
