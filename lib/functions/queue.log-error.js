/**
 * @function createLogError
 * @access public
 *
 * @description
 * Append a log error into the target queue's errors table.
 *
 * @param {string} queue - The target queue name, mandatory
 * @param {string} message - The error message, mandatory
 * @param {Object} options - More details regarding the log
 * @returns {number} - The number of appended logs
 */
const createLogError = (ctx) => async (queue, subject, message, details = {}, refId = null) => {
  if (!queue) throw new Error('FetchQ Logger - must pass "queue" name');
  if (!subject) throw new Error('FetchQ Logger - must pass a "subject"');
  if (!message) throw new Error('FetchQ Logger - must pass a "message"');
  try {
    const detailsP = JSON.stringify(details || {}).replace(/'/g, '\'\'\'\'');
    const query = `select * from fetchq_log_error('${queue}', '${subject}', '${message}', '${detailsP}', '${refId}');`;
    const res = await ctx.pool.query(query);
    return res.rows[0].queued_logs;
  } catch (err) {
    ctx.logger.debug(err)
    throw new Error(`[fetchq] queue.logError() - ${err.message}`)
  }
};

module.exports = {
  createLogError,
};

