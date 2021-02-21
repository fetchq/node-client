const re = /^[a-z0-9_]*$/i;

const validateQueueName = (name = '') => {
  if (!re.test(name)) {
    return false;
  }

  if (!isNaN(name.charAt(0))) {
    return false;
  }

  return true;
};

module.exports = {
  validateQueueName,
};
