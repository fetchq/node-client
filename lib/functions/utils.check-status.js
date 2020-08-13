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
const createCheckStatus = ctx => async (subject, queues, status = 3) => {
  if (!subject) throw new Error('FetchQ - must pass a subject to check');
  if (!queues)
    throw new Error('FetchQ - must pass at least one queue to check');

  const queries = (Array.isArray(queues) ? queues : [queues])
    .map(
      (name, idx) => `
    d${idx + 1} AS (
      SELECT iterations FROM fetchq_catalog.fetchq__${name}__documents
      WHERE subject = $1 AND status = ${status} LIMIT 1
    )`,
    )
    .join(',    ');

  const unions = queues
    .map((name, idx) => `SELECT * FROM d${idx + 1}`)
    .join(' UNION ALL ');

  const qq = `
    WITH ${queries},
      ck AS (${unions})
      SELECT count(*)::integer AS tot FROM ck
    `;

  try {
    const ck = await ctx.pool.query(qq, [subject]);
    if (!ck.rows.length || ck.rows[0].tot !== queues.length) {
      return false;
    }

    return true;
  } catch (err) {
    ctx.logger.verbose(`[fetchq] ${err.message}`);
    ctx.logger.debug(err);
    return false;
  }
};

module.exports = {
  createCheckStatus,
};
