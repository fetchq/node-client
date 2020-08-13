const envalid = require('envalid');

const PGSTRING = 'postgresql://gitpod:gitpod@localhost:5432/postgres';

module.exports = () =>
  envalid.cleanEnv(process.env, {
    PGSTRING: envalid.url({
      default: PGSTRING,
    }),
  });
