/**
 * Tailwind (NativeWind v4) config for the buyer app.
 * Semantic colours read CSS variables set by ThemeRoot (light/dark), so one class like
 * `bg-surface` works in both modes. Brand colours are fixed.
 */
const { brand, light, cssVarName } = require('./src/theme/palette');

/** Map every semantic palette key to `rgb(var(--color-x) / <alpha-value>)`. */
const semanticColors = Object.fromEntries(
  Object.keys(light).map((key) => {
    const className = key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
    return [className, `rgb(var(${cssVarName(key)}) / <alpha-value>)`];
  }),
);

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        ...semanticColors,
        primary: brand.primary,
        saffron: brand.saffron,
        coral: brand.coral,
        violet: brand.violet,
      },
      // Native needs the exact loaded font name per weight (see src/theme/fonts.ts)
      fontFamily: {
        regular: ['PlusJakartaSans_400Regular'],
        medium: ['PlusJakartaSans_500Medium'],
        semibold: ['PlusJakartaSans_600SemiBold'],
        bold: ['PlusJakartaSans_700Bold'],
        extrabold: ['PlusJakartaSans_800ExtraBold'],
        'deva-regular': ['NotoSansDevanagari_400Regular'],
        'deva-medium': ['NotoSansDevanagari_500Medium'],
        'deva-semibold': ['NotoSansDevanagari_600SemiBold'],
        'deva-bold': ['NotoSansDevanagari_700Bold'],
        'deva-extrabold': ['NotoSansDevanagari_800ExtraBold'],
        mono: ['JetBrainsMono_500Medium'],
        'mono-bold': ['JetBrainsMono_700Bold'],
      },
      // Shape: 20 px cards, 14 px buttons, pill chips
      borderRadius: {
        card: '20px',
        button: '14px',
      },
    },
  },
  plugins: [],
};
