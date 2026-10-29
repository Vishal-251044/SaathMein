/**
 * Unit tests for the CSV parser/writer used by product imports.
 */
const { parseCsv, parseCsvWithHeader, toCsv } = require('../../src/utils/csv');

describe('csv utils', () => {
  it('parses quoted fields with commas, escaped quotes and line breaks', () => {
    const text = 'a,b,c\r\n"Honda, Inc.","He said ""hi""","line 1\nline 2"\r\n';
    expect(parseCsv(text)).toEqual([
      ['a', 'b', 'c'],
      ['Honda, Inc.', 'He said "hi"', 'line 1\nline 2'],
    ]);
  });

  it('skips blank lines, handles LF only and an Excel BOM', () => {
    expect(parseCsv('﻿x,y\n\n1,2\n')).toEqual([
      ['x', 'y'],
      ['1', '2'],
    ]);
  });

  it('rejects an unclosed quote', () => {
    expect(() => parseCsv('a,"b\n1,2')).toThrow(/never closed/);
  });

  it('normalises headers and reports spreadsheet row numbers', () => {
    const { headers, records } = parseCsvWithHeader('Category,Ex Showroom\ntwo-wheelers, 78000 \n');
    expect(headers).toEqual(['category', 'ex_showroom']);
    expect(records).toEqual([
      { rowNumber: 2, values: { category: 'two-wheelers', ex_showroom: '78000' } },
    ]);
  });

  it('round-trips values through toCsv', () => {
    const rows = [
      ['name', 'note'],
      ['Activa "6G"', 'a,b'],
    ];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});
