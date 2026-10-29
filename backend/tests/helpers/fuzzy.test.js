/**
 * Unit tests for typo-tolerant matching (DIS-2): the Day 4 "Done when" says a user can
 * search "activa" with a typo and still find the product.
 */
const { tokenize, editDistance, matchScore } = require('../../src/helpers/fuzzy');

const activa = tokenize('Honda Activa 6G scooter petrol');
const apache = tokenize('TVS Apache RTR 160 4V motorcycle');

describe('fuzzy matching', () => {
  it('counts edits, including swapped letters as one edit', () => {
    expect(editDistance('activa', 'activa')).toBe(0);
    expect(editDistance('actva', 'activa')).toBe(1);
    expect(editDistance('acitva', 'activa')).toBe(1); // swap
    expect(editDistance('aktiva', 'activa')).toBe(1); // k → c
    expect(editDistance('aktva', 'activa')).toBe(2);
  });

  it.each(['activa', 'Activa', 'actva', 'acitva', 'activ', 'aktiva', 'honda activa'])(
    'finds Honda Activa for "%s"',
    (query) => {
      expect(matchScore(tokenize(query), activa)).toBeGreaterThan(0);
      expect(matchScore(tokenize(query), activa)).toBeGreaterThan(
        matchScore(tokenize(query), apache),
      );
    },
  );

  it('ranks exact matches above typos', () => {
    expect(matchScore(tokenize('activa'), activa)).toBeGreaterThan(
      matchScore(tokenize('actva'), activa),
    );
  });

  it('does not match unrelated or very short wrong words', () => {
    expect(matchScore(tokenize('iphone'), activa)).toBe(0);
    expect(matchScore(tokenize('hnd'), activa)).toBe(0); // 3 letters must match exactly or as prefix
    expect(matchScore(tokenize('activa iphone'), activa)).toBe(0); // every word must match
  });
});
