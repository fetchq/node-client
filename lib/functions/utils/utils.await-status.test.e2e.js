const fetchq = require('../../../index');

describe('utils/await-status', () => {
  beforeEach(global.resetFetchq(fetchq));

  it('should check on a single queue', async () => {
    const config = {
      queues: [
        {
          name: 'foo',
        },
      ],
    };

    const client = await global.makeClient(fetchq, config).boot();
    const doc = await client.doc.append('foo', {});
    const error = await global.getError(() =>
      client.utils.checkStatus(doc.subject, 'foo', 1, true),
    );

    await client.end();
    expect(error).toBe(null);
  });

  it('should check on a multiple queues', async () => {
    const config = {
      queues: [
        {
          name: 'foo',
        },
        {
          name: 'faa',
        },
      ],
      workers: [
        {
          queue: 'foo',
          handler: async (doc) => {
            await doc.forward('faa');
            return doc.complete();
          },
        },
        {
          queue: 'faa',
          handler: (doc) => doc.complete(),
        },
      ],
    };

    const client = await global.makeClient(fetchq, config).boot();
    const doc = await client.doc.append('foo', {});
    const error = await global.getError(() =>
      client.utils.awaitStatus(doc.subject, ['foo', 'faa'], 3),
    );

    await client.end();
    expect(error).toBe(null);
  });
});
