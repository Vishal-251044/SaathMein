/**
 * AppText — the only text component in the app.
 * Applies the type scale and picks Plus Jakarta Sans or Noto Sans Devanagari based on
 * the UI language, so Hindi and Marathi render with the right font and line height.
 */
import { useTranslation } from 'react-i18next';
import { Text, type TextProps } from 'react-native';

import { fontClassFor, type FontWeight } from '@/theme/fonts';
import { cx } from '@/utils/genericFunctions';

export type TextVariant =
  'display' | 'title' | 'heading' | 'body' | 'bodyStrong' | 'caption' | 'label';

export type TextColor =
  'ink' | 'muted' | 'white' | 'whiteSoft' | 'primary' | 'ai' | 'savings' | 'danger';

/** One colour class per tone (only one colour class may ever be applied). */
const COLORS: Record<TextColor, string> = {
  ink: 'text-ink',
  muted: 'text-muted',
  white: 'text-white',
  whiteSoft: 'text-white/90',
  primary: 'text-primary',
  ai: 'text-ai',
  savings: 'text-savings',
  danger: 'text-danger',
};

interface VariantStyle {
  /** Font size class. */
  base: string;
  /** Default colour. */
  color: TextColor;
  /** Line height for Latin text. */
  latinLeading: string;
  /** Taller line height so Devanagari matras are never clipped. */
  devaLeading: string;
  weight: FontWeight;
}

const VARIANTS: Record<TextVariant, VariantStyle> = {
  display: {
    base: 'text-[32px]',
    color: 'ink',
    latinLeading: 'leading-[38px]',
    devaLeading: 'leading-[48px]',
    weight: 'extrabold',
  },
  title: {
    base: 'text-[24px]',
    color: 'ink',
    latinLeading: 'leading-[30px]',
    devaLeading: 'leading-[38px]',
    weight: 'extrabold',
  },
  heading: {
    base: 'text-[18px]',
    color: 'ink',
    latinLeading: 'leading-[24px]',
    devaLeading: 'leading-[30px]',
    weight: 'bold',
  },
  body: {
    base: 'text-[15px]',
    color: 'ink',
    latinLeading: 'leading-[22px]',
    devaLeading: 'leading-[26px]',
    weight: 'regular',
  },
  bodyStrong: {
    base: 'text-[15px]',
    color: 'ink',
    latinLeading: 'leading-[22px]',
    devaLeading: 'leading-[26px]',
    weight: 'semibold',
  },
  caption: {
    base: 'text-[13px]',
    color: 'muted',
    latinLeading: 'leading-[18px]',
    devaLeading: 'leading-[22px]',
    weight: 'medium',
  },
  label: {
    base: 'text-[12px]',
    color: 'muted',
    latinLeading: 'leading-[16px]',
    devaLeading: 'leading-[20px]',
    weight: 'semibold',
  },
};

const DEVANAGARI_LANGUAGES = new Set(['hi', 'mr']);

interface AppTextProps extends TextProps {
  variant?: TextVariant;
  /** Override the variant's default weight. */
  weight?: FontWeight;
  /** Use JetBrains Mono (deal codes, ticket prices, technical values). */
  mono?: boolean;
  /** Override the variant's default colour. */
  color?: TextColor;
  /** Layout classes only (margin, alignment) — never font or colour classes. */
  className?: string;
}

/**
 * @param props.variant - Type scale step (default "body")
 * @param props.weight - Optional weight override
 * @param props.mono - Render in the monospace font
 * @param props.color - Text colour tone
 * @param props.className - Layout classes (margin, alignment)
 */
export function AppText({
  variant = 'body',
  weight,
  mono = false,
  color,
  className,
  ...rest
}: AppTextProps) {
  const { i18n } = useTranslation();
  const style = VARIANTS[variant];
  const isDevanagari = DEVANAGARI_LANGUAGES.has(i18n.language);
  const resolvedWeight = weight ?? style.weight;
  // Only one font-family class may be applied; NativeWind does not resolve conflicts by order
  const fontClass = mono
    ? resolvedWeight === 'bold' || resolvedWeight === 'extrabold'
      ? 'font-mono-bold'
      : 'font-mono'
    : fontClassFor(resolvedWeight, i18n.language);

  return (
    <Text
      maxFontSizeMultiplier={1.4} // respect large-text settings without breaking layouts
      className={cx(
        fontClass,
        style.base,
        COLORS[color ?? style.color],
        isDevanagari && !mono ? style.devaLeading : style.latinLeading,
        className,
      )}
      {...rest}
    />
  );
}
