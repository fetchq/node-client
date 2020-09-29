// @TODO: validate queue name
// @TODO: validate max attempts is an integer
const createSetErrorsRetention = (ctx) => async (
  name,
  errorsRetention = '24h',
) => {
  try {
    const q = `SELECT * FROM fetchq.queue_set_logs_retention('${name}', '${errorsRetention}')`;
    const res = await ctx.pool.query(q);
    return res.rows[0];
  } catch (err) {
    ctx.logger.debug(err);
    throw new Error(`[fetchq] queue.setErrorsRetention() - ${err.message}`);
  }
};

module.exports = {
  createSetErrorsRetention,
};
