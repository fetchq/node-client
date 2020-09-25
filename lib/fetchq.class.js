const winston = require('winston');
const { Pool } = require('pg');
const PGPubsub = require('@fetchq/pg-pubsub');

const { createConnect } = require('./functions/connect');
const { createDisconnect } = require('./functions/disconnect');
const { createInit } = require('./functions/init');
const { createStart } = require('./functions/start');
const { createInfo } = require('./functions/info');
const { createQueueList } = require('./functions/queue.list');
const { createQueueGet } = require('./functions/queue.get');
const { createQueueCreate } = require('./functions/queue.create');
const { createQueueDrop } = require('./functions/queue.drop');
const { createLogError } = require('./functions/queue.log-error');
const {
  createEnableNotifications,
} = require('./functions/queue.enable-notifications');
const { createSetMaxAttempts } = require('./functions/queue.set-max-attempts');
const {
  createSetErrorsRetention,
} = require('./functions/queue.set-errors-retention');
const {
  createSetCurrentVersion,
} = require('./functions/queue.set-current-version');
const { createWakeUp } = require('./functions/queue.wake-up');
const { createDocAppend } = require('./functions/doc.append');
const { createDocUpsert } = require('./functions/doc.upsert');
const { createDocPush } = require('./functions/doc.push');
const { createDocPushMany } = require('./functions/doc.push-many');
const { createDocPick } = require('./functions/doc.pick');
const { createDocReschedule } = require('./functions/doc.reschedule');
const { createDocReject } = require('./functions/doc.reject');
const { createDocComplete } = require('./functions/doc.complete');
const { createDocKill } = require('./functions/doc.kill');
const { createDocDrop } = require('./functions/doc.drop');
const { createMetricLogPack } = require('./functions/metric.log-pack');
const { createMetricGet } = require('./functions/metric.get');
const { createMetricGetTotal } = require('./functions/metric.get-total');
const { createMetricGetCommon } = require('./functions/metric.get-common');
const { createMetricGetAll } = require('./functions/metric.get-all');
const { createMetricCompute } = require('./functions/metric.compute');
const { createMetricComputeAll } = require('./functions/metric.compute-all');
const { createMetricReset } = require('./functions/metric.reset');
const { createMetricResetAll } = require('./functions/metric.reset-all');
const { createMntRun } = require('./functions/mnt.run');
const { createMntRunAll } = require('./functions/mnt.run-all');
const { createTrace } = require('./functions/trace');
const { createEventEmitter } = require('./functions/event-emitter');
const { createCheckStatus } = require('./functions/utils.check-status');
const { createReset } = require('./functions/utils.reset');
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

      decorateContext: {
        ...(settings.decorateContext || {}),
      },

      connectionRetry: {
        retries: 30,
        factor: 1,
        minTimeout: 1 * 1000,
        maxTimeout: 30 * 1000,
        ...(settings.connectionRetry || {}),
      },
    };

    this.daemons = [];
    this.logger = this.createLogger(this.settings);
    this.pool = this.createPool(this.settings);
    this.emitter = this.createEmitter(this.settings, this.logger);

    this.connect = createConnect(this);
    this.disconnect = createDisconnect(this);
    this.init = createInit(this);
    this.start = createStart(this);
    this.info = createInfo(this);
    this.trace = createTrace(this);

    this.queue = {
      list: createQueueList(this),
      get: createQueueGet(this),
      create: createQueueCreate(this),
      drop: createQueueDrop(this),
      enableNotifications: createEnableNotifications(this),
      setMaxAttempts: createSetMaxAttempts(this),
      setErrorsRetention: createSetErrorsRetention(this),
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
    this.mnt = {
      run: createMntRun(this),
      runAll: createMntRunAll(this),
      start: async (settings) => {
        const daemon = new Maintenance(this, settings);
        this.daemons.push(daemon);
        return await daemon.start();
      },
      stop: () => Promise.all(this.daemons.map((d) => d.stop())),
    };

    // utility functions
    this.utils = {
      checkStatus: createCheckStatus(this),
      reset: createReset(this),
    };

    // inject the event emitter apis
    createEventEmitter(this);

    // Initializes the queue registry
    this.queuesRegistry = new QueuesRegistry(this);

    // register workers by configurations
    this.workers = new WorkersPool(this);
    getWorkers(this.settings).forEach((worker) =>
      this.workers.register(worker),
    );
  }

  createPool(settings) {
    let config = {};

    // 2020-09-25 Deprecate "settings.connect"
    if (settings.connect) {
      this.logger.warn(
        `[config] Warning: "settings.connect" is deprecated in favor of "settings.connectionParams" and will be removed in v2.10.x`,
      );
      settings.connectionParams = settings.connect;
      settings.connect = null;
    }

    // generic pool settings
    if (settings.pool) {
      config = {
        ...config,
        ...settings.pool,
      };
    }

    // programmatic connection settings are mutual exclusive
    if (settings.connect) {
      config = {
        ...config,
        ...settings.connect,
      };
    } else if (settings.connectionString) {
      config.connectionString = settings.connectionString;

      // super default values configuration
    } else {
      /* eslint-disable-next-line */
      config.connectionString = process.env.PGSTRING
        ? process.env.PGSTRING
        : `postgresql://${process.env.PGUSER || 'postgres'}:${
            process.env.PGPASSWORD || 'postgres'
          }@${process.env.PGHOST || 'localhost'}:${
            process.env.PGPORT || '5432'
          }/${process.env.PGDATABASE || 'postgres'}`;
    }

    return new Pool(config);
  }

  createEmitter(settings, logger) {
    let connStr = null;
    if (settings.connectionString) {
      connStr = settings.connectionString;
    } else if (settings.connect) {
      /* eslint-disable-next-line */
      connStr = `postgresql://${settings.connect.user}:${settings.connect.password}@${settings.connect.host}:${settings.connect.port}/${settings.connect.database}`;
    } else {
      /* eslint-disable-next-line */
      connStr = process.env.PGSTRING
        ? process.env.PGSTRING
        : `postgresql://${process.env.PGUSER || 'postgres'}:${
            process.env.PGPASSWORD || 'postgres'
          }@${process.env.PGHOST || 'localhost'}:${
            process.env.PGPORT || '5432'
          }/${process.env.PGDATABASE || 'postgres'}`;
    }

    // throw new Error(`CONNECTION STRINT: ${connStr}`)
    return new PGPubsub(connStr, {
      log: logger.verbose.bind(logger),
    });
  }

  createLogger(settings) {
    return new winston.Logger({
      level: settings.logLevel || process.env.LOG_LEVEL || 'error',
      transports: [new winston.transports.Console()],
    });
  }

  async stop() {
    await this.mnt.stop();
    await this.workers.stop();
    await this.queuesRegistry.stop();
  }

  async boot() {
    await this.init();
    await this.start();
    return this;
  }

  // Stops all connections and workers
  end() {
    return Promise.all([this.mnt.stop(), this.workers.stop()]).then(() =>
      Promise.all([this.pool.end(), this.emitter.close()]),
    );
  }
}

module.exports = {
  Fetchq,
};
