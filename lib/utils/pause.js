const pause = (duration = 0) =>
  new Promise(resolve => setTimeout(resolve, duration));

module.exports = {
  pause,
};
