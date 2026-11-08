/**
 * Chat profanity filter (LIV-5): masks common abusive words in English and in romanised
 * and Devanagari Hindi / Marathi with asterisks. Whole words only, so normal words that
 * contain these letters are left alone. Reports + Support review handle the rest.
 * The list lives here (no extra library); extend it as Support sees new abuse.
 */

// Lower-case, whole words. Kept short on purpose; matching also catches simple repeats.
const WORDS = [
  // English
  'fuck',
  'fucking',
  'fucker',
  'shit',
  'bitch',
  'bastard',
  'asshole',
  'dick',
  'cunt',
  'slut',
  'whore',
  // Hindi / Marathi (romanised)
  'chutiya',
  'chutiye',
  'madarchod',
  'behenchod',
  'bhenchod',
  'bhosdike',
  'bhosadi',
  'gandu',
  'harami',
  'randi',
  'lavda',
  'lauda',
  'lund',
  'zavadya',
  'zhavadya',
  'bhadwa',
  'kutta',
  'kamina',
  // Devanagari
  'चूतिया',
  'मादरचोद',
  'बहनचोद',
  'भोसड़ी',
  'गांडू',
  'हरामी',
  'रंडी',
  'लौड़ा',
  'भड़वा',
  'झवाड्या',
];

const LATIN = WORDS.filter((word) => /^[a-z]+$/.test(word));
const DEVANAGARI = WORDS.filter((word) => !/^[a-z]+$/.test(word));

// Latin: letters may repeat ("fuuuck"); word boundaries on letters only
const latinPattern = new RegExp(
  `(?<![a-z])(${LATIN.map((word) =>
    word
      .split('')
      .map((ch) => `${ch}+`)
      .join(''),
  ).join('|')})(?![a-z])`,
  'giu',
);
// Devanagari: no \b support for these letters, so match between non-letters
const devanagariPattern = new RegExp(
  `(?<![\\p{L}\\p{M}])(${DEVANAGARI.join('|')})(?![\\p{L}\\p{M}])`,
  'gu',
);

/** @param {string} word @returns {string} First letter kept, rest masked */
const mask = (word) => {
  const letters = [...word];
  return letters[0] + '*'.repeat(Math.max(1, letters.length - 1));
};

/**
 * Mask abusive words.
 * @param {string} text - Message text
 * @returns {{ text: string, flagged: boolean }}
 */
const filterProfanity = (text) => {
  if (!text) return { text, flagged: false };
  let flagged = false;
  const replace = (match) => {
    flagged = true;
    return mask(match);
  };
  const cleaned = text.replace(latinPattern, replace).replace(devanagariPattern, replace);
  return { text: cleaned, flagged };
};

module.exports = { filterProfanity };
