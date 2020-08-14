const fetchq = require('../index');

describe('fetchq class', () => {
  beforeEach(global.resetFetchq(fetchq));

  it('should stop/start', async () => {
    const workerHandler = jest.fn(doc => doc.complete());
    const client = await global.makeClient(fetchq, {
      queues: [
        {
          name: 'foo',
          enableNotifications: true,
          workerHandler,
        },
      ],
    });

    // Stop the client and queue a document to test the restart
    await client.stop();
    const r1 = await client.doc.append('foo', 'a1');

    // Restart the client to get the document processed
    await client.start();
    await client.utils.checkStatus('foo', r1.subject);

    // Client cleanup
    await client.end();

    expect(workerHandler.mock.calls.length).toBe(1);
    expect(workerHandler.mock.calls[0][0].queue).toBe('foo');
    expect(workerHandler.mock.calls[0][0].subject).toBe(r1.subject);
  });
});
