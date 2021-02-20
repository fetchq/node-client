const envalid = require('envalid');

// const PGSTRING = 'postgresql://gitpod:gitpod@localhost:5432/postgres';
const PGSTRING = 'postgresql://postgres:postgres@localhost:5432/postgres';

module.exports = () => {
  const env = envalid.cleanEnv(process.env, {
    PGSTRING: envalid.url({
      default: PGSTRING,
    }),
  });

  return { ...env };
};
