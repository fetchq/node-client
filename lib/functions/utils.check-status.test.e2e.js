const fetchq = require('../../index');

describe('utils/check-status', () => {
  beforeEach(global.resetFetchq);

  it('should check on a single queue', async () => {
    const client = await global.makeClient(fetchq, {
      queues: [
        {
          name: 'foo',
          enableNotifications: true,
        },
      ],
    });

    const doc = await client.doc.append('foo', {});
    const res = await client.utils.checkStatus(doc.subject, 'foo', 1);
    expect(res).toBe(true);

    await client.end();
  });

  it('should check on a multiple queues', async () => {
    const client = await global.makeClient(fetchq, {
      queues: [
        {
          name: 'foo',
          enableNotifications: true,
        },
        {
          name: 'faa',
          enableNotifications: true,
        },
      ],
      workers: [
        {
          queue: 'foo',
          handler: async doc => {
            await doc.forward('faa');
            return doc.complete();
          },
        },
        {
          queue: 'faa',
          handler: doc => doc.complete(),
        },
      ],
    });

    const doc = await client.doc.append('foo', {});
    await global.pause(50); // let time to figure out what is happening
    const res = await client.utils.checkStatus(doc.subject, ['foo', 'faa']);
    await client.end();

    expect(res).toBe(true);
  });
});
