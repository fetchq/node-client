const fs = require('fs');
const path = require('path');
const promiseRetry = require('promise-retry');
const pkg = require('../../package.json');

/**
 * Figures out whether there is the need for initializing Fetchq,
 * and provides the initialization transaction.
 */
const initializeFetchq = async (ctx) => {
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

    ctx.logger.info(
      `[init] Create Fetchq data structure on a new PostgreSQL database.`,
    );
    return ctx.pool.query(
      [
        'BEGIN;',
        await sql,
        'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";',
        'SELECT * FROM fetchq_init();',
        'COMMIT;',
      ].join('\n'),
    );
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
  ctx.logger.info(`[init] Upsert queue "${queue.name}"`);

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
  // Initialization logiw within a retry block
  const init = async (attemptNumber) => {
    ctx.logger.verbose(`[init] initialization attempt n: ${attemptNumber}`);

    // Creates the initialization transaction
    await initializeFetchq(ctx);

    // Init all queues
    await Promise.all(ctx.settings.queues.map(($) => initQueue(ctx)($)));
  };

  // Initialization with retry
  try {
    const retryFn = (retry, number) =>
      init(number).catch((err) => {
        ctx.logger.verbose(`[init error] ${err.message}`);
        return retry(err);
      });
    await promiseRetry(retryFn, ctx.settings.initializationRetry);
  } catch (err) {
    ctx.logger.error(`[init] ${err.message}`);
    ctx.logger.debug(err);
    throw err;
  }
};

module.exports = {
  createInit,
};
