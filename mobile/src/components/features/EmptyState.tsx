/**
 * EmptyState — friendly placeholder when a list or screen has nothing to show yet.
 * Every list screen uses this instead of a blank area (CLAUDE.md: loading, error, empty).
 */
import { type ComponentType, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/ui/AppText';
import { useThemeColors } from '@/hooks/useThemeColors';
import { enterUp } from '@/utils/animations';
import { cx } from '@/utils/genericFunctions';

interface EmptyStateProps {
  icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  title: string;
  body: string;
  /** "ai" uses Saathi violet for the icon; default uses the neutral style. */
  tone?: 'default' | 'ai';
  /** Optional action (e.g. a Button). */
  action?: ReactNode;
  className?: string;
}

/**
 * @param props.icon - Lucide icon component
 * @param props.title - Short headline (translated)
 * @param props.body - One or two sentences (translated)
 */
export function EmptyState({
  icon: Icon,
  title,
  body,
  tone = 'default',
  action,
  className,
}: EmptyStateProps) {
  const { colors } = useThemeColors();
  const isAi = tone === 'ai';

  return (
    <Animated.View
      entering={enterUp(1)}
      className={cx(
        'items-center rounded-card border border-line bg-surface px-6 py-10',
        className,
      )}
    >
      <View
        className={cx(
          'h-16 w-16 items-center justify-center rounded-card',
          isAi ? 'bg-ai-soft' : 'bg-bg-band',
        )}
      >
        <Icon size={28} color={isAi ? colors.ai : colors.muted} strokeWidth={1.8} />
      </View>
      <AppText variant="heading" className="mt-5 text-center">
        {title}
      </AppText>
      <AppText variant="body" color="muted" className="mt-2 max-w-[320px] text-center">
        {body}
      </AppText>
      {action ? <View className="mt-6 w-full">{action}</View> : null}
    </Animated.View>
  );
}
