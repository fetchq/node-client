const fetchq = require('../../../index');
const resetDatabase = global.resetFetchq(fetchq);

const queue1 = {
  name: 'q1',
};

const doc1 = {
  subject: 'doc1',
  payload: { foo: 123 },
};

describe('doc.pushMany()', () => {
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

  test('It should push many documents at the same time', async () => {
    const r1 = await client.doc.pushMany(queue1.name, {
        docs: [
          ['doc1', 0, {}],
          ['doc2', 0, {}],
          ['doc3', 0, {}],
        ]
    });
    expect(r1).toMatchObject({ queued_docs: 3 });
  });

  test('It should push many documents at a specific point in time', async () => {
    const r1 = await client.doc.pushMany(queue1.name, {
        docs: [
          ['doc1', 0, {}],
          ['doc2', 0, {}],
          ['doc3', 0, {}],
        ],
        nextIteration: '2021-06-03 09:09:00'
    });
    expect(r1).toMatchObject({ queued_docs: 3 });

    const r2 = await client.pool.query(`SELECT * FROM "fetchq_data"."${queue1.name}__docs" WHERE "next_iteration" = '2021-06-03 09:09:00'`)
    expect(r2.rowCount).toBe(3)
  });

  test('It should push many documents in the future', async () => {
    const r1 = await client.doc.pushMany(queue1.name, {
        docs: [
          ['doc1', 0, {}],
          ['doc2', 0, {}],
          ['doc3', 0, {}],
        ],
        nextIteration: '+1y'
    });
    expect(r1).toMatchObject({ queued_docs: 3 });

    const r2 = await client.pool.query(`SELECT * FROM "fetchq_data"."${queue1.name}__docs" WHERE "next_iteration" > NOW() + INTERVAL '364d'`)
    expect(r2.rowCount).toBe(3)
  });

  test('It should push many documents in the past', async () => {
    const r1 = await client.doc.pushMany(queue1.name, {
        docs: [
          ['doc1', 0, {}],
          ['doc2', 0, {}],
          ['doc3', 0, {}],
        ],
        nextIteration: '-1ms'
    });
    expect(r1).toMatchObject({ queued_docs: 3 });

    const r2 = await client.pool.query(`SELECT * FROM "fetchq_data"."${queue1.name}__docs" WHERE "status" = 1`)
    expect(r2.rowCount).toBe(3)
  });

});
