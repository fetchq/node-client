const { Pool } = require('pg');

const createPool = (ctx) => (settings = {}) => {
  let config = {};

  // 2020-09-25 Deprecate "settings.connect"
  if (settings.connect) {
    ctx.logger.warn(
      `[config] Warning: "settings.connect" is deprecated in favor of "settings.connectionParams" and will be removed in v2.10.x`,
    );
    settings.connectionParams = settings.connect;
    settings.connect = null;
  }

  // generic pool settings
  if (settings.pool) {
    config = {
      ...config,
      ...settings.pool,
    };
  }

  // programmatic connection settings are mutual exclusive
  if (settings.connect) {
    config = {
      ...config,
      ...settings.connect,
    };
  } else if (settings.connectionString) {
    config.connectionString = settings.connectionString;

    // super default values configuration
  } else {
    /* eslint-disable-next-line */
    config.connectionString = process.env.PGSTRING
      ? process.env.PGSTRING
      : `postgresql://${process.env.PGUSER || 'postgres'}:${
          process.env.PGPASSWORD || 'postgres'
        }@${process.env.PGHOST || 'localhost'}:${
          process.env.PGPORT || '5432'
        }/${process.env.PGDATABASE || 'postgres'}`;
  }

  return new Pool(config);
};

module.exports = {
  createPool,
};
