const promiseRetry = require('promise-retry');

const createConnect = (ctx) => async () => {
  const connect = async (attemptNumber) => {
    ctx.logger.verbose(`[connect] attempt to connect n: ${attemptNumber}`);
    const res = await ctx.pool.query('SELECT NOW()');
    ctx.logger.verbose(`[connect] now is: ${res.rows[0].now}`);
  };

  try {
    const retryFn = (retry, number) =>
      connect(number).catch((err) => {
        ctx.logger.verbose(`[connect] ${err.message}`);
        return retry(err);
      });
    await promiseRetry(retryFn, ctx.settings.connectionRetry);
  } catch (err) {
    if (ctx.settings.onConnectError) {
      ctx.settings.onConnectError(err, ctx);
    } else {
      ctx.logger.error(`[connect] ${err.message}`);
      ctx.logger.debug(err);
    }
    throw err;
  }
};

module.exports = {
  createConnect,
};
