// Q2
// reschedule a document a few times just because we think it's fun,
// the document get then added into yet another queue.
//
// once processed, the document is dropped

const fetchq = require('fetchq');

module.exports = (config = {}) =>
  fetchq({
    ...config,
    maintenance: {
      limit: 3,
      delay: 250,
      sleep: 5000,
    },
    workers: [
      {
        queue: 'q2',
        concurrency: 5,
        handler: async (doc, { client }) => {
          client.logger.info(`${doc.queue} (${doc.iterations})`, doc.payload);

          // after a few repetition, this document gets re-routed into
          // yet another queue for further processing.
          if (doc.iterations >= 3) {
            await doc.forward('q3', {
              q2: true,
              iterations: doc.iterations,
            });
            return doc.drop();
          }

          // Just a custom persistent log bound to the current document
          // error message [ error payload | reference id ]
          await doc.logError('not yet time to process', doc);

          return doc.reschedule('+1ms');
        },
      },
    ],
  }).boot();
