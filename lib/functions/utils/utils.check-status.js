/**
 * @function createCheckStatus
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
const createCheckStatus = (ctx) => async (
  subject,
  queues,
  status = 3,
  throwError,
) => {
  if (!subject) throw new Error('FetchQ - must pass a subject to check');
  if (!queues)
    throw new Error('[checkStatus] must pass at least one queue to check');

  // Accepts a single queue or multiple
  const queuesArr = Array.isArray(queues) ? queues : [queues];

  const queries = queuesArr
    .map(
      (name, idx) => `
    d${idx + 1} AS (
      SELECT iterations FROM fetchq_data.${name}__docs
      WHERE subject = $1 AND status = ${status} LIMIT 1
    )`,
    )
    .join(',    ');

  const unions = queuesArr
    .map((name, idx) => `SELECT * FROM d${idx + 1}`)
    .join(' UNION ALL ');

  const qq = `
    WITH ${queries},
      ck AS (${unions})
      SELECT count(*)::integer AS tot FROM ck
    `;

  const conditionalThrows = () => {
    if (throwError) {
      throw new Error(
        `[checkStatus] expected "status=${status}" failed for "${subject}" on queue(s) ${JSON.stringify(
          queues,
        )}`,
      );
    }
  };

  try {
    const ck = await ctx.pool.query(qq, [subject]);
    if (!ck.rows.length || ck.rows[0].tot !== queuesArr.length) {
      conditionalThrows();
      return false;
    }

    return true;
  } catch (err) {
    ctx.logger.verbose(`[checkStatus] ${err.message}`);
    ctx.logger.debug(err);
    conditionalThrows();
    return false;
  }
};

module.exports = {
  createCheckStatus,
};
