const { Client } = require('pg');
const env = require('./jest.env')();

const connectionString = env.PGSTRING;

const pause = (delay = 0) => new Promise((r) => setTimeout(r, delay));

const resetFetchq = (fq, config = {}) => async () => {
  const client = new Client({
    connectionString,
  });
  try {
    await client.connect();
    await client.query('DROP SCHEMA IF EXISTS fetchq CASCADE;');
    await client.query('DROP SCHEMA IF EXISTS fetchq_data CASCADE;');
    await client.end();
  } catch (err) {
    await client.end();
    throw err;
  }
};

const makeClient = (fq, config = {}) =>
  fq({
    connectionString,
    // skipUpsertQueues: true,
    // skipUpsertFetchq: true,
    pool: { max: 1 },
    ...config,
  });

const config = {
  __dangerouslyAwaitWithoutReason: 250,
  logLevel: 'error',
  pool: {
    max: 1,
    connectionTimeoutMillis: 1000,
    idleTimeoutMillis: 1000,
  },
};

const getError = async (fn) => {
  try {
    await fn();
    return null;
  } catch (err) {
    return err;
  }
};

module.exports = () => ({
  env,
  config,
  pause,
  resetFetchq,
  makeClient,
  getError,
});
