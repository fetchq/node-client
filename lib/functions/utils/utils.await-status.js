/**
 * @function createAwaitStatus
 * @access public
 *
 * @description
 * Checks that a specific subject has a specific state in one or many queues
 *
 * @param {string} subject - The subject to check against one or more queues
 * @param {[string]} queues - One or more queues to check the message against.
 * @param {integer} status - The desired status that needs to be checked
 * @returns {bool} - The number of appended logs
 */

const promiseRetry = require('promise-retry');

const createAwaitStatus = (ctx) => async (
  subject,
  queues,
  status = 3,
  retryConfig = {},
) => {
  const performCheck = async (number) => {
    ctx.logger.verbose(
      `Awaiting status "${status}" for "${subject}" on queue(s) ${JSON.stringify(
        queues,
      )}, attempt n.${number}`,
    );
    await ctx.utils.checkStatus(subject, queues, status, true);
  };

  try {
    const retryFn = (retry, number) =>
      performCheck(number).catch((err) => {
        ctx.logger.verbose(`[awaitStatus] ${err.message}`);
        return retry(err);
      });

    await promiseRetry(retryFn, {
      retries: 10,
      factor: 1,
      minTimeout: 100,
      maxTimeout: 500,
      ...retryConfig,
    });
  } catch (err) {
    ctx.logger.error(`[awaitStatus] ${err.message}`);
    ctx.logger.debug(err);
    throw err;
  }
};

module.exports = {
  createAwaitStatus,
};
