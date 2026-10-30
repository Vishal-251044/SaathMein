/**
 * PeopleCounter — signature SaathMein element: overlapping member avatars, "14 of 20" and a
 * Sunrise progress bar that fills as people join (CLAUDE.md §11). The bar animates with
 * transform only and respects reduced motion.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { gradients } from '@/theme/tokens';
import type { GroupMemberPreview } from '@/types/group';
import { DURATION, EASE_OUT } from '@/utils/animations';

const MAX_AVATARS = 5;

interface PeopleCounterProps {
  memberCount: number;
  targetSize: number;
  members?: GroupMemberPreview[];
  /** "lg" on the group page, "sm" on cards. */
  size?: 'sm' | 'lg';
}

/**
 * @param props.memberCount - Paid members
 * @param props.targetSize - Group target
 * @param props.members - Avatars to show (group page)
 */
export function PeopleCounter({
  memberCount,
  targetSize,
  members = [],
  size = 'sm',
}: PeopleCounterProps) {
  const { t } = useTranslation();
  const progress = useSharedValue(0);
  const ratio = targetSize > 0 ? Math.min(1, memberCount / targetSize) : 0;
  const avatarSize = size === 'lg' ? 36 : 28;

  useEffect(() => {
    progress.set(
      withTiming(ratio, {
        duration: DURATION.slow,
        easing: EASE_OUT,
        reduceMotion: ReduceMotion.System,
      }),
    );
  }, [ratio, progress]);

  const barStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.get() }] }));
  const shown = members.slice(0, MAX_AVATARS);
  const extra = memberCount - shown.length;

  return (
    <View
      className="gap-2"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('group.counterA11y', { count: memberCount, target: targetSize })}
      accessibilityValue={{ min: 0, max: targetSize, now: memberCount }}
    >
      <View className="flex-row items-center gap-3">
        {shown.length ? (
          <View className="flex-row">
            {shown.map((member, index) => (
              <View
                key={`${member.firstName}-${index}`}
                className="rounded-full border-2 border-surface"
                style={{ marginLeft: index === 0 ? 0 : -avatarSize / 3 }}
              >
                <Avatar url={member.avatarUrl} name={member.firstName} size={avatarSize} />
              </View>
            ))}
            {extra > 0 ? (
              <View
                className="items-center justify-center rounded-full border-2 border-surface bg-bg-band"
                style={{
                  width: avatarSize + 4,
                  height: avatarSize + 4,
                  marginLeft: -avatarSize / 3,
                }}
              >
                <AppText variant="label" color="ink">
                  +{extra}
                </AppText>
              </View>
            ) : null}
          </View>
        ) : null}
        <AppText variant={size === 'lg' ? 'heading' : 'bodyStrong'} mono>
          {t('group.counter', { count: memberCount, target: targetSize })}
        </AppText>
      </View>

      <View className={`overflow-hidden rounded-full bg-bg-band ${size === 'lg' ? 'h-3' : 'h-2'}`}>
        <Animated.View style={[{ flex: 1, transformOrigin: 'left' }, barStyle]}>
          <LinearGradient
            colors={gradients.sunrise}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      </View>
    </View>
  );
}
