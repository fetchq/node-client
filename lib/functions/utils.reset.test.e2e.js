const fetchq = require('../../index');

describe('utils/reset', () => {
  beforeEach(global.resetFetchq(fetchq));

  it('should reset the client', async () => {
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
    const r1 = await client.doc.append('foo', 'a1');
    await client.utils.checkStatus('foo', r1.subject);

    // Restart the client to get the document processed
    await client.utils.reset();

    const r2 = await client.doc.append('foo', 'a1');
    await client.utils.checkStatus('foo', r2.subject);
    // console.log(r2);

    // Client cleanup
    await client.end();

    expect(r1.subject).not.toBe(r2.subject);

    // expect(workerHandler.mock.calls.length).toBe(1);
    // expect(workerHandler.mock.calls[0][0].queue).toBe('foo');
    // expect(workerHandler.mock.calls[0][0].subject).toBe(r1.subject);
  });
});
