
const setMaintenanceSettings = ctx => task => (name, settings) => {
  const data = JSON.stringify(settings).replace(/'/g, '\'\'\'\'');
  return ctx.pool.query([
    `UPDATE fetchq_catalog.fetchq_sys_jobs SET settings = '${data}'`,
    `WHERE queue = '${name}' AND task = '${task}';`,
  ].join(' '));
};

const initQueue = (ctx) => async (queue) => {
  // Initialize the queue and apply general settings
  await ctx.queue.create(queue.name);
  await ctx.queue.enableNotifications(queue.name, queue.enableNotifications);
  await ctx.queue.setMaxAttempts(queue.name, queue.maxAttempts);
  await ctx.queue.setErrorsRetention(queue.name, queue.errorsRetention);
  await ctx.queue.setCurrentVersion(queue.name, queue.currentVersion);

  if (typeof queue.isActive === 'boolean') {
    const q = [
      `UPDATE fetchq_catalog.fetchq_sys_queues`,
      `SET is_active = ${queue.isActive}`,
      `WHERE name = '${queue.name}'`,
    ].join(' ');
    await ctx.pool.query(q)
  }

  // Apply maintenance rules
  if (queue.maintenance) {
    const p = Object.keys(queue.maintenance).map((taskName) => {
      const taskDefinition = queue.maintenance[taskName];
      return setMaintenanceSettings(ctx)(taskName)(queue.name, taskDefinition)
    })
    await Promise.all(p);
  }
}

const createInit = (ctx) => async () => {
  try {
    await ctx.pool.query('CREATE EXTENSION IF NOT EXISTS "fetchq";')
    await ctx.pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";')
    const initResult = await ctx.pool.query('SELECT * FROM fetchq_init()')

    const queues = ctx.settings.queues || [];
    await Promise.all(queues.map($ => initQueue(ctx)($)))

    return initResult.rows[0]
  } catch (err) {
    ctx.logger.debug(err)
    throw new Error(`[fetchq] init() - ${err.message}`)
  }
}

module.exports = {
  createInit,
}
