console.log('FetchQ Client // Examples // App02')
const fetchq = require('fetchq');
const fastify = require('fastify');
const uuid = require('uuid/v1');

const client = fetchq({
  logLevel: 'info',
  connectionString: 'postgres://postgres:postgres@localhost:5432/postgres',

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
    }
  ],

  workers: [
    // validates the username and pushes forward
    {
      queue: 'process_signup',
      lock: '20s',
      handler: async (doc, { client }) => {
        const { username } = doc.payload;

        // Apply validation to the username
        if (username.length <= 5) {
          client.emitPipelineFailed(`signup-${username}`, 'username too short!');
          return { action: 'kill', ...doc }
        }

        // Push the document forward down the line
        await client.doc.append('process_signup_id', doc.payload);

        // keep the processed document as long-term data log.
        // (this is not really efficient, would be better to move the
        // log into a timeserie db like TimescaleDB)
        return { action: 'complete', ...doc };
      },
    },
    // calculates the user's id and tries to save the user.
    {
      queue: 'process_signup_id',
      handler: async (doc, { client }) => {
        const { username } = doc.payload;

        const payload = {
          ...doc.payload,
          id: uuid(),
        }

        // store the username in a unique table:
        // (this simulates a real user storage table)
        const res = await client.doc.push('store_users', {
          subject: username,
          payload,
        });

        // emit a signal based on the signup result:
        if (res.queued_docs > 0) {
          client.emitPipelineComplete(`signup-${username}`, payload);
        } else {
          client.emitPipelineFailed(`signup-${username}`, 'username exists!');
        }

        // keep the processed document as long-term data log.
        // (this is not really efficient, would be better to move the
        // log into a timeserie db like TimescaleDB)
        return { action: 'drop' };
      },
    }],
});

/**
 * Exposes a Fastify server that accepts a POST request
 * with a "username" property in order to simulate a signup
 */
const server = fastify({ logger: false });
server.post('/', async (req, reply) => {
  try {
    // setup the pipeline name with an optional timeout
    const pipeline = client.onPipeline(`signup-${req.body.username}`, 1000);

    // push the document into the pipeline
    // a worker will handle this and process the pipeline
    client.doc.append('process_signup', req.body)

    // await for the pipeline to complete before sending out stuff
    // this will hang the request until the pipeline emits or timeout happens
    reply.send(await pipeline);
  } catch (err) {
    reply.status(500).send(err);
  }
});

// Boot
;(async () => {
  await client.init();
  await client.start();
  await server.listen(8080);
})();
