const fetchq = require('../../../index');

describe('utils.reset', () => {
  beforeEach(global.resetFetchq(fetchq));

  it('should reset the client', async () => {
    const workerHandler = jest.fn((doc) => doc.complete());
    const config = {
      queues: [
        {
          name: 'foo',
        },
      ],
      workers: [
        {
          queue: 'foo',
          handler: workerHandler,
        },
      ],
    };
    const client = await global.makeClient(fetchq, config).boot();

    // Stop the client and queue a document to test the restart
    const r1 = await client.doc.append('foo', 'a1');
    await client.utils.awaitStatus(r1.subject, 'foo', 3);

    // Restart the client to get the document processed
    await client.utils.reset();
    const r2 = await client.doc.append('foo', 'a1');
    await client.utils.awaitStatus(r2.subject, 'foo', 3);

    // Client cleanup
    await client.end();
    expect(r1.subject).not.toBe(r2.subject);
    expect(workerHandler.mock.calls.length).toBe(2);
    expect(workerHandler.mock.calls[0][0].queue).toBe('foo');
    expect(workerHandler.mock.calls[0][0].subject).toBe(r1.subject);
    expect(workerHandler.mock.calls[1][0].queue).toBe('foo');
    expect(workerHandler.mock.calls[1][0].subject).toBe(r2.subject);
  });
});
