const { pause } = require('../../utils/pause');
const { computeNextIteration } = require('../../utils/compute-next-iteration');

// @TODO: validate queue name
// @TODO: validate queue subject
// @TODO: validate queue version
// @TODO: validate queue priority
// @TODO: validate queue nextIteration
// @TODO: validate queue payload

/*
data.docs = [
    [ subject, version, payload ],
    [ 'a1', 0, { a: 1 } ],
    ...
]
*/
const createDocPushMany = (ctx) => async (queue, data = {}, options = {}) => {
  try {
    const q = [
      'SELECT * FROM fetchq.doc_push(',
      `'${queue}',`,
      `${data.priority || 0},`,
      `${computeNextIteration(data.nextIteration)},`,
      "'(",
      data.docs
        .map((doc) =>
          [
            `''${doc[0]}''`,
            `${doc[1] || 0}`,
            `''${JSON.stringify(doc[2] || {}).replace(/'/g, "''''")}''`,
            '{DATA}',
          ].join(', '),
        )
        .join('), ('),
      ")')",
    ].join(' ');

    // just await for a local amount of time
    if (options.delay !== undefined) {
      await pause(options.delay);
    }

    // console.log(q)
    ctx.logger.debug(1);
    const res = await ctx.pool.query(q);
    return res.rows[0];
  } catch (err) {
    ctx.logger.debug(err);
    throw new Error(`[fetchq] doc.pushMany() - ${err.message}`);
  }
};

module.exports = {
  createDocPushMany,
};
