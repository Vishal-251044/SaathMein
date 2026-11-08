/**
 * NewMemberToast — "Asha joined" slides in when someone pays and joins while the group is
 * open on screen (LIV-1 new-member animation). Hides after 3 s; respects reduced motion.
 */
import { UserPlus } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp, ReduceMotion } from 'react-native-reanimated';

import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { brand } from '@/theme/tokens';
import type { GroupMemberPreview } from '@/types/group';
import { DURATION } from '@/utils/animations';

const VISIBLE_MS = 3_000;

/** @param props.member - The member who just joined (null = nothing to show) */
export function NewMemberToast({
  member,
}: {
  member: Omit<GroupMemberPreview, 'isLeader'> | null;
}) {
  const { t } = useTranslation();
  // The member whose toast already timed out (set from the timer, not during render)
  const [expired, setExpired] = useState<typeof member>(null);
  const shown = member && member !== expired ? member : null;

  useEffect(() => {
    if (!member) return undefined;
    const timer = setTimeout(() => setExpired(member), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [member]);

  if (!shown) return null;
  return (
    <View pointerEvents="none" className="absolute left-0 right-0 top-24 z-10 items-center">
      <Animated.View
        entering={FadeInUp.duration(DURATION.base).reduceMotion(ReduceMotion.System)}
        exiting={FadeOutUp.duration(DURATION.fast).reduceMotion(ReduceMotion.System)}
        className="flex-row items-center gap-2 rounded-full border border-line bg-surface px-4 py-2"
        accessibilityLiveRegion="polite"
      >
        <Avatar url={shown.avatarUrl} name={shown.firstName} size={24} />
        <AppText variant="bodyStrong">
          {t('group.memberJoined', { name: shown.firstName ?? t('group.someone') })}
        </AppText>
        <UserPlus size={16} color={brand.primary} strokeWidth={2} />
      </Animated.View>
    </View>
  );
}
