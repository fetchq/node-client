// @TODO: validate queue name
// @TODO: validate max attempts is an integer
const createSetMaxAttempts = (ctx) => async (name, maxAttempts = 5) => {
  try {
    const q = `SELECT * FROM fetchq.queue_set_max_attempts('${name}', ${maxAttempts})`;
    const res = await ctx.pool.query(q);
    return res.rows[0];
  } catch (err) {
    ctx.logger.debug(err);
    throw new Error(`[fetchq] queue.setMaxAttempts() - ${err.message}`);
  }
};

module.exports = {
  createSetMaxAttempts,
};
