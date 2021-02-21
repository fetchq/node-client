const fetchq = require('../../../index');
const resetDatabase = global.resetFetchq(fetchq);

const queue1 = {
  name: 'q1',
};

const doc1 = { foo: 123 };

describe('doc.append()', () => {
  let client = null;
  beforeEach(resetDatabase);
  afterEach(async () => {
    if (client) {
      await client.end();
      client = null;
    }
  });

  test('It should push a document with a unique subject', async () => {
    client = await global.makeClient(fetchq, {
      queues: [queue1],
    });
    await client.boot();
    const r1 = await client.doc.append(queue1.name, doc1);

    expect(typeof r1.subject).toBe('string');
  });

  test('It should process a document right away', async () => {
    const handler = jest.fn((doc) => doc.complete());
    client = await global.makeClient(fetchq, {
      queues: [queue1],
      workers: [
        {
          queue: queue1.name,
          handler,
        },
      ],
    });
    await client.boot();
    await client.doc.append(queue1.name, doc1);

    await global.pause(50);
    expect(handler.mock.calls.length).toBe(1);
  });

  test('It should NOT append a document if the queue name is not valid', async () => {
    const test = jest.fn();
    client = await global.makeClient(fetchq, {});
    await client.boot();

    try {
      await client.doc.append('a-a');
    } catch (err) {
      test();
    }

    try {
      await client.doc.append('');
    } catch (err) {
      test();
    }

    try {
      await client.doc.append('a b');
    } catch (err) {
      test();
    }

    try {
      await client.doc.append('1a');
    } catch (err) {
      test();
    }

    expect(test.mock.calls.length).toBe(4);
  });
});
