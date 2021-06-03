const { v4: uuid } = require('uuid');

// Client
const { createConnect } = require('./functions/client/client.connect');
const { createLogger } = require('./functions/client/client.create-logger');
const { createPool } = require('./functions/client/client.create-pool');
const { createEmitter } = require('./functions/client/client.create-emitter');
const { createInit } = require('./functions/client/client.init');
const { createStart } = require('./functions/client/client.start');
const { createInfo } = require('./functions/client/client.info');
const { createTrace } = require('./functions/client/client.trace');
const {
  createDecorateContext,
} = require('./functions/client/client.decorate-context');
const {
  createEventEmitter,
} = require('./functions/client/client.event-emitter');

// Queue
const { createQueueList } = require('./functions/queue/queue.list');
const { createQueueGet } = require('./functions/queue/queue.get');
const { createQueueCreate } = require('./functions/queue/queue.create');
const { createQueueDrop } = require('./functions/queue/queue.drop');
const { createLogError } = require('./functions/queue/queue.log-error');
const {
  createEnableNotifications,
} = require('./functions/queue/queue.enable-notifications');
const {
  createSetMaxAttempts,
} = require('./functions/queue/queue.set-max-attempts');
const {
  createSetLogsRetention,
} = require('./functions/queue/queue.set-logs-retention');
const {
  createSetCurrentVersion,
} = require('./functions/queue/queue.set-current-version');
const { createWakeUp } = require('./functions/queue/queue.wake-up');

// Doc
const { createDocAppend } = require('./functions/doc/doc.append');
const { createDocUpsert } = require('./functions/doc/doc.upsert');
const { createDocPush } = require('./functions/doc/doc.push');
const { createDocPushMany } = require('./functions/doc/doc.push-many');
const { createDocPick } = require('./functions/doc/doc.pick');
const { createDocReschedule } = require('./functions/doc/doc.reschedule');
const { createDocReject } = require('./functions/doc/doc.reject');
const { createDocComplete } = require('./functions/doc/doc.complete');
const { createDocKill } = require('./functions/doc/doc.kill');
const { createDocDrop } = require('./functions/doc/doc.drop');

// Metric
const { createMetricLogPack } = require('./functions/metric/metric.log-pack');
const { createMetricGet } = require('./functions/metric/metric.get');
const { createMetricGetTotal } = require('./functions/metric/metric.get-total');
const {
  createMetricGetCommon,
} = require('./functions/metric/metric.get-common');
const { createMetricGetAll } = require('./functions/metric/metric.get-all');
const { createMetricCompute } = require('./functions/metric/metric.compute');
const {
  createMetricComputeAll,
} = require('./functions/metric/metric.compute-all');
const { createMetricReset } = require('./functions/metric/metric.reset');
const { createMetricResetAll } = require('./functions/metric/metric.reset-all');

// Maintenance
const { createMntRun } = require('./functions/mnt/mnt.run');
const { createMntRunAll } = require('./functions/mnt/mnt.run-all');

// Utils
const { createCheckStatus } = require('./functions/utils/utils.check-status');
const { createAwaitStatus } = require('./functions/utils/utils.await-status');
const { createReset } = require('./functions/utils/utils.reset');

const { Maintenance } = require('./maintenance.class');
const { WorkersPool } = require('./workers-pool.class');
const { QueuesRegistry } = require('./queues-registry.class');

const getWorkersFromQueues = (queues = []) =>
  queues
    .filter(($) => $.workerHandler)
    .map(($) => ({
      queue: $.name,
      handler: $.workerHandler,
      version: $.currentVersion,
      ...($.workerOptions || {}),
    }));

const getWorkersFromSettings = (workers = []) => workers;

const getWorkers = (settings) => [
  ...getWorkersFromQueues(settings.queues),
  ...getWorkersFromSettings(settings.workers),
];

class Fetchq {
  constructor(settings = {}) {
    // Create a shallow copy of the settings,
    // TODO: apply deep copy to the `queues` keyword to avoid having
    //       a setting change from the outside after initialization.
    // TODO: apply a shallow copy at single `worker[]` level to avoid
    //       a setting change from the outside after initialization.
    //       but to keep references to the `handler` function.
    this.settings = {
      ...settings,

      __dangerouslyAwaitWithoutReason:
        settings.__dangerouslyAwaitWithoutReason || 250,

      logger: settings.logger || {},

      queues: settings.queues || [],
      workers: settings.workers || [],

      // Flags
      skipUpsertFetchq: settings.skipUpsertFetchq || process.env['FETCHQ_SKIP_UPSERT_FETCHQ'] || false,
      skipUpsertQueues: settings.skipUpsertQueues || process.env['FETCHQ_SKIP_UPSERT_QUEUES'] || false,
      skipMaintenance: settings.skipMaintenance || process.env['FETCHQ_SKIP_MAINTENANCE'] || false,
      skipEmitter: settings.skipEmitter || process.env['FETCHQ_SKIP_EMITTER'] || false,

      decorateContext: {
        ...(settings.decorateContext || {}),
      },

      // used by "promise-retry" while attempting to connect to the database
      connectionRetry: {
        retries: 30,
        factor: 1,
        minTimeout: 1 * 1000,
        maxTimeout: 30 * 1000,
        ...(settings.connectionRetry || {}),
      },

      // used by "promise-retry" while attempting to initialize the Fetchq data structure
      initializationRetry: {
        retries: 30,
        factor: 1,
        minTimeout: 1 * 1000,
        maxTimeout: 30 * 1000,
        ...(settings.initializationRetry || {}),
      },
    };

    // Setup client id and name
    this.uuid = uuid();
    this.name = this.settings.clientName || this.uuid;

    this.logger = createLogger(this)(this.settings);
    this.pool = createPool(this)(this.settings);

    // Optional pubSub
    // issue #41
    if (this.settings.skipEmitter !== true) {
      this.emitter = createEmitter(this)(this.settings);
    }

    this.connect = createConnect(this);
    this.init = createInit(this);
    this.start = createStart(this);
    this.info = createInfo(this);
    this.trace = createTrace(this);
    this.decorateContext = createDecorateContext(this);

    this.queue = {
      list: createQueueList(this),
      get: createQueueGet(this),
      create: createQueueCreate(this),
      drop: createQueueDrop(this),
      enableNotifications: createEnableNotifications(this),
      setMaxAttempts: createSetMaxAttempts(this),
      setLogsRetention: createSetLogsRetention(this),
      setCurrentVersion: createSetCurrentVersion(this),
      wakeUp: createWakeUp(this),
      logError: createLogError(this),
    };

    this.doc = {
      push: createDocPush(this),
      pushMany: createDocPushMany(this),
      append: createDocAppend(this),
      upsert: createDocUpsert(this),
      pick: createDocPick(this),
      reschedule: createDocReschedule(this),
      reject: createDocReject(this),
      complete: createDocComplete(this),
      kill: createDocKill(this),
      drop: createDocDrop(this),
    };

    this.metric = {
      logPack: createMetricLogPack(this),
      get: createMetricGet(this),
      getTotal: createMetricGetTotal(this),
      getCommon: createMetricGetCommon(this),
      getAll: createMetricGetAll(this),
      compute: createMetricCompute(this),
      computeAll: createMetricComputeAll(this),
      reset: createMetricReset(this),
      resetAll: createMetricResetAll(this),
    };

    // maintenance utilities
    this.daemons = [];
    this.mnt = {
      run: createMntRun(this),
      runAll: createMntRunAll(this),
      start: async (settings) => {
        const daemon = new Maintenance(this, settings);
        this.daemons.push(daemon);
        return daemon.start();
      },
      stop: () => Promise.all(this.daemons.map((d) => d.stop())),
    };

    // utility functions
    this.utils = {
      checkStatus: createCheckStatus(this),
      awaitStatus: createAwaitStatus(this),
      reset: createReset(this),
    };

    // inject the event emitter apis
    // Optional pubSub
    // issue #41
    if (this.settings.skipEmitter !== true) {
      createEventEmitter(this);
    }

    // Initializes the queue registry
    this.queuesRegistry = new QueuesRegistry(this);

    // register workers by configurations
    this.workers = new WorkersPool(this);
    getWorkers(this.settings).forEach((worker) =>
      this.workers.register(worker),
    );

    // Implicitly boot the client asynchronously
    if (this.settings.autoStart === true) {
      setTimeout(() => this.boot());
    }
  }

  async stop() {
    await this.mnt.stop();
    await this.workers.stop();
    await this.queuesRegistry.stop();
  }

  async boot() {
    try {
      await this.connect();
      await this.init();
      await this.start();
    } catch (err) {
      if (this.settings.onBootError) {
        this.settings.onBootError(err, this);
      } else {
        throw err;
      }
    }
    return this;
  }

  // Stops all connections and workers
  async end() {
    await this.queuesRegistry.stop();
    await this.mnt.stop();
    await this.workers.stop();

    // Should await that all the channels have been de-subscribed
    // this is because of an issue in PubSub and "removeChannel" is not async!
    await new Promise((r) =>
      setTimeout(r, this.settings.__dangerouslyAwaitWithoutReason),
    );

    await this.emitter.close();
    await this.pool.end();
  }
}

module.exports = {
  Fetchq,
};
