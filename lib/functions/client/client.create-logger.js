const levels = {
  INFO: 'info',
  ERROR: 'error',
  VERBOSE: 'verbose',
  DEBUG: 'debug',
  SILLY: 'silly',
};

const levelsNum = [
  levels.ERROR,
  levels.INFO,
  levels.VERBOSE,
  levels.DEBUG,
  levels.SILLY,
];

class ConsoleLogger {
  constructor(settings = {}) {
    const inputLevel = settings.level || levels.ERROR;
    const inputLevelIdx = levelsNum.indexOf(inputLevel);

    this.level = inputLevelIdx >= 0 ? inputLevelIdx : 0;

    if (inputLevelIdx === -1) {
      console.log(
        `[fetchq] Logger: input level "${settings.level}" not recognized, using ERROR.`,
      );
    } else {
      // console.log(
      //   `[fetchq] Logger: using level "${levelsNum[this.level]}"`,
      // );
    }
  }

  log(logType, ...args) {
    const index = levelsNum.indexOf(logType);
    if (index === -1) {
      console.log(
        `[fetchq] Logger: input level "${settings.level}" not recognized`,
      );
      return;
    }
    if (index <= this.level) {
      console.log(`${levelsNum[index]}`, ...args);
    }
  }
  error(...args) {
    this.log(levels.ERROR, ...args);
  }
  info(...args) {
    this.log(levels.INFO, ...args);
  }
  verbose(...args) {
    this.log(levels.VERBOSE, ...args);
  }
  debug(...args) {
    this.log(levels.DEBUG, ...args);
  }
  silly(...args) {
    this.log(levels.SILLY, ...args);
  }
}

const createLogger = (ctx) => (settings = {}) => {
  const logger =
    settings.logger.instance ||
    new ConsoleLogger({
      level: settings.logLevel || process.env.LOG_LEVEL || 'error',
    });

  const prefix = [
    settings.logger.prefix || 'fetchq',
    ctx.name !== ctx.uuid ? ctx.name : ctx.uuid,
  ]
    .filter(($) => $ !== null)
    .join(':');

  const log =
    settings.logger.decorator === false
      ? (level, ...args) => logger[level](...args)
      : settings.logger.decorator ||
        ((level, ...args) => {
          if (args.length && typeof args[0] === 'string') {
            args[0] = `[${prefix}]${args[0]}`;
          }
          logger[level](...args);
        });

  const levelsFn = Object.keys(levels).reduce(
    (acc, key) => ({
      ...acc,
      [levels[key]]: (...args) => log(levels[key], ...args),
    }),
    {},
  );

  return {
    ...levelsFn,
    log,
    levels,
    instance: logger,
  };
};

module.exports = {
  createLogger,
};
