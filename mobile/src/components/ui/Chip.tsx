/**
 * Chip — selectable pill (multi-select lists, filters). Selected chips use the brand colour.
 * 48 dp minimum height for touch.
 */
import type { ComponentType } from 'react';
import type { ColorValue } from 'react-native';

import { PressableScale } from '@/components/animations/PressableScale';
import { AppText } from '@/components/ui/AppText';
import { useThemeColors } from '@/hooks/useThemeColors';
import { brand } from '@/theme/tokens';
import { cx } from '@/utils/genericFunctions';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: ComponentType<{ size?: number; color?: ColorValue; strokeWidth?: number }>;
  /** checkbox for multi-select, radio for single-select */
  role?: 'checkbox' | 'radio';
  className?: string;
}

/**
 * @param props.label - Text (translated)
 * @param props.selected - Highlighted state
 * @param props.icon - Optional Lucide icon
 */
export function Chip({
  label,
  selected = false,
  onPress,
  icon: Icon,
  role = 'checkbox',
  className,
}: ChipProps) {
  const { colors } = useThemeColors();

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole={role}
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      className={cx(
        'min-h-12 flex-row items-center gap-2 rounded-full border-2 px-4',
        selected ? 'border-primary bg-primary' : 'border-line bg-surface',
        className,
      )}
    >
      {Icon ? (
        <Icon size={18} color={selected ? brand.white : colors.muted} strokeWidth={2} />
      ) : null}
      <AppText variant="bodyStrong" color={selected ? 'white' : 'ink'}>
        {label}
      </AppText>
    </PressableScale>
  );
}
