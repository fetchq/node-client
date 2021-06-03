const isTruthy = value => {
  if (value === true) return true
  if (value === 1) return true
  if (value === 'true') return true
  if (value === '1') return true
  return false
}

module.exports = { isTruthy}