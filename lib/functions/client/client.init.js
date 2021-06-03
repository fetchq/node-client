const fs = require('fs');
const path = require('path');
const promiseRetry = require('promise-retry');
const compareVersions = require('compare-versions');
const pkg = require('../../../package.json');

/**
 * Figures out whether there is the need for initializing Fetchq,
 * and provides the initialization transaction.
 */
const initializeFetchq = async (ctx) => {
  try {
    const r1 = await ctx.pool.query('SELECT * FROM fetchq.info()');
    if (r1.rows[0].version !== pkg.fetchq_version) {
      const error = new Error('Version mismatch');
      error.versionMismatch = true;
      error.currentVersion = r1.rows[0].version;
      throw error;
    }

    return ctx.pool.query('SELECT * FROM fetchq.init();');
  } catch (err) {
    // Prevents automatic downgrades!
    if (err.versionMismatch) {
      const versionDiff = compareVersions(
        pkg.fetchq_version,
        err.currentVersion,
      );

      if (versionDiff === -1) {
        throw new Error(
          `Prevents downgrade from v${err.currentVersion} to v${pkg.fetchq_version}`,
        );
      }
    }

    const sql = await new Promise((resolve, reject) => {
      fs.readFile(
        path.join(__dirname, 'client.init.sql'),
        'utf-8',
        (err, data) => {
          if (err) {
            reject(err);
          } else {
            resolve(data);
          }
        },
      );
    });

    ctx.logger.info(
      `[init] Create Fetchq data structure on a new PostgreSQL database.`,
    );

    await ctx.pool.query(
      [
        'BEGIN;',
        await sql,
        'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";',
        'SELECT * FROM fetchq.init();',
        'COMMIT;',
      ].join('\n'),
    );

    if (pkg.fetchq_version === '3.2.0' && err.currentVersion === '3.1.0') {
      ctx.logger.info(`[init] Run schema upgrade from 3.1.0 to 3.2.0`);
      await ctx.pool.query('SELECT * FROM fetchq.upgrade__310__320()');
    }
    
    if (pkg.fetchq_version === '4.0.0' && err.currentVersion === '3.1.0') {
      ctx.logger.info(`[init] Run schema upgrade from 3.1.0 to 3.2.0`);
      await ctx.pool.query('SELECT * FROM fetchq.upgrade__310__320()');
      await ctx.pool.query('SELECT * FROM fetchq.upgrade__320__330()');
      await ctx.pool.query('SELECT * FROM fetchq.upgrade__330__400()');
    }
    
    if (pkg.fetchq_version === '4.0.0' && err.currentVersion === '3.2.0') {
      ctx.logger.info(`[init] Run schema upgrade from 3.1.0 to 3.2.0`);
      await ctx.pool.query('SELECT * FROM fetchq.upgrade__320__330()');
      await ctx.pool.query('SELECT * FROM fetchq.upgrade__330__400()');
    }
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
      `UPDATE fetchq.jobs SET settings = '${data}'`,
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
  await ctx.queue.setLogsRetention(queue.name, queue.logsRetention);
  await ctx.queue.setCurrentVersion(queue.name, queue.currentVersion);

  if (typeof queue.isActive === 'boolean') {
    const q = [
      `UPDATE fetchq.queues`,
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

const createInit = (ctx) => async () => {
  // Initialization logiw within a retry block
  const init = async (attemptNumber) => {
    ctx.logger.verbose(`[init] initialization attempt n: ${attemptNumber}`);
    
    // Creates the initialization transaction
    // (optionally skipped by a configuration flag)
    if (!ctx.settings.skipUpsertFetchq) {
      await initializeFetchq(ctx);
    }

    // Init all queues
    // (optionally skipped by a configuration flag)
    if (!ctx.settings.skipUpsertQueues) {
      await Promise.all(ctx.settings.queues.map(($) => initQueue(ctx)($)));
    }
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
    if (ctx.settings.onInitError) {
      ctx.settings.onInitError(err, ctx);
    } else {
      ctx.logger.error(`[init] ${err.message}`);
      ctx.logger.debug(err);
    }
    throw err;
  }
};

module.exports = {
  createInit,
};
