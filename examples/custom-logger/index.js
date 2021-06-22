const fetchq = require('fetchq');

const connectionString =
  process.env.DATABASE_URL ||
  'postgres://postgres:postgres@localhost:5432/postgres';

console.log('');
console.log('###');
console.log('### FetchQ Client // Examples // App05');
console.log('### connecting to: ', connectionString);
console.log('###');
console.log('');

/**
 * Create a custom logger that spits everything out to console,
 * but only "info" logs to a local file.
 */
const winston = require('winston');
const logger = winston.createLogger({
  level: 'verbose',
  // format: winston.format.json(),
  defaultMeta: { client: 'client1' },
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.Console({ format: winston.format.simple() }),
    new winston.transports.File({
      filename: 'fetchq.log',
      timestamp: true,
      level: 'info',
    }),
  ],
});

/**
 * SETUP THE SYSTEM
 */

const client = fetchq({
  connectionString,
  autoStart: true,
  // Setup the custom logger and turn off the default decorator
  logger: {
    instance: logger,
    decorator: false,
  },
  queues: [
    {
      name: 'q1',
      workerHandler: (doc, { fetchq }) => {
        fetchq.logger.info(`processing document ${doc.subject}`);
        return doc.drop();
      },
    },
  ],
  onReady: async (client) => {
    client.logger.info('Fetchq is ready');
    const data = await client.doc.append('q1', { fii: 3 });
    client.logger.info('Appended document', data);
  },
});

client.boot();
