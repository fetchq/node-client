const PGPubsub = require('@fetchq/pg-pubsub');

const createEmitter = (ctx) => (settings = {}) => {
  let connStr = null;
  if (settings.connectionString) {
    connStr = settings.connectionString;
  } else if (settings.connect) {
    /* eslint-disable-next-line */
    connStr = `postgresql://${settings.connect.user}:${settings.connect.password}@${settings.connect.host}:${settings.connect.port}/${settings.connect.database}`;
  } else {
    /* eslint-disable-next-line */
    connStr = process.env.PGSTRING
      ? process.env.PGSTRING
      : `postgresql://${process.env.PGUSER || 'postgres'}:${
          process.env.PGPASSWORD || 'postgres'
        }@${process.env.PGHOST || 'localhost'}:${
          process.env.PGPORT || '5432'
        }/${process.env.PGDATABASE || 'postgres'}`;
  }

  // throw new Error(`CONNECTION STRINT: ${connStr}`)
  const emitter = new PGPubsub(connStr, {
    log: ctx.logger.verbose.bind(ctx.logger),
  });

  return emitter;
};

module.exports = {
  createEmitter,
};
