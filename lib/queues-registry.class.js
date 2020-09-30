/**
 * This class is given the task to keep an in-memory representation of
 * the `fetchq_sys_queues` so that workers can pause themselves
 */

class QueuesRegistry {
  constructor(ctx) {
    this.ctx = ctx;
    this.registry = [];
    this.eventHandlers = [];
  }

  async start() {
    await this.fetchSettings();

    // subscribe to any change in the queue registry
    this.ctx.emitter.addChannel(
      'fetchq_on_change',
      async ({ schema, table }) => {
        if (schema === 'fetchq' && table === 'queues') {
          try {
            await this.fetchSettings();
            this.eventHandlers.forEach(($) => $(this.registry));
          } catch (err) {
            this.ctx.logger.error(err);
          }
        }
      },
    );
  }

  async stop() {
    this.ctx.emitter.removeChannel('fetchq_on_change');
    this.registry = [];
    this.eventHandlers = [];
  }

  async fetchSettings() {
    try {
      const res = await this.ctx.pool.query('SELECT * FROM fetchq.queues;');
      this.registry = res.rows;
    } catch (err) {
      const error = new Error(
        `[FetchQ] could not fetch queue registry: ${err.message}`,
      );
      error.originalError = err;
      throw error;
    }
  }

  onChange(handler) {
    this.eventHandlers.push(handler);
  }

  shouldStart(queueName) {
    return this.registry.some(
      (queue) => queue.name === queueName && queue.is_active === true,
    );
  }
}

module.exports = {
  QueuesRegistry,
};
