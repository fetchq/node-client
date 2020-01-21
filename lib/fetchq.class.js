const winston = require('winston')
const { Pool } = require('pg')
const PGPubsub = require('pg-pubsub')

const { createConnect } = require('./functions/connect')
const { createDisconnect } = require('./functions/disconnect')
const { createInit } = require('./functions/init')
const { createInfo } = require('./functions/info')
const { createQueueList } = require('./functions/queue.list')
const { createQueueGet } = require('./functions/queue.get')
const { createQueueCreate } = require('./functions/queue.create')
const { createQueueDrop } = require('./functions/queue.drop')
const { createLogError } = require('./functions/queue.log-error')
const { createEnableNotifications } = require('./functions/queue.enable-notifications')
const { createSetMaxAttempts } = require('./functions/queue.set-max-attempts')
const { createSetErrorsRetention } = require('./functions/queue.set-errors-retention')
const { createSetCurrentVersion } = require('./functions/queue.set-current-version')
const { createWakeUp } = require('./functions/queue.wake-up')
const { createDocAppend } = require('./functions/doc.append')
const { createDocUpsert } = require('./functions/doc.upsert')
const { createDocPush } = require('./functions/doc.push')
const { createDocPushMany } = require('./functions/doc.push-many')
const { createDocPick } = require('./functions/doc.pick')
const { createDocReschedule } = require('./functions/doc.reschedule')
const { createDocReject } = require('./functions/doc.reject')
const { createDocComplete } = require('./functions/doc.complete')
const { createDocKill } = require('./functions/doc.kill')
const { createDocDrop } = require('./functions/doc.drop')
const { createMetricLogPack } = require('./functions/metric.log-pack')
const { createMetricGet } = require('./functions/metric.get')
const { createMetricGetTotal } = require('./functions/metric.get-total')
const { createMetricGetCommon } = require('./functions/metric.get-common')
const { createMetricGetAll } = require('./functions/metric.get-all')
const { createMetricCompute } = require('./functions/metric.compute')
const { createMetricComputeAll } = require('./functions/metric.compute-all')
const { createMetricReset } = require('./functions/metric.reset')
const { createMetricResetAll } = require('./functions/metric.reset-all')
const { createMntRun } = require('./functions/mnt.run')
const { createMntRunAll } = require('./functions/mnt.run-all')
const { createTrace } = require('./functions/trace')
const { createEventEmitter } = require('./functions/event-emitter')
const { Maintenance } = require('./maintenance.class')
const { WorkersPool } = require('./workers-pool.class')
const { QueuesRegistry } = require('./queues-registry.class')

const getWorkersFromQueues = (queues = []) =>
  queues
    .filter($ => $.workerHandler)
    .map($ => ({
      queue: $.name,
      handler: $.workerHandler,
      version: $.currentVersion,
      ...($.workerOptions || {}),
    }));

const getWorkersFromSettings = (workers = []) => workers;

const getWorkers = settings => [
  ...getWorkersFromQueues(settings.queues),
  ...getWorkersFromSettings(settings.workers),
];

class Fetchq {
  constructor(settings = {}) {
    this.settings = settings
    this.daemons = []
    this.pool = this.createPool(settings)
    this.emitter = this.createEmitter(settings)
    this.logger = this.createLogger(settings)

    this.connect = createConnect(this)
    this.disconnect = createDisconnect(this)
    this.init = createInit(this)
    this.info = createInfo(this)
    this.trace = createTrace(this)

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
    }

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
    }

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
    }

    // maintenance utilities
    this.mnt = {
      run: createMntRun(this),
      runAll: createMntRunAll(this),
      start: async (settings) => {
        const daemon = new Maintenance(this, settings)
        this.daemons.push(daemon)
        return await daemon.start()
      },
      stop: () => Promise.all(this.daemons.map(d => d.stop())),
    }

    // inject the event emitter apis
    createEventEmitter(this);

    // Initializes the queue registry
    this.queuesRegistry = new QueuesRegistry(this)

    // register workers by configurations
    this.workers = new WorkersPool(this)
    getWorkers(this.settings).forEach(worker => this.workers.register(worker))
  }

  createPool(settings) {
    let config = {}

    // generic pool settings
    if (settings.pool) {
      config = {
        ...config,
        ...settings.pool,
      }
    }

    // programmatic connection settings are mutual exclusive
    if (settings.connect) {
      config = {
        ...config,
        ...settings.connect,
      }
    } else if (settings.connectionString) {
      config.connectionString = settings.connectionString

      // super default values configuration
    } else {
      /* eslint-disable-next-line */
      config.connectionString = process.env.PGSTRING
        ? process.env.PGSTRING
        : `postgresql://${process.env.PGUSER || 'postgres'}:${process.env.PGPASSWORD || 'postgres'}@${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || '5432'}/${process.env.PGDATABASE || 'postgres'}`;
    }

    return new Pool(config)
  }

  createEmitter(settings) {
    let connStr = null
    if (settings.connectionString) {
      connStr = settings.connectionString
    } else if (settings.connect) {
      /* eslint-disable-next-line */
      connStr = `postgresql://${settings.connect.user}:${settings.connect.password}@${settings.connect.host}:${settings.connect.port}/${settings.connect.database}`
    } else {
      /* eslint-disable-next-line */
      connStr = process.env.PGSTRING
        ? process.env.PGSTRING
        : `postgresql://${process.env.PGUSER || 'postgres'}:${process.env.PGPASSWORD || 'postgres'}@${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || '5432'}/${process.env.PGDATABASE || 'postgres'}`;
    }

    // throw new Error(`CONNECTION STRINT: ${connStr}`)
    return new PGPubsub(connStr)
  }

  createLogger(settings) {
    return new winston.Logger({
      level: settings.logLevel || process.env.LOG_LEVEL || 'error',
      transports: [
        new (winston.transports.Console)(),
      ]
    })
  }

  async start() {
    await this.mnt.start(this.settings.maintenance)
    await this.queuesRegistry.start()
    await this.workers.start()
    return this
  }

  async boot() {
    await this.init();
    await this.start();
    return this;
  }
}

module.exports = {
  Fetchq
}
