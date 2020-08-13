const { Pool } = require('pg');
const env = require('./jest.env')();

const connectionString = env.PGSTRING;

const pause = (delay = 0) => new Promise(r => setTimeout(r, delay));

const resetFetchq = async () => {
  const pool = new Pool({
    connectionString,
    max: 1,
  });
  await pool.query('drop schema if exists fetchq_catalog cascade;');
  await pool.query('drop schema if exists public cascade;');
  await pool.query('create schema if not exists public;');
  await pool.end();
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
