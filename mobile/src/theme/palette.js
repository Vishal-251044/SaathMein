/**
 * SaathMein "Sunrise" colour palette (PRD §14.1) — the single source of truth for colours.
 * Plain CommonJS so both tailwind.config.js and TypeScript (tokens.ts) can import it.
 *
 * Colour meaning is strict: savings (mint) = money saved / refunds / tiers unlocked,
 * ai (violet) = anything Saathi or AI. Never use them for anything else.
 *
 * `*Text` keys are the same meanings, darkened only for WORDS so they pass WCAG AA (4.5:1)
 * on white, the warm band and the soft tints (Day 14, decided 13 Nov 2026). Fills, rings,
 * bars and icons keep the brand colours.
 */

/** Brand colours, identical in light and dark mode. */
const brand = {
  saffron: '#FF8A1F',
  coral: '#FF4D5E',
  violet: '#B43CF5',
  primary: '#FF5A3C', // solid fallback for the Sunrise gradient
  white: '#FFFFFF',
};

/** Gradient stops. */
const gradients = {
  sunrise: ['#FF8A1F', '#FF4D5E', '#B43CF5'],
  saathi: ['#7C5CFF', '#B43CF5'],
};

/** Light mode (default — easy to read outdoors at showrooms). */
const light = {
  bg: '#FFFFFF',
  bgBand: '#F7F5F1',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  ink: '#12131F',
  muted: '#6B7085',
  line: '#E9E6E1',
  savings: '#10B981',
  savingsSoft: '#E7F8F1',
  ai: '#7C5CFF',
  aiSoft: '#F1EDFF',
  warning: '#F59E0B',
  danger: '#EF4444',
  // Text-only shades (AA on light backgrounds)
  primaryText: '#C7341A',
  savingsText: '#047857',
  aiText: '#6D4AE8',
  warningText: '#92400E',
  dangerText: '#B91C1C',
};

/** Dark mode. Soft tints are pre-blended on the dark surface so they stay solid colours. */
const dark = {
  bg: '#12131F',
  bgBand: '#171826',
  surface: '#1C1D2B',
  surfaceRaised: '#24253A',
  ink: '#F4F4F8',
  muted: '#A3A7B8',
  line: '#2C2D42',
  savings: '#34D399',
  savingsSoft: '#1F3338',
  ai: '#9B85FF',
  aiSoft: '#2E2C49',
  warning: '#FBBF24',
  danger: '#F87171',
  // Dark mode: the brand colours already pass AA on the dark surfaces
  primaryText: '#FF7A5F',
  savingsText: '#34D399',
  aiText: '#9B85FF',
  warningText: '#FBBF24',
  dangerText: '#F87171',
};

/**
 * Convert "#RRGGBB" to "R G B" channels, the format Tailwind needs for `<alpha-value>`.
 * @param {string} hex - Colour in #RRGGBB format
 * @returns {string} Space-separated channels, e.g. "255 90 60"
 */
const hexToChannels = (hex) => {
  const value = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16)).join(' ');
};

/**
 * CSS variable name for a semantic colour key, e.g. "bgBand" → "--color-bg-band".
 * @param {string} key - Key of the light/dark palette
 * @returns {string} CSS variable name
 */
const cssVarName = (key) => `--color-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;

module.exports = { brand, gradients, light, dark, hexToChannels, cssVarName };
