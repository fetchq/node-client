const fetchq = require('fetchq');

console.log('');
console.log('###');
console.log('### FetchQ Client // Examples // ON ERROR');
console.log('###');
console.log('');

fetchq({
  clientName: 'foo',
  logLevel: 'verbose',
  autoStart: true,
  connectionRetry: { retries: 1 },
  connectionString: 'postres://this:will@not:work/ever',
  onConnectError: (err, client) => {
    client.logger.error(`[onConnectError] ${err.message}`);
  },
  onBootError: (err, client) => {
    client.logger.error(`[onBootError] ${err.message}`);
  },
});
