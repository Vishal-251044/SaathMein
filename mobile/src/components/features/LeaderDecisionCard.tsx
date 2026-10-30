/**
 * LeaderDecisionCard — after the deadline at ≥70% (GRP-5) the leader picks: extend the
 * deadline once, or start the dealer auction now. Both ask for confirmation first.
 */
import { CalendarPlus, Gavel, TriangleAlert } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { useExtendGroup, useStartAuctionEarly } from '@/hooks/useGroups';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useTimeLeft } from '@/hooks/useTimeLeft';
import type { GroupDetail } from '@/types/group';
import { getErrorMessageKey } from '@/utils/errorMessages';

/** @param props.group - Group page data with `leaderDecision` */
export function LeaderDecisionCard({ group }: { group: GroupDetail }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const extend = useExtendGroup();
  const start = useStartAuctionEarly();
  const decision = group.leaderDecision;
  const timeLeft = useTimeLeft(decision?.dueAt);
  if (!decision) return null;
  const error = extend.error ?? start.error;

  const confirm = (title: string, body: string, onConfirm: () => void) =>
    Alert.alert(title, body, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.confirm'), onPress: onConfirm },
    ]);

  return (
    <View className="gap-3 rounded-card border border-warning/40 bg-warning/10 p-4">
      <View className="flex-row items-start gap-3">
        <TriangleAlert size={20} color={colors.warning} strokeWidth={2} />
        <View className="flex-1 gap-1">
          <AppText variant="bodyStrong">{t('group.decisionTitle')}</AppText>
          <AppText variant="caption" color="ink">
            {t('group.decisionBody', {
              count: group.memberCount,
              target: group.targetSize,
              time: timeLeft.label,
            })}
          </AppText>
        </View>
      </View>
      {error ? <Notice message={t(getErrorMessageKey(error))} /> : null}
      {decision.canStartEarly ? (
        <Button
          label={t('group.startEarly')}
          icon={Gavel}
          loading={start.isPending}
          onPress={() =>
            confirm(
              t('group.startEarlyConfirmTitle'),
              t('group.startEarlyConfirmBody', { count: group.memberCount }),
              () => start.mutate(group.id),
            )
          }
        />
      ) : null}
      {decision.canExtend ? (
        <Button
          label={t('group.extend')}
          icon={CalendarPlus}
          variant="secondary"
          loading={extend.isPending}
          onPress={() =>
            confirm(t('group.extendConfirmTitle'), t('group.extendConfirmBody'), () =>
              extend.mutate(group.id),
            )
          }
        />
      ) : null}
    </View>
  );
}
