
// @TODO: validate queue name
const createWakeUp = (ctx) => async (name) => {
    try {
        if (!name) {
            throw new Error('queue name was not provided')
        }
        const q = `NOTIFY fetchq__${name}__pnd, 'true';`
        const res = await ctx.pool.query(q)
        return res.rows[0]
    } catch (err) {
        ctx.logger.debug(err)
        throw new Error(`[fetchq] queue.wakeUp() - ${err.message}`)
    }
}

module.exports = {
    createWakeUp,
}
