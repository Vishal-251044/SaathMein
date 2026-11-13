/**
 * Button — the one button component for the app.
 * primary: Sunrise gradient (Join, Pay); secondary: outlined; ghost: text only.
 * Minimum height 48 dp (PRD §14 touch targets).
 */
import { LinearGradient } from 'expo-linear-gradient';
import { type ComponentType } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { PressableScale } from '@/components/animations/PressableScale';
import { AppText } from '@/components/ui/AppText';
import { useThemeColors } from '@/hooks/useThemeColors';
import { brand, gradients, radius } from '@/theme/tokens';
import { cx } from '@/utils/genericFunctions';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  /** Lucide icon component shown before the label. */
  icon?: ComponentType<IconProps>;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  accessibilityHint?: string;
}

/**
 * @param props.label - Button text (already translated)
 * @param props.variant - Visual style (default "primary")
 * @param props.icon - Optional Lucide icon
 * @param props.loading - Shows a spinner and blocks presses
 */
/** Primary button label: 17 px bold with a subtle dark shadow on the gradient. */
const PRIMARY_LABEL_STYLE = {
  fontSize: 17,
  textShadowColor: 'rgba(18, 19, 31, 0.35)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 2,
} as const;

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon: Icon,
  loading = false,
  disabled = false,
  className,
  accessibilityHint,
}: ButtonProps) {
  const { colors } = useThemeColors();
  const isPrimary = variant === 'primary';
  const contentColor = isPrimary ? brand.white : colors.ink;
  const isDisabled = disabled || loading;

  const content = (
    <View className="min-h-12 flex-row items-center justify-center gap-2 px-5">
      {loading ? (
        <ActivityIndicator color={contentColor} />
      ) : (
        <>
          {Icon ? <Icon size={18} color={contentColor} strokeWidth={2.2} /> : null}
          <AppText
            variant="bodyStrong"
            weight="bold"
            color={isPrimary ? 'white' : 'ink'}
            // White on the Sunrise gradient: large bold text + a soft shadow keeps it
            // readable (WCAG large-text contrast, Day 14)
            style={isPrimary ? PRIMARY_LABEL_STYLE : undefined}
          >
            {label}
          </AppText>
        </>
      )}
    </View>
  );

  return (
    <PressableScale
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      className={cx(
        'overflow-hidden rounded-button',
        variant === 'secondary' && 'border border-line bg-surface',
        isDisabled && 'opacity-50',
        className,
      )}
    >
      {isPrimary ? (
        <LinearGradient
          colors={gradients.sunrise}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: radius.button }}
        >
          {content}
        </LinearGradient>
      ) : (
        content
      )}
    </PressableScale>
  );
}
