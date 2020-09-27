const fetchq = require('../index');

describe('fetchq class', () => {
  beforeEach(global.resetFetchq(fetchq));

  it('should stop/start', async () => {
    const workerHandler = jest.fn(async (doc) => doc.complete());
    const client = await global.makeClient(fetchq, {
      ...global.config,
      queues: [{ name: 'foo' }],
    });

    await client.boot();

    // Push a document and verify its status
    const r1 = await client.doc.append('foo', 'a1');
    await client.utils.checkStatus(r1.subject, 'foo', 1, true);

    // Programmatically register a worker that consumes a queue
    client.workers.register({
      queue: 'foo',
      handler: workerHandler,
    });

    await client.utils.awaitStatus(r1.subject, 'foo', 3);

    // Client cleanup
    await client.end();

    expect(workerHandler.mock.calls.length).toBe(1);
    expect(workerHandler.mock.calls[0][0].queue).toBe('foo');
    expect(workerHandler.mock.calls[0][0].subject).toBe(r1.subject);
  });
});
