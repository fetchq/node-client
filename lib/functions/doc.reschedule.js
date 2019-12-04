const { computeNextIteration } = require('../utils/compute-next-iteration')

const createDocReschedule = (ctx) => async (queue = null, subject, nextIteration = null, payload = null) => {
  try {
    const q = [
      'SELECT * FROM fetchq_doc_reschedule(',
      `'${queue}',`,
      `'${subject}',`,
      computeNextIteration(nextIteration),
      payload === null ? '' : `, '${JSON.stringify(payload || {}).replace(/'/g, '\'\'\'\'')}'`,
      ')',
    ].join(' ')
    // console.log(q)
    const res = await ctx.pool.query(q)
    return res.rows[0]
  } catch (err) {
    ctx.logger.debug(err)
    throw new Error(`[fetchq] doc.reschedule() - ${err.message}`)
  }
}

module.exports = {
  createDocReschedule,
}
