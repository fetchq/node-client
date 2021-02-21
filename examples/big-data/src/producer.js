const { v1: uuid } = require('uuid');
const fetchq = require('fetchq');
const DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/postgres';

console.log('');
console.log('###');
console.log('### FetchQ Client // Examples // Big Data');
console.log('###');
console.log('');

/**
 * This parameter modulates how fast data will be injected
 * into the queue.
 *
 * A high numer (eg. 1000) will simulatea a slow data ingestion
 * where the consumer is much faster at processing data than
 * the producer is.
 *
 * In such cirumstance, you will see the producer going through
 * a bunch of documents and then pause for a while. That happens
 * because we disabled any kind of push-notifications for the queue,
 * so the system will work in pure poll mode only.
 *
 * A lower number (try 250 or less) will simulate a fast data
 * ingestion, where the consumer is likely slower than the producer.
 *
 * In such circumstance, you will notice that the consumer may
 * be subject to an initial pause, in case there is nothing to
 * process, but then it kicks in and never stop working.
 *
 * This happens because even in poll mode, if the queue is never
 * empty, the workers will never enter sleep mode.
 */
const ingestionRate = 1000;

fetchq({
  clientName: 'producer',
  logLevel: 'info',
  connectionString: process.env.DATABASE_URL || DATABASE_URL,
  autoStart: true,

  // Disable push-notifications for this client as it doesn't
  // really need anything from the centralized queue.
  skipEmitter: true,

  // Set up a slow maintenance rate for this client.
  // This has an impact on "future documents" which will be
  // processed "not before 10s" from the moment they were ingested.
  //
  // Settings will have a low impact on the Postgres instance, but
  // it will reduce the feeling of "real-time" processing.
  //
  // This is good for system that need to process massive amount of data
  // that doesn't need to work real time.
  //
  // NOTE: if you never schedule documents in the future, you really
  // don't need any fast maintenance at all, as it's going to be used only
  // for statistical data and cleanup. In such scenario, even many seconds
  // of sleep time will go totally unnoticed.
  maintenance: {
    limit: 1,
    delay: 250,
    sleep: 10000,
  },

  // Here we configure our only queue to be a "slow queue",
  //
  // Push notifications are disabled, that means that no triggers are
  // associated with the queue itself, hence less CPU and memory is
  // being used in Postgres.
  //
  // The maintenance job happens max once in 10s which is already a
  // very long time. The longer this time, the less "real-time" the
  // queue will feel.
  //
  // If you have a delay of 10s and the system just performed the job,
  // and you push a new document 1s in the future, it will still take
  // AT LEAST 9s for the system to process such document!
  //
  // Fast real-time processing requires push-notifications and CPU.
  // Massive but non real-time data processing is much cheaper :-)
  queues: [
    {
      name: 'q1',
      enableNotifications: false,
      maintenance: {
        mnt: { delay: '10s', duration: '1m', limit: 500 },
      },
    },
  ],

  // For the sake of the example, we produce both future and past documents
  // so to play around with the "sleep" pauses.
  onReady: (client) => {
    setInterval(() => {
      const isFuture = Boolean(Math.round(Math.random()));
      const text = isFuture ? 'in the future' : 'right away';
      client.logger.info(` >>> new doc ${text}`);

      if (isFuture) {
        client.doc.push('q1', {
          subject: uuid(),
          payload: { isFuture },
          nextIteration: '+1ms',
        });
      } else {
        client.doc.append('q1', { isFuture });
      }
    }, ingestionRate);
  },
});
