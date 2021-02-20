const fetchq = require('fetchq');
const DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/postgres';

console.log('');
console.log('###');
console.log('### FetchQ Client // Examples // Workflow API');
console.log('###');
console.log('');

/**
 * SHARED CONFIGURATION
 * ====================
 *
 * Different parts of this applications need the very same configuration.
 * Here we jot down a few settings that you can manipulate to play
 * with the system's performance and workload
 *
 */
const maxProducers = 1;
const producerDelay = 2500;

const queueConfig = {
  maintenance: {
    mnt: { delay: '10m', duration: '1m', limit: 500 },
    sts: { delay: '10m', duration: '5m' },
    // cmp: { delay: '10m', duration: '5m' },
    // drp: { delay: '10m', duration: '5m' },
  },
};

const workerConfig = {
  sleep: 1000 * 60 * 60,
};

const clientConfig = {
  autoStart: true,
  logLevel: 'info',
  connectionString: process.env.DATABASE_URL || DATABASE_URL,
  // skipMaintenance: true,
  // maintenance: {
  //   delay: 1000 * 60 * 60,
  //   sleep: 1000 * 60 * 60,
  // },
};

/**
 * PRODUCER FACTORY
 * ================
 *
 * This function creates a new Fetchq client that will simply
 * start to generate workflows to play random numbers.
 *
 */
const createProducer = (clientName, delay = 0) =>
  fetchq({
    ...clientConfig,
    clientName,
    onReady: (client) => {
      const loop = async () => {
        // Generate a random number to play:
        const number = Math.floor(Math.random() * 10 + 1);

        // Create a workflow that will be executed by one or more
        // workers, possibly across a number of different machines.
        const workflow = client.createWorkflow({
          queue: 'wkf_step1',
          payload: { number },
        });

        // Await for the workflow to finish and send out the result:
        try {
          client.logger.info(` Start workflow: ${workflow.id}`);
          const result = await workflow.run();
          client.logger.info(` Completed workflow: ${workflow.id}`);
          client.logger.info(` $> ${result}`);

          // Or trace the error from the permanent logs
        } catch (err) {
          client.logger.error(` Failed workflow: ${workflow.id}`);
          client.logger.error(` $> ${err.message}`);

          // const trace = await workflow.trace();
          // console.log(trace);
        }

        // Repeat only if there is a set delay:
        delay && setTimeout(loop, delay);
      };

      loop();
    },
  });

/**
 * SCHEMA CONFIGURATOR
 * ===================
 *
 * This client does absolutely nothing but setting up the
 * queues that will handle the workflow.
 *
 * Try to comment this out (or set "autoStart" false) and
 * reset the db.
 *
 * You will see all your workflow failing as the workflow
 * entry point "wkf_step1" does not exists.
 *
 */
fetchq({
  ...clientConfig,
  // autoStart: false,
  clientName: 'schema',
  queues: [
    {
      ...queueConfig,
      name: 'wkf_step1',
    },
    {
      ...queueConfig,
      name: 'wkf_step2',
    },
    {
      ...queueConfig,
      name: 'wkf_step3',
    },
  ],
});

/**
 * WORKFLOW - STEP n.1
 * ===================
 *
 * This step validates the input:
 * - it should exists
 * - it should NOT be an odd number
 *
 */
fetchq({
  ...clientConfig,
  clientName: 'step1',
  workers: [
    {
      ...workerConfig,
      queue: 'wkf_step1',
      handler: async (_, { workflow }) => {
        // Extract the number variable from the workflow's payload
        const { number } = workflow.getPayload();

        // Apply some validation and a "eager exit" strategy that
        // will interrupt the workflow with an error.
        if (!number) {
          const error = new Error(`Please provide a number!`);
          return workflow.reject(error);
        }
        if (number % 2) {
          const error = new Error(`We do not accept odd numbers (${number})`);
          return workflow.reject(error);
        }

        // Forward the workflow to the next step:
        return workflow.forward('wkf_step2');
      },
    },
  ],
});

/**
 * WORKFLOW - STEP n.3
 * ===================
 *
 * The business logic here is to double the input number.
 * Big deal!
 *
 * The interesting part is how we can forward a document to the
 * next step in the workflow, AND decorate the workflow payload
 * with new informations.
 *
 * NOTE:
 * Existing keys will be either preserved or overwritten.
 */
fetchq({
  ...clientConfig,
  clientName: 'step2',
  workers: [
    {
      ...workerConfig,
      queue: 'wkf_step2',
      handler: async (_, { workflow }) => {
        const { number } = workflow.getPayload();
        const result = number * 2;

        return workflow.forward('wkf_step3', {
          payload: { result },
        });
      },
    },
  ],
});

/**
 * WORKFLOW - STEP n.2
 * ===================
 *
 * Decorates the result into a meaningful string ;-)
 */
fetchq({
  ...clientConfig,
  clientName: 'step3',
  workers: [
    {
      ...workerConfig,
      queue: 'wkf_step3',
      handler: async (_, { workflow }) => {
        const { number, result } = workflow.getPayload();
        return workflow.resolve(`The double of ${number} is ${result}`);
      },
    },
  ],
});

for (let i = 0; i < maxProducers; i++) {
  createProducer(`#${i + 1}`, producerDelay);
}
