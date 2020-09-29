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
const createReset = (ctx) => async () => {
  await ctx.stop();
  const query = ctx.pool.query.bind(ctx.pool);

  // remove all the existing queues
  const queues = await query('SELECT * FROM fetchq.queues');
  await Promise.all(
    queues.rows
      .map((q) => `SELECT * FROM fetchq.queue_drop('${q.name}')`)
      .map((q) => query(q)),
  );

  // reset sys stuff
  await Promise.all(
    [
      'UPDATE fetchq.jobs SET attempts=0, iterations=0, next_iteration=now(), last_iteration=null',
      'TRUNCATE fetchq.metrics',
      'TRUNCATE fetchq.metrics_writes',
    ].map((q) => query(q)),
  );

  // re-initialize the client
  await ctx.boot();
};

module.exports = {
  createReset,
};
