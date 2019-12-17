const dateToSQL = (input) => {
  return `to_timestamp(${input.getTime()} / 1000.0)`;
};

module.exports = {
  dateToSQL,
};
