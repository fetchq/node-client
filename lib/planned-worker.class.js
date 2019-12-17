const pause = require('@marcopeg/utils/lib/pause')

const reschedule = (nextIteration, options = {}) => ({
  ...options,
  nextIteration,
  action: 'reschedule',
});

const reject = (message, options = {}) => ({
  ...options,
  message,
  action: 'reject',
});

const complete = (options = {}) => ({
  ...options,
  action: 'complete',
});

const kill = (message = null, options = {}) => {
  if (typeof message === 'object' && message !== null) {
    return {
      ...message,
      ...options,
      action: 'kill',
    };
  } else {
    return {
      ...options,
      message,
      action: 'kill',
    };
  }
};

const drop = (options = {}) => ({
  ...options,
  action: 'drop',
});

const documentActions = {
  reschedule,
  reject,
  complete,
  kill,
  drop,
};

class PlannedWorker {
  constructor(ctx, settings) {
    this.ctx = ctx

    // generic worker stuff
    this.index = settings.index
    this.name = settings.name || `${settings.queue}-default`
    this.id = `${this.name}-${this.index}`
    this.queue = settings.queue
    this.version = settings.version || 0
    this.handler = settings.handler
    this.batch = settings.batch || 1
    this.lock = settings.lock || undefined
    this.delay = settings.delay || 250
    this.loopDelay = settings.loopDelay || this.delay
    this.batchDelay = settings.batchDelay || this.delay
    this.sleep = settings.sleep || 5000
    // this.realTime = settings.realTime || false
    // this.realTimeDelay = settings.realTimeDelay || 3600000 // 1h

    // loop maintenance
    this.isRunning = false
    this.isStopping = false
    this.hasStopped = false
    this.timer = null

    // subscribe to the queue's registry so to start/stop based on remote settings
    this.ctx.queuesRegistry.onChange(async () => {
      const shouldBeRunning = this.ctx.queuesRegistry.shouldStart(this.queue);

      // start a non running worker
      if (shouldBeRunning && !this.isRunning) {
        ctx.logger.info(`[FetchQ] start worker ${this.name} on queue ${this.queue}`);
        this.start()
      }

      // stop a running worker
      if (!shouldBeRunning && this.isRunning && !this.isStopping) {
        ctx.logger.info(`[FetchQ] stop worker ${this.name} on queue ${this.queue}`);
        try {
          await this.stop();
          ctx.logger.info(`[FetchQ] stoped worker ${this.name} on queue ${this.queue}`);
        } catch (err) {
          const error = new Error(`[FetchQ] failed to stop worker ${this.name} on queue ${this.queue}: ${err.message}`);
          error.originalError = error;
          ctx.logger.error(error);
        }
      }
    });
  }

  start() {
    // check with the registry whether the worker should start
    this.isRunning = this.ctx.queuesRegistry.shouldStart(this.queue)
    if (!this.isRunning) {
      return
    }

    this.isStopping = false
    this.hasStopped = false

    // subscribe to the updates into the queue for real time management
    if (this.ctx.emitter) {
      this.ctx.emitter.addChannel(`fetchq__${this.queue}__pnd`, () => {
        if (this.timer !== null) {
          clearTimeout(this.timer)
          this.loop()
        }
      })
    }

    this.loop()
  }

  stop() {
    this.isRunning = false
    this.isStopping = false
    this.hasStopped = false

    // clear out emitter channel
    if (this.ctx.emitter) {
      this.ctx.emitter.removeChannel(`fetchq__${this.queue}__pnd`)
    }

    // clear out the current timer
    if (this.timer === null) {
      this.hasStopped = true
      return Promise.resolve()
    }

    return new Promise((resolve) => {
      const checkStopInterval = setInterval(() => {
        if (this.hasStopped) {
          clearInterval(checkStopInterval)
          resolve()
        }
      }, 500)
    })
  }

  async loop() {
    // clear out the timeout
    clearTimeout(this.timer)
    this.timer = null

    // check for termination signal
    if (!this.isRunning) {
      this.hasStopped = true
      return
    }

    // basic delay, might be extended if no documents were found
    let delay = this.loopDelay

    // iterate through the jobs bunch
    try {
      const res = await this.job()
      if (res === false) {
        this.ctx.logger.verbose(`no docs, wait ${this.sleep}`)
        delay = this.sleep
      }
    } catch (err) {
      this.ctx.logger.error(`[fetchq worker] ${err.message}`)
    } finally {
      this.timer = setTimeout(() => this.loop(), delay)
    }
  }

  async job() {
    this.ctx.logger.verbose(`[PICK] ${this.id} pick ${this.batch} documents`)
    const docs = await this.ctx.doc.pick(this.queue, this.version, this.batch, this.lock)

    if (!docs.length) {
      return false
    }

    this.ctx.logger.verbose(`job worker ${this.id}`)
    return await this.runBatch(docs)
  }

  async runBatch(docs) {
    const context = {
      worker: this,
      client: this.ctx,
      ctx: this.ctx, // @deprecated from v2.1.0
    };

    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];

      // Decorates the document's object with utility methods that aim at simplifying
      // the life of the developer!
      const docObject = {
        // document's properties
        queue: this.queue,
        ...doc,
        // document's methods
        ...documentActions,
        logError: (...args) => this.ctx.queue.logError(this.queue, doc.subject, ...args),
        forward: (queue, payload = {}) => this.ctx.doc.push(queue, { ...doc, payload: {
          ...doc.payload,
          ...payload,
        }}),
      };

      // Adds some Workflow APIs
      const workflow = {
        // strips the document's payload off the workflow reference
        getPayload: () => this.ctx.getWorkflowPayload(docObject),
        resolve: message => this.ctx.resolveWorkflow(docObject, message),
        reject: (error, options = {}) => this.ctx.rejectWorkflow(docObject, error, options),
        forward: (queue, options = {}) => this.ctx.forwardWorkflow(docObject, queue, options),
        create: (...args) => this.ctx.createWorkflow(...args),
      };

      const ctxObject = {
        ...context,
        workflow,
      };

      try {
        // the document we send to the handler is an enriched version of
        // the sheer data, it has a reference to the queue, plus utility
        // methods that makes it easier to handle ir
        const res = await this.handler(docObject, ctxObject);

        await this.resolve(doc, res)
      } catch (err) {
        try {
          await this.ctx.doc.reject(
            this.queue,
            doc.subject,
            'worker exception', {
            message: err.message,
            err: JSON.stringify(err),
          },
            '*'
          )
        } catch (err) {
          this.ctx.logger.error(`[fetchq] planned worker ${this.name}: ${err.message}`)
          this.ctx.logger.debug(err)
        }
      } finally {
        if (i < (docs.length - 1)) {
          await pause(this.batchDelay)
        }
      }
    }
  }

  async logResponseMessage(doc, res) {
    if (!res.message) {
      return;
    }

    try {
      await this.ctx.queue.logError(this.queue, doc.subject, res.message, res.details, res.refId);
    } catch (err) {
      this.ctx.logger.error(err);
    }
  }

  async resolve(doc, res) {
    switch (res.action) {
      case 'reschedule':
        await this.logResponseMessage(doc, res);
        await this.ctx.doc.reschedule(
          this.queue,
          doc.subject,
          res.nextIteration,
          res.payload || doc.payload,
        )
        break
      case 'reject':
        await this.ctx.doc.reject(
          this.queue,
          doc.subject,
          res.message,
          res.details,
          res.refId
        )
        break
      case 'kill':
        await this.logResponseMessage(doc, res);
        await this.ctx.doc.kill(
          this.queue,
          doc.subject,
          res.payload || doc.payload,
        )
        break
      case 'complete':
        await this.logResponseMessage(doc, res);
        await this.ctx.doc.complete(
          this.queue,
          doc.subject,
          res.payload || doc.payload,
        )
        break
      case 'drop':
        await this.logResponseMessage(doc, res);
        await this.ctx.doc.drop(
          this.queue,
          doc.subject
        )
        break
      default:
        throw new Error(`unrecognised action: "${res.action}"`)
    }
  }
}

module.exports = {
  PlannedWorker,
}
