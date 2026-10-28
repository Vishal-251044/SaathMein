/**
 * Notice — inline message box (errors, warnings, info) with an icon.
 */
import { CircleAlert, Info, TriangleAlert } from 'lucide-react-native';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText, type TextColor } from '@/components/ui/AppText';
import { useThemeColors } from '@/hooks/useThemeColors';
import { enterFade } from '@/utils/animations';
import { cx } from '@/utils/genericFunctions';

type NoticeTone = 'error' | 'warning' | 'info';

interface NoticeProps {
  tone?: NoticeTone;
  title?: string;
  message: string;
  className?: string;
}

/**
 * @param props.tone - error (default), warning or info
 * @param props.title - Optional bold first line
 * @param props.message - Message text (translated)
 */
export function Notice({ tone = 'error', title, message, className }: NoticeProps) {
  const { colors } = useThemeColors();
  const styles: Record<
    NoticeTone,
    { box: string; color: TextColor; icon: typeof Info; iconColor: string }
  > = {
    error: {
      box: 'border-danger/40 bg-danger/10',
      color: 'danger',
      icon: CircleAlert,
      iconColor: colors.danger,
    },
    warning: {
      box: 'border-warning/40 bg-warning/10',
      color: 'ink',
      icon: TriangleAlert,
      iconColor: colors.warning,
    },
    info: { box: 'border-line bg-bg-band', color: 'ink', icon: Info, iconColor: colors.muted },
  };
  const { box, color, icon: Icon, iconColor } = styles[tone];

  return (
    <Animated.View
      entering={enterFade}
      accessibilityRole={tone === 'error' ? 'alert' : undefined}
      className={cx('flex-row gap-3 rounded-button border px-4 py-3', box, className)}
    >
      <Icon size={18} color={iconColor} strokeWidth={2} />
      <View className="flex-1">
        {title ? (
          <AppText variant="bodyStrong" color={color}>
            {title}
          </AppText>
        ) : null}
        <AppText variant="caption" color={color} className={title ? 'mt-0.5' : undefined}>
          {message}
        </AppText>
      </View>
    </Animated.View>
  );
}
