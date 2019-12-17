const { dateToSQL } = require('./date-to-sql')

const computeNextIteration = (input) => {
  // console.log('*****', input, typeof input, input instanceof Date)

  if (input === null || !input) {
    return 'NOW()';
  }

  // Date -> ISO String Format
  if (input instanceof Date) {
    return `${dateToSQL(input)}`;
  }

  // Interval format
  // "+1s", "-1 year"
  const op = input.substr(0, 1);
  if (op === '+' || op === '-') {
    return `NOW() ${op} INTERVAL '${input.substr(1)}'`;
  }

  return input;
};

module.exports = {
  computeNextIteration,
};
