
class Maintenance {
    constructor (ctx, settings = {}) {
        this.ctx = ctx
        this.settings = settings
        this.limit = this.settings.limit || 1
        this.delay = this.settings.delay || 250
        this.sleep = this.settings.sleep || 5000

        this.isRunning = false
        this.isStopping = false
        this.hasStopped = false
        this.timer = null
    }

    start () {
        this.isRunning = true
        this.isStopping = false
        this.hasStopped = false

        // subscribe to the updates into the queue for real time management
        if (this.ctx.emitter) {
            this.ctx.emitter.addChannel('fetchq_queue_create', () => {
                if (this.timer !== null) {
                    clearTimeout(this.timer)
                    this.loop()
                }
            })
        }

        this.loop()
    }

    stop () {
        this.isRunning = false
        this.isStopping = false
        this.hasStopped = false

        // clear out emitter channel
        if (this.ctx.emitter) {
            this.ctx.emitter.removeChannel('fetchq_queue_create')
        }

        return new Promise((resolve) => {
            if (this.timer === null) {
                this.hasStopped = true
                return resolve()
            }

            const checkStopInterval = setInterval(() => {
                if (this.hasStopped) {
                    clearInterval(checkStopInterval)
                    resolve()
                }
            }, 500)
        })
    }

    async loop () {
        // clear out the timeout
        clearTimeout(this.timer)
        this.timer = null
        
        // check for termination signal
        if (!this.isRunning) {
            this.hasStopped = true
            return
        }

        // do the job
        let delay = this.delay
        try {
            this.ctx.logger.debug(`[fetchq] maintenance run ${this.limit}`)
            const res = await this.ctx.pool.query(`select * from fetchq_mnt_job_run(${this.limit});`)
            if (res.rows[0].processed < this.limit) {
                delay = await this.getSleepTime()
                this.ctx.logger.verbose(`[fetchq] maintenance job has completed ${res.rows[0].processed}/${this.limit} therefore is sleeping for ${delay}ms`)

            } else {
                this.ctx.logger.debug(`[fetchq] run maintenance job - ${res.rows[0].processed} processed`)
            }
        } catch (err) {
            this.ctx.logger.error(`[fetchq daemon] ${err.message}`)
            delay = this.sleep
        } finally {
            this.timer = setTimeout(() => this.loop(), delay)
        }
    }

    async getSleepTime () {
        const res = await this.ctx.pool.query(`
            SELECT
                next_iteration, 
                CEIL(EXTRACT('epoch' FROM (next_iteration::TIMESTAMP - NOW()::TIMESTAMP)) * 1000) AS delay
            FROM fetchq_catalog.fetchq_sys_jobs
            WHERE next_iteration > NOW()
            ORDER BY next_iteration ASC
            LIMIT 1;
        `)

        if (res.rows.length && res.rows[0].delay > this.sleep) {
            return res.rows[0].delay
        }

        return this.sleep
    }
}

module.exports = {
     Maintenance,
}
