const { Pool } = require('pg');
const env = require('./jest.env')();

const connectionString = env.PGSTRING;

const pause = (delay = 0) => new Promise((r) => setTimeout(r, delay));

const resetFetchq = (fq, config = {}) => async () => {
  const client = await fq({
    connectionString,
    pool: { max: 1 },
    ...config,
  }).boot();

  await client.utils.reset();
  await client.end();
};

const makeClient = (fq, config = {}) =>
  fq({
    connectionString,
    pool: { max: 1 },
    ...config,
  }).boot();

module.exports = () => ({
  env,
  pause,
  resetFetchq,
  makeClient,
});
