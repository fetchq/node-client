class FetchqValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FetchqValidationError';
  }
}

class FetchqPostgresError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FetchqPostgresError';
  }
}

module.exports = {
  FetchqValidationError,
  FetchqPostgresError,
};
