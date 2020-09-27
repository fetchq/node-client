
// @TODO: validate queue name
// @TODO: validate current version is an integer
const createSetCurrentVersion = (ctx) => async (name, currentVersion = 0) => {
  try {
      const q = `SELECT * FROM fetchq_queue_set_current_version('${name}', ${currentVersion})`
      const res = await ctx.pool.query(q)
      return res.rows[0]
  } catch (err) {
      ctx.logger.debug(err)
      throw new Error(`[fetchq] queue.SetCurrentVersion() - ${err.message}`)
  }
}

module.exports = {
  createSetCurrentVersion,
}
