const fetchq = require('../../../index');
const resetDatabase = global.resetFetchq(fetchq);

const queue1 = {
  name: 'q1',
};

const doc1 = {
  subject: 'doc1',
  payload: { foo: 123 },
};

describe('doc.push()', () => {
  let client = null;

  beforeEach(async () => {
    await resetDatabase();

    const config = {
      // logLevel: 'verbose',
      queues: [queue1],
    };

    client = await global.makeClient(fetchq, config);
    return client.boot();
  });

  afterEach(() => client.end());

  test('It should push a document with a unique subject', async () => {
    const r1 = await client.doc.push(queue1.name, doc1);
    expect(r1).toMatchObject({ queued_docs: 1 });
  });

  test('It should fail silently if the queue does not exists', async () => {
    const r1 = await client.doc.push('non_existent_queue', doc1);
    expect(r1).toMatchObject({ queued_docs: 0 });
  });

  test('It should NOT duplicate documents', async () => {
    const r1 = await client.doc.push(queue1.name, doc1);
    const r2 = await client.doc.push(queue1.name, doc1);
    expect(r1).toMatchObject({ queued_docs: 1 });
    expect(r2).toMatchObject({ queued_docs: 0 });
  });

  test.skip('It should accept a JSON payload', async () => {
    await client.doc.push(queue1.name, doc1);
    const r1 = client.pool.query(
      `SELECT * FROM fetchq_data.${queue1.name}__docs WHERE subject = '${doc1.subject}'`,
    );
    console.log(r1.rows);
  });

  test('It should NOT push a document if the queue name is not valid', async () => {
    const test = jest.fn();

    try {
      await client.doc.push('a-a');
    } catch (err) {
      test();
    }

    try {
      await client.doc.push('');
    } catch (err) {
      test();
    }

    try {
      await client.doc.push('a b');
    } catch (err) {
      test();
    }

    try {
      await client.doc.push('1a');
    } catch (err) {
      test();
    }

    expect(test.mock.calls.length).toBe(4);
  });
});
