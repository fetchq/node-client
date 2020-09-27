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
  console.log('RESET await stop');
  await ctx.stop();
  console.log('RESET await stop done');
  const query = ctx.pool.query.bind(ctx.pool);

  // remove all the existing queues
  console.log('get tables');
  const queues = await query('SELECT * FROM fetchq_catalog.fetchq_sys_queues');
  console.log('get tables done');
  await Promise.all(
    queues.rows
      .map((q) => `SELECT * FROM public.fetchq_queue_drop('${q.name}')`)
      .map((q) => query(q)),
  );

  // reset sys stuff
  await Promise.all(
    [
      'UPDATE fetchq_catalog.fetchq_sys_jobs SET attempts=0, iterations=0, next_iteration=now(), last_iteration=null',
      'TRUNCATE fetchq_catalog.fetchq_sys_metrics',
      'TRUNCATE fetchq_catalog.fetchq_sys_metrics_writes',
    ].map((q) => query(q)),
  );

  // re-initialize the client
  await ctx.boot();
};

module.exports = {
  createReset,
};
