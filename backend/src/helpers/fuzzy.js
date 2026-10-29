/**
 * Typo-tolerant text matching (DIS-2 "search with typo tolerance").
 * Used by the product search fallback when Atlas Search is not available, so "actva",
 * "acitva" and "activ" all still find "Honda Activa".
 */

/**
 * Normalise text for matching: lowercase, remove accents and punctuation.
 * @param {string} text - Input
 * @returns {string[]} Words
 */
const tokenize = (text = '') =>
  String(text)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

/**
 * Edit distance with adjacent swaps (optimal string alignment Damerau–Levenshtein).
 * Stops early once the distance is known to exceed `max`.
 * @param {string} a - First word
 * @param {string} b - Second word
 * @param {number} [max=Infinity] - Give up above this distance
 * @returns {number} Number of edits (insert, delete, substitute, swap)
 */
const editDistance = (a, b, max = Infinity) => {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j += 1) rows[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
      }
      rowMin = Math.min(rowMin, rows[i][j]);
    }
    if (rowMin > max) return max + 1;
  }
  return rows[a.length][b.length];
};

/** Typos allowed for a query word of this length (short words must match closely). */
const allowedEdits = (length) => (length <= 3 ? 0 : length <= 5 ? 1 : 2);

/**
 * How well one query word matches one candidate word (0 = no match, 1 = exact).
 * Prefix matches count as strong matches so results appear while typing.
 * @param {string} query - Query word
 * @param {string} word - Candidate word
 * @returns {number} Score between 0 and 1
 */
const wordScore = (query, word) => {
  if (query === word) return 1;
  if (query.length >= 2 && word.startsWith(query)) return 0.9;
  const max = allowedEdits(query.length);
  if (max === 0) return 0;
  // Compare with the same-length prefix too, so "activ" also matches "activa125"
  const distance = Math.min(
    editDistance(query, word, max),
    editDistance(query, word.slice(0, query.length), max),
  );
  return distance <= max ? 0.8 - distance * 0.15 : 0;
};

/**
 * Score a candidate text against a query: every query word must match some word.
 * @param {string[]} queryWords - Tokenized query
 * @param {string[]} candidateWords - Tokenized candidate (brand, model, tags)
 * @returns {number} Average word score (0 when any query word has no match)
 */
const matchScore = (queryWords, candidateWords) => {
  if (!queryWords.length) return 0;
  let total = 0;
  for (const query of queryWords) {
    const best = candidateWords.reduce((top, word) => Math.max(top, wordScore(query, word)), 0);
    if (best === 0) return 0;
    total += best;
  }
  return total / queryWords.length;
};

module.exports = { tokenize, editDistance, wordScore, matchScore };
