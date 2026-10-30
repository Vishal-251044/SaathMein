/**
 * GroupCard — one group in lists (product page, My Groups, similar groups): product,
 * variant, people counter with Sunrise bar, time left and status. Tapping opens the
 * group page unless `onPress` is given.
 */
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Clock, Crown, Lock, Package } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { PressableScale } from '@/components/animations/PressableScale';
import { GroupStatusBadge } from '@/components/features/GroupStatusBadge';
import { PeopleCounter } from '@/components/features/PeopleCounter';
import { AppText } from '@/components/ui/AppText';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useTimeLeft } from '@/hooks/useTimeLeft';
import type { GroupCard as GroupCardData } from '@/types/group';
import { sizedImageUrl } from '@/utils/imageUrl';

const THUMB = 56;

interface GroupCardProps {
  group: GroupCardData;
  /** Hide the product row (e.g. on that product's own page). */
  hideProduct?: boolean;
  onPress?: () => void;
}

/**
 * @param props.group - Group card from the API
 */
export function GroupCard({ group, hideProduct = false, onPress }: GroupCardProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const timeLeft = useTimeLeft(group.deadline);
  const imageUrl = sizedImageUrl(group.product.imageUrl ?? null, THUMB);
  const isOpen = group.status === 'open';

  return (
    <PressableScale
      onPress={
        onPress ?? (() => router.push({ pathname: '/group/[id]', params: { id: group.id } }))
      }
      accessibilityRole="button"
      accessibilityLabel={t('group.cardA11y', {
        name: group.product.name ?? '',
        count: group.memberCount,
        target: group.targetSize,
      })}
      className="gap-3 rounded-card border border-line bg-surface p-4"
    >
      {!hideProduct ? (
        <View className="flex-row items-center gap-3">
          <View
            className="items-center justify-center overflow-hidden rounded-button bg-bg-band"
            style={{ width: THUMB, height: THUMB }}
          >
            {imageUrl ? (
              <Image
                source={{ uri: imageUrl }}
                style={{ width: THUMB, height: THUMB }}
                contentFit="cover"
              />
            ) : (
              <Package size={24} color={colors.muted} strokeWidth={1.8} />
            )}
          </View>
          <View className="flex-1">
            <AppText variant="bodyStrong" numberOfLines={2}>
              {group.product.name}
            </AppText>
            <AppText variant="caption" numberOfLines={1}>
              {group.variantName ?? t('group.anyVariant')}
            </AppText>
          </View>
        </View>
      ) : null}

      <View className="flex-row flex-wrap items-center gap-2">
        <GroupStatusBadge status={group.status} />
        {group.isLeader ? (
          <View className="flex-row items-center gap-1">
            <Crown size={13} color={colors.ink} strokeWidth={2} />
            <AppText variant="label" color="ink">
              {t('group.youLead')}
            </AppText>
          </View>
        ) : null}
        {group.visibility === 'community' ? (
          <View className="flex-row items-center gap-1">
            <Lock size={13} color={colors.muted} strokeWidth={2} />
            <AppText variant="label">{t('group.community')}</AppText>
          </View>
        ) : null}
        {group.myMembershipStatus === 'pending_approval' ? (
          <AppText variant="label">{t('group.awaitingApproval')}</AppText>
        ) : null}
      </View>

      <PeopleCounter memberCount={group.memberCount} targetSize={group.targetSize} />

      {isOpen ? (
        <View className="flex-row items-center gap-1.5">
          <Clock
            size={14}
            color={timeLeft.isSoon ? colors.warning : colors.muted}
            strokeWidth={2}
          />
          <AppText variant="caption" color={timeLeft.isSoon ? 'ink' : 'muted'}>
            {timeLeft.label}
          </AppText>
          <AppText variant="caption">· {t('group.seatsLeft', { count: group.seatsLeft })}</AppText>
        </View>
      ) : null}
    </PressableScale>
  );
}
