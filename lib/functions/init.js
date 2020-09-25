const fs = require('fs');
const path = require('path');
const pkg = require('../../package.json');

/**
 * Initializes the FetchQ extension on the database in case
 * there is no existing extension of set of functions.
 */
const initWithSQL = async (ctx) => {
  try {
    const res = await ctx.pool.query('SELECT * FROM fetchq_info()');
    if (res.rows[0].version !== pkg.fetchq_version)
      throw new Error('Version mismatch');

    return null;
  } catch (err) {
    const sql = await new Promise((resolve, reject) => {
      fs.readFile(path.join(__dirname, 'init.sql'), 'utf-8', (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });

    // Run initialization queries
    ctx.logger.info(`[init] Initialize Fetchq`);
    return await ctx.pool.query(sql);
  }
};

// TODO: apply the task's settings only by EXTENDING the
//       object that is already present in the table.
//       there should be some form of json function to do that
// TODO: check the task's name so to apply some custom defaults
//       like running the `mnt` every 100ms and the `cmp` and
//       `sts` and `drp` every 10m.
// TODO: the maintenance defaults should also be modified in
//       the pg-extension repo!
const setMaintenanceSettings = (ctx) => (task) => (name, settings) => {
  const data = JSON.stringify(settings).replace(/'/g, "''''");
  return ctx.pool.query(
    [
      `UPDATE fetchq_catalog.fetchq_sys_jobs SET settings = '${data}'`,
      `WHERE queue = '${name}' AND task = '${task}';`,
    ].join(' '),
  );
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
    await ctx.pool.query(q);
  }

  // Apply maintenance rules
  if (queue.maintenance) {
    const p = Object.keys(queue.maintenance).map((taskName) => {
      const taskDefinition = queue.maintenance[taskName];
      return setMaintenanceSettings(ctx)(taskName)(queue.name, taskDefinition);
    });
    await Promise.all(p);
  }
};

// The whole initialization happens in a transaction so to avoid racing conditions
// TODO: needs to be tested!
const createInit = (ctx) => async () => {
  await ctx.connect();

  try {
    await ctx.pool.query('BEGIN;');

    // Init Fetchq and needed extensions
    await initWithSQL(ctx);

    ctx.logger.info(`[init] Initialize extensions and data structure`);
    await ctx.pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    await ctx.pool.query('SELECT * FROM fetchq_init()');

    // Init all queues
    ctx.logger.info(`[init] Upsert queue definitions`);
    const queues = ctx.settings.queues || [];
    await Promise.all(queues.map(($) => initQueue(ctx)($)));

    await ctx.pool.query('COMMIT;');
  } catch (err) {
    ctx.logger.debug(err);
    throw new Error(`[init] - ${err.message}`);
  }
};

module.exports = {
  createInit,
};
