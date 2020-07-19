const fetchq = require('fetchq');
const fastify = require('fastify');
const uuid = require('uuid/v1');

const connectionString =
  process.env.DATABASE_URL ||
  'postgres://postgres:postgres@localhost:5432/postgres';

console.log('FetchQ Client // Examples // App02');
console.log('connecting to: ', connectionString);

const client = fetchq({
  logLevel: 'info',
  connectionString,

  // Try to create a free Postgres database at: https://elephantsql.com
  // FetchQ will automatically initialize the db on the first run!
  // ------
  // connectionString: 'postgres://xxx:yyy@manny.db.elephantsql.com:5432/zzz',
  // pool: { max: 1 },

  queues: [
    {
      name: 'process_signup',
      isActive: true,
      enableNotifications: true,
    },
    {
      name: 'process_signup_id',
      isActive: true,
      enableNotifications: true,
    },
    {
      name: 'store_users',
    },
  ],

  workers: [
    // validates the username and pushes forward
    {
      queue: 'process_signup',
      lock: '20s',
      handler: async (doc, { client }) => {
        const { username, pipelineId } = doc.payload;

        // Apply validation to the username
        if (username.length <= 5) {
          const message = 'username is too short';
          await client.emitPipelineFailed(pipelineId, message);
          return doc.kill(message);
        }

        // Push the document forward down the line
        await doc.forward('process_signup_id');

        // keep the processed document as long-term data log.
        // (this is not really efficient, would be better to move the
        // log into a timeserie db like TimescaleDB)
        return doc.complete();
      },
    },
    // calculates the user's id and tries to save the user.
    {
      queue: 'process_signup_id',
      handler: async (doc, { client }) => {
        const { username, pipelineId } = doc.payload;

        const payload = {
          ...doc.payload,
          id: uuid(),
        };

        // store the username in a unique table:
        // (this simulates a real user storage table)
        const res = await client.doc.push('store_users', {
          subject: username,
          payload,
        });

        // emit a signal based on the signup result:
        if (res.queued_docs > 0) {
          await client.emitPipelineComplete(pipelineId, payload);
          return doc.complete();
        } else {
          message = 'username exists!';
          client.emitPipelineFailed(pipelineId, message);
          return doc.kill({ message });
        }
      },
    },
  ],
});

/**
 * Exposes a Fastify server that accepts a POST request
 * with a "username" property in order to simulate a signup
 */
const server = fastify({ logger: false });
server.post('/', async (req, reply) => {
  try {
    // setup the pipeline name with an optional timeout
    const pipelineId = `signup-${req.body.username}`;
    const pipeline = client.onPipeline(pipelineId, 1000);

    // push the document into the pipeline
    // a worker will handle this and process the pipeline
    await client.doc.append('process_signup', {
      pipelineId,
      ...req.body,
    });

    // await for the pipeline to complete before sending out stuff
    // this will hang the request until the pipeline emits or timeout happens
    reply.send(await pipeline);
  } catch (err) {
    reply.status(500).send(err);
  }
});

// Boot
(async () => {
  await client.init();
  await client.start();
  await server.listen(8080, '::');
})();
