const { Pool } = require('pg');

const createPool = (ctx) => (settings = {}) => {
  let config = {};

  // 2020-09-25 Deprecate "settings.connect"
  // 2021-02-18 Dismissed "settings.connect"
  if (settings.connect) {
    throw new Error(`"settings.connect" is not supported, please moveit to "settings.connectionParams"`);
  }

  // generic pool settings
  if (settings.pool) {
    config = {
      ...config,
      ...settings.pool,
    };
  }

  // programmatic connection settings are mutual exclusive
  if (settings.connectionParams) {
    config = {
      ...config,
      ...settings.connectionParams,
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
