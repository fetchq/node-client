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
      handler: async (doc, { client, workflow }) => {
        const { username } = doc.payload;

        // Apply validation to the username
        if (username.length <= 5) {
          return workflow.reject('username is too short');
        }

        // Push the document forward down the line
        return workflow.forward('process_signup_id');
      },
    },
    // calculates the user's id and tries to save the user.
    {
      queue: 'process_signup_id',
      handler: async (doc, { client, workflow }) => {
        // Fetches a payload that is stripped by any workflow
        // related informations.
        const payload = workflow.getPayload();
        const { username: subject } = payload;

        // Fakes to generate a user id:
        // this is just to demonstrate how to add stuff to a document's payload.
        payload.id = uuid();

        // store the username in a unique table:
        // (this simulates a real user storage table)
        const res = await client.doc.push('store_users', {
          subject,
          payload: {
            original: doc.payload,
            cleaned: payload,
          },
        });

        // emit a signal based on the signup result:
        if (res.queued_docs > 0) {
          return workflow.resolve(payload)
        } else {
          return workflow.reject(`username "${subject}" exists!`)
        }
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
    // Create a workflow that will be executed by one or more
    // workers, possibly across a number of different machines.
    const workflow = client.createWorkflow({
      queue: 'process_signup',
      payload: req.body,
      timeout: 1000,
    })

    // Await for the workflow to finish and send out the result:
    reply.send(await workflow.run());
  } catch (err) {
    reply.status(500).send(err);
  }
});

// Boot
;(async () => {
  await client.init();
  await client.start();
  await server.listen(8080, '::');

  // await new Promise(resolve => setTimeout(resolve, 50));

  // const workflow = client.createWorkflow({
  //   queue: 'process_signup',
  //   payload: { username: `foonhiojiojojo`},
  // });

  // console.log(`Workflow initiated: "${workflow.id}"`)

  // try {
  //   const res = await workflow.run();
  //   console.log('RESULT', res);
  // } catch (err) {
  //   console.log('WORKFLO EROR', err);
  // }

})();
