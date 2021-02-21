const { validateQueueName } = require('./validate-queue-name');

describe('validateQueueName', () => {
  test('It should accept alphabetical input', () => {
    const result = validateQueueName('aaa');
    expect(result).toBe(true);
  });

  test('It should reject empty name', () => {
    const result = validateQueueName('');
    expect(result).toBe(false);
  });

  test('It should reject hypens', () => {
    const result = validateQueueName('aaa-bb');
    expect(result).toBe(false);
  });

  test('It should reject if it starts with numbers', () => {
    const result = validateQueueName('1a');
    expect(result).toBe(false);
  });
});
