const pkg = require('../../../package.json');

const pollVersion = async (ctx) => {
  let version = null;
  while (version === null) {
    try {
      const res = await ctx.pool.query('SELECT * FROM fetchq.info()');

      if (res.rows[0].version !== pkg.fetchq_version) {
        throw new Error('Version mismatch');
      }

      version = res.rows[0].version;
    } catch (err) {
      ctx.logger.error(`[start] ${err.message}`);
    } finally {
      if (version === null) {
        await new Promise((complete) => setTimeout(complete, 1000));
      }
    }
  }

  // return await ctx.pool.query('SELECT * FROM fetchq.init()');
};

const createStart = (ctx) => async () => {
  try {
    ctx.logger.info(`[start] Check extension compatibility`);
    await pollVersion(ctx);

    if (ctx.settings.skipMaintenance === true) {
      ctx.logger.info(`[start] Skip maintenance daemon`);
    } else {
      ctx.logger.info(`[start] Start maintenance daemon`);
      await ctx.mnt.start(ctx.settings.maintenance);
    }

    ctx.logger.info(`[start] Start workers`);
    await ctx.queuesRegistry.start();
    await ctx.workers.start();

    // Let the workers subscribe to the message bus before releasing
    // the starting process.
    // This hack let a cliend do:
    //
    //    fetchq().boot().then(client => cliend.doc.append('q1'))
    //
    // And get it processed right away in case the queue
    // is set so to subscribe to notifications
    //
    // Here we should await for the pub/sub to complete the subscription
    // https://github.com/fetchq/node-client/issues/23
    await new Promise((complete) =>
      setTimeout(complete, ctx.settings.__dangerouslyAwaitWithoutReason),
    );

    if (typeof ctx.settings.onReady === 'function') {
      await ctx.settings.onReady(ctx);
    }

    return ctx;
  } catch (err) {
    if (ctx.settings.onStartError) {
      ctx.settings.onStartError(err, ctx);
    } else {
      ctx.logger.error(`[start] ${err.message}`);
      ctx.logger.debug(err);
    }
    throw err;
  }
};

module.exports = {
  createStart,
};
