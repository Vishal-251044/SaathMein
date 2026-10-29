/**
 * Minimal RFC 4180 CSV parser and writer (no dependency needed for imports/exports):
 * quoted fields, escaped quotes (""), commas and line breaks inside quotes, CRLF or LF,
 * and an optional UTF-8 BOM (Excel adds one).
 */

/**
 * Parse CSV text into rows of cells.
 * @param {string} text - CSV content
 * @returns {string[][]} Rows (blank lines are skipped)
 * @throws {Error} When a quoted field is never closed
 */
const parseCsv = (text) => {
  const BYTE_ORDER_MARK = String.fromCharCode(0xfeff); // Excel adds one at the start
  const raw = String(text);
  const input = raw.startsWith(BYTE_ORDER_MARK) ? raw.slice(1) : raw;
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[i + 1] === '\n') i += 1;
      row.push(field);
      if (row.some((cell) => cell.trim() !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (inQuotes) throw new Error('CSV has a quote (") that is never closed');
  row.push(field);
  if (row.some((cell) => cell.trim() !== '')) rows.push(row);
  return rows;
};

/**
 * Parse CSV with a header row into objects keyed by normalised header names
 * ("Ex Showroom" → "ex_showroom").
 * @param {string} text - CSV content
 * @returns {{ headers: string[], records: { rowNumber: number, values: Record<string, string> }[] }}
 *   rowNumber is the line number users see in a spreadsheet (header = 1)
 */
const parseCsvWithHeader = (text) => {
  const [headerRow = [], ...dataRows] = parseCsv(text);
  const headers = headerRow.map((header) =>
    header
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_'),
  );
  const records = dataRows.map((cells, index) => ({
    rowNumber: index + 2,
    values: Object.fromEntries(
      headers.map((header, column) => [header, (cells[column] ?? '').trim()]),
    ),
  }));
  return { headers, records };
};

/**
 * Quote one value for CSV output when needed.
 * @param {*} value - Cell value
 * @returns {string} Safe CSV cell
 */
const toCsvCell = (value) => {
  const text = value == null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/**
 * Build CSV text from rows.
 * @param {Array<Array<*>>} rows - Rows of cells (first row = header)
 * @returns {string} CSV text with CRLF line endings (Excel friendly)
 */
const toCsv = (rows) => `${rows.map((row) => row.map(toCsvCell).join(',')).join('\r\n')}\r\n`;

module.exports = { parseCsv, parseCsvWithHeader, toCsv };
