/**
 * Unit tests for generic helpers.
 */
const {
  getPagination,
  buildPaginationMeta,
  slugify,
  maskPhone,
  firstNameOnly,
  pick,
} = require('../../src/helpers/genericFunctions');

describe('genericFunctions', () => {
  it('normalises pagination and caps the page size', () => {
    expect(getPagination({})).toEqual({ page: 1, limit: 20, skip: 0 });
    expect(getPagination({ page: '3', limit: '10' })).toEqual({ page: 3, limit: 10, skip: 20 });
    expect(getPagination({ page: '-2', limit: '5000' })).toEqual({ page: 1, limit: 100, skip: 0 });
  });

  it('builds pagination meta', () => {
    expect(buildPaginationMeta(45, { page: 2, limit: 20 })).toEqual({
      page: 2,
      limit: 20,
      total: 45,
      totalPages: 3,
      hasNextPage: true,
    });
  });

  it('slugifies product names', () => {
    expect(slugify('Honda Activa 6G')).toBe('honda-activa-6g');
    expect(slugify('  Tata Nexon EV — Max! ')).toBe('tata-nexon-ev-max');
  });

  it('masks phone numbers and shows first names only', () => {
    expect(maskPhone('+919876543210')).toBe('+91******3210');
    expect(firstNameOnly('Rohan Kumar Patil')).toBe('Rohan');
  });

  it('picks only allowed keys', () => {
    expect(pick({ name: 'A', role: 'owner' }, ['name', 'city'])).toEqual({ name: 'A' });
  });
});
