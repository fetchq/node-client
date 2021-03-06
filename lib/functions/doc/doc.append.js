const { pause } = require('../../utils/pause');
const { validateQueueName } = require('../../utils/validate-queue-name');

// @TODO: validate queue subject
// @TODO: validate queue version
// @TODO: validate queue priority
// @TODO: validate queue nextIteration
// @TODO: validate queue payload
const createDocAppend = (ctx) => async (queue, doc = {}, options = {}) => {
  try {
    if (!validateQueueName(queue)) {
      throw new Error('Invalid queue name');
    }

    const q = [
      'SELECT * FROM fetchq.doc_append(',
      `'${queue}',`,
      `'${JSON.stringify(doc || {}).replace(/'/g, "''''")}', `,
      `${options.version || 0},`,
      `${options.priority || 0}`,
      ')',
    ].join(' ');
    // console.log(q)

    if (options.delay !== undefined) {
      await pause(options.delay);
    }

    const res = await ctx.pool.query(q);
    return res.rows[0];
  } catch (err) {
    ctx.logger.debug(err);
    throw new Error(`[fetchq] doc.append() - ${err.message}`);
  }
};

module.exports = {
  createDocAppend,
};
