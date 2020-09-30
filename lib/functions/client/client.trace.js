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
const createTrace = (ctx) => async (subject) => {
  if (!subject) throw new Error('FetchQ - must pass a subject to trace');
  try {
    const query = `select * FROM fetchq.trace('${subject}');`;
    // console.log(query)
    const res = await ctx.pool.query(query);
    return res.rows;
  } catch (err) {
    ctx.logger.debug(err);
    throw new Error(`[fetchq] trace() - ${err.message}`);
  }
};

module.exports = {
  createTrace,
};
