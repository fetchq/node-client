const {
  FetchqValidationError,
  FetchqPostgresError,
} = require('../../utils/errors');

class FetchqQueueNameValidationError extends FetchqValidationError {
  constructor(message) {
    super(message);
    this.property = 'queue.name';
  }
}

const validName = /^[a-zA-Z0-9_]+$/;

// @TODO: validate queue name
const createQueueCreate = (ctx) => async (name) => {
  if (name.search(validName) === -1) {
    throw new FetchqQueueNameValidationError('Invalid queue name');
  }

  try {
    const q = `SELECT * FROM fetchq.queue_create('${name}')`;
    const res = await ctx.pool.query(q);
    return res.rows[0];
  } catch (err) {
    ctx.logger.debug(err);
    throw new FetchqPostgresError(`[queue.create] ${err.message}`);
  }
};

module.exports = {
  createQueueCreate,
  FetchqQueueNameValidationError,
};
