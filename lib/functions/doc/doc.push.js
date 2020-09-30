const { computeNextIteration } = require('../../utils/compute-next-iteration');
const { pause } = require('../../utils/pause');

// @TODO: validate queue name
// @TODO: validate queue subject
// @TODO: validate queue version
// @TODO: validate queue priority
// @TODO: validate queue nextIteration
// @TODO: validate queue payload
const createDocPush = (ctx) => async (queue, doc = {}, options = {}) => {
  try {
    const q = [
      'SELECT * FROM fetchq.doc_push(',
      `'${queue}',`,
      `'${doc.subject}',`,
      `${doc.version || 0},`,
      `${doc.priority || 0},`,
      `${computeNextIteration(doc.nextIteration)},`,
      `'${JSON.stringify(doc.payload || {}).replace(/'/g, "''''")}'`,
      ')',
    ].join(' ');

    // just await for a local amount of time
    if (options.delay !== undefined) {
      await pause(options.delay);
    }

    // console.log(q)
    const res = await ctx.pool.query(q);
    return res.rows[0];
  } catch (err) {
    ctx.logger.debug(err);
    throw new Error(`[fetchq] doc.push() - ${err.message}`);
  }
};

module.exports = {
  createDocPush,
};
