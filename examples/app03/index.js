console.log('FetchQ Client // Examples // App02')
const fetchq = require('fetchq');
const fastify = require('fastify');
const uuid = require('uuid/v1');

/**
 * Exposes a Fastify server that accepts a POST request
 * with a "username" property in order to simulate a signup.
 *
 * The entire handling of the signup process is delegated to
 * a FetchQ Workflow, the route handler will simply idle until
 * the workflow's Promise resolves or rejects.
 */
const server = fastify({ logger: false });
server.post('/', async (req, reply) => {
  try {
    // Create a workflow that will be executed by one or more
    // workers, possibly across a number of different machines.
    const workflow = client.createWorkflow({
      queue: 'signup',
      payload: req.body,
      timeout: 1000, // defaults to 20s
    })

    // Await for the workflow to finish and send out the result:
    const workflowResult = await workflow.run();
    console.log(workflowResult);

    reply.send(workflowResult);
  } catch (err) {
    reply.status(500).send(err);
  }
});


/**
 * FetchQ Configuration
 * In this queue client we setup the workflow handlers.
 *
 * Each handler performs a single responsability and can perform 3 actions:
 * - resolve
 * - reject
 * - forward
 *
 * "Resolve" and "Reject" work pretty much as a promise.
 * You can pass a valid JSON payload as message and that payload will be
 * distributed across all connected servers using Postgre's emitter.
 *
 * NOTE: `workflow.reject(new Error('xxx'))` won't work!
 *
 * "Forward" is a utility method that will push the document into a
 * different queue aiming to move the workflow forward.
 */
const client = fetchq({
  logLevel: 'info',
  connectionString: 'postgres://postgres:postgres@localhost:5432/postgres',

  // [OPTIONAL] Create the queues at boot time.
  queues: [
    { name: 'signup', enableNotifications: true },
    { name: 'signup_process', enableNotifications: true },
    { name: 'store_users' },
  ],

  workers: [
    // Process Signup Request:
    // validates the username and pushes forward
    {
      queue: 'signup',
      handler: async (doc, { workflow }) => {
        const { username } = doc.payload;

        // Apply validation to the username
        if (username.length <= 5) {
          return workflow.reject(new Error('username is too short'));
        }

        // Push the document forward down the line
        return workflow.forward('signup_process', {
          payload: { foo: 123 },
        });
      },
    },
    //
    // calculates the user's id and tries to save the user.
    {
      queue: 'signup_process',
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
          return workflow.reject(new Error(`username "${subject}" exists!`))
        }
      },
    }],
});

// Boot
;(async () => {
  await client.init();
  await client.start();
  await server.listen(8080);
})();