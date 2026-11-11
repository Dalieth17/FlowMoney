// Generación de CSV (RFC 4180) con protección contra "inyección de fórmulas":
// un texto que empieza por = + - @ se abre en Excel como fórmula, así que se
// antepone un apóstrofo. Los números se dejan tal cual.

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value) {
  if (value == null) return '';
  if (typeof value === 'number') return String(value);
  let text = String(value);
  if (FORMULA_START.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * @param {Array<object>} rows
 * @param {Array<{header: string, value: (row: object) => unknown}>} columns
 */
export function toCsv(rows, columns) {
  const lines = [columns.map((c) => csvCell(c.header)).join(',')];
  rows.forEach((row) => lines.push(columns.map((c) => csvCell(c.value(row))).join(',')));
  return lines.join('\r\n');
}
