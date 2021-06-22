const fetchq = require('fetchq');
const DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/postgres';

console.log('');
console.log('###');
console.log('### FetchQ Client // Examples // Big Data');
console.log('###');
console.log('');

fetchq({
  clientName: 'producer',
  logLevel: 'info',
  connectionString: process.env.DATABASE_URL || DATABASE_URL,
  autoStart: true,

  // This Fetchq client is configure for minimal impact on the
  // Postgres instance:
  // - it does not participate in the maintenance of the system
  // - it does not use push notifications
  skipEmitter: true,
  skipMaintenance: true,

  // Please put attention to the "sleep", "delay" and "batch"
  // settings that are explained in the following code.
  workers: [
    {
      queue: 'q1',

      // This is the time between 2 polling sessions, when your client
      // detects that there is nothing more do to. When it runs out of
      // pending documents.
      //
      // The longer this amount of time, the less stress we put on
      // Postgres asking "what's next" and getting "nothing yet" as an answer.
      //
      // The shorted this amount of time, the more responsibe your worker
      // will be. It will react fast to new documents coming in or
      // becoming pending, but also more CPU and memory will be required.
      //
      // If you want a fast queue, use notifications instead of a short
      // sleep time as it is much more efficient.
      sleep: 10000,

      // This parameter regulates a pause in between processing documents.
      // In a way, it lets the system to take a breath.
      //
      // The samaller the number, the faster the processing but also the more
      // load on your processing machine, and the db. Choose carefully :-)
      delay: 100,

      // This parameter regulates how many pending documents to pre-fetch
      // from the system.
      //
      // The higher the numner, the less the workload in picking up documents.
      // But once you pick a document, you must complete it within the
      // "lock time".
      //
      // You you must be quite positive that all the batched documents
      // can be processed within the batch time in order to avoid false positives
      // in detecting orphan documents and rescheduling them for execution.
      batch: 100,

      handler: (doc, { fetchq }) => {
        const text = doc.payload.isFuture ? 'planned' : 'appended';
        fetchq.logger.info(` >>> ${text} document ${doc.subject.substr(0, 5)}`);
        return doc.complete();
      },
    },
  ],
});
