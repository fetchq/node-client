// Q3
// find out is the document's subject begins with a digit [0-9] and take different
// actions based on this intelligence.
//
// An interesting detail about this worker is that it customizes the default document
// lock time (5 minutes) to just 5 seconds so the cleanup maintenance process will
// quickly collect rejected documents and kill them.

const fetchq = require('fetchq');

module.exports = (config = {}) =>
  fetchq({
    ...config,
    skipMaintenance: true,
    clientName: 'client3',
    workers: [
      {
        queue: 'q3',
        lock: '5s',
        handler: async (doc, { client }) => {
          client.logger.info(`${doc.queue} - ${doc.subject}`, doc.payload);

          // if the subject begins with a number, the process is finally completed
          if (
            doc.subject.substr(0, 1) ===
            parseInt(doc.subject.substr(0, 1), 10).toString()
          ) {
            return doc.complete();

            // else we reject the document with a reason that will be logged into
            // the errors table. the cleanup maintenance will eventually kill the document
          } else {
            return doc.reject('not a number');
          }
        },
      },
    ],
  }).boot();
