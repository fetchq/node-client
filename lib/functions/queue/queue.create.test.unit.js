const {
  createQueueCreate,
  FetchqQueueNameValidationError,
} = require('./queue.create');

const {
  FetchqValidationError,
  FetchqPostgresError,
} = require('../../utils/errors');

describe('queue/create', () => {
  let ctx;

  beforeEach(() => {
    ctx = {
      pool: {
        query: async (q) => ({
          rows: [
            {
              q,
            },
          ],
        }),
      },
      logger: {
        debug: jest.fn(),
      },
    };
  });

  test('should validate with strings only', async () => {
    const res = await createQueueCreate(ctx)('foo');
    expect(res).toHaveProperty('q', `SELECT * FROM fetchq_queue_create('foo')`);
  });

  test('should validate with alphanumeric and underscore', async () => {
    const res = await createQueueCreate(ctx)('foo_123');
    expect(res).toHaveProperty(
      'q',
      `SELECT * FROM fetchq_queue_create('foo_123')`,
    );
  });

  test('should reject hypens (-)', async () => {
    let error;
    try {
      await createQueueCreate(ctx)('foo-bar');
    } catch (err) {
      error = err;
    }

    expect(error).toBeInstanceOf(FetchqQueueNameValidationError);
    expect(error).toBeInstanceOf(FetchqValidationError);
    expect(ctx.logger.debug.mock.calls.length).toBe(0);
  });

  test('should reject spaces', async () => {
    let error;
    try {
      await createQueueCreate(ctx)('foo bar');
    } catch (err) {
      error = err;
    }

    expect(error).toBeInstanceOf(FetchqQueueNameValidationError);
    expect(error).toBeInstanceOf(FetchqValidationError);
    expect(ctx.logger.debug.mock.calls.length).toBe(0);
  });

  test('should throw a custom error in case of SQL issues', async () => {
    let error;
    ctx.pool.query = async () => {
      throw new Error('foobar');
    };

    try {
      await createQueueCreate(ctx)('foo');
    } catch (err) {
      error = err;
    }

    expect(error).toBeInstanceOf(FetchqPostgresError);
    expect(error.message).toContain('[queue.create] foobar');
    expect(ctx.logger.debug.mock.calls.length).toBe(1);
  });
});
