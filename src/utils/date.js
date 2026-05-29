// Local calendar date as YYYY-MM-DD (NOT UTC — avoids the day rolling over
// in the evening when toISOString() would already report tomorrow).
export function localDateStr(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Parse a YYYY-MM-DD string into a Date in local time (not UTC midnight).
export function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}
