const fetchq = require('../../../index');
const resetDatabase = global.resetFetchq(fetchq);

const queue1 = {
  name: 'q1',
};

const doc1 = {
  subject: 'doc1',
  payload: { foo: 123 },
};

describe('doc.reschedule()', () => {
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

  test('It should reschedule a document right away', async () => {
    const r1 = await client.doc.append(queue1.name, {});
    expect(typeof r1.subject).toBe('string');

    const r2 = await client.doc.pick(queue1.name)
    expect(r2.length).toBe(1)

    const r3 = await client.doc.reschedule(queue1.name, r2[0].subject)
    expect(r3).toMatchObject({ affected_rows: 1 });

    const r4 = await client.pool.query(`SELECT * FROM "fetchq_data"."${queue1.name}__docs" WHERE "subject" = '${r2[0].subject}'`)
    expect(Number(r4.rows[0].status)).toBe(1)
    expect(Number(r4.rows[0].iterations)).toBe(1)
    expect(Number(r4.rows[0].attempts)).toBe(0)
  });

  test('It should reschedule a document in the past', async () => {
    const r1 = await client.doc.append(queue1.name, {});
    expect(typeof r1.subject).toBe('string');

    const r2 = await client.doc.pick(queue1.name)
    expect(r2.length).toBe(1)

    const r3 = await client.doc.reschedule(queue1.name, r2[0].subject, '-1y')
    expect(r3).toMatchObject({ affected_rows: 1 });

    const r4 = await client.pool.query(`SELECT * FROM "fetchq_data"."${queue1.name}__docs" WHERE "subject" = '${r2[0].subject}' AND "next_iteration" < NOW() - INTERVAL '364d'`)
    expect(Number(r4.rows[0].status)).toBe(1)
    expect(Number(r4.rows[0].iterations)).toBe(1)
    expect(Number(r4.rows[0].attempts)).toBe(0)
  });

  test('It should reschedule a document in the future', async () => {
    const r1 = await client.doc.append(queue1.name, {});
    expect(typeof r1.subject).toBe('string');

    const r2 = await client.doc.pick(queue1.name)
    expect(r2.length).toBe(1)

    const r3 = await client.doc.reschedule(queue1.name, r2[0].subject, '+1y')
    expect(r3).toMatchObject({ affected_rows: 1 });

    const r4 = await client.pool.query(`SELECT * FROM "fetchq_data"."${queue1.name}__docs" WHERE "subject" = '${r2[0].subject}' AND "next_iteration" > NOW() + INTERVAL '364d'`)
    expect(Number(r4.rows[0].status)).toBe(0)
    expect(Number(r4.rows[0].iterations)).toBe(1)
    expect(Number(r4.rows[0].attempts)).toBe(0)
  });

});
