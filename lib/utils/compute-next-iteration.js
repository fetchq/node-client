const computeNextIteration = (input) => {
  if (input === null || !input) {
    return 'NOW()';
  }

  // Interval format
  // "+1s", "-1 year"
  const op = input.substr(0, 1);
  if (op === '+' || op === '-') {
    return `NOW() ${op} INTERVAL '${input.substr(1)}'`;
  }

  // ISO String Format
  return input;
};

module.exports = {
  computeNextIteration,
};
