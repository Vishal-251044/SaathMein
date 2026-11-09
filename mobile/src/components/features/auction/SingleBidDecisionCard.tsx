/**
 * SingleBidDecisionCard — only one dealer bid after the 24 h extension (decided
 * 8 Nov 2026): the leader accepts that price for everyone, or cancels and every token is
 * refunded in full. No answer by the due time = cancel. Both ask for confirmation first
 * (state-changing money action). Other members see a waiting note.
 */
import { Check, TriangleAlert, XCircle } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { useDecideSingleBid } from '@/hooks/useGroups';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useTimeLeft } from '@/hooks/useTimeLeft';
import type { GroupDetail } from '@/types/group';
import { getErrorMessageKey } from '@/utils/errorMessages';
import { formatINR } from '@/utils/genericFunctions';

/** @param props.group - Group whose auction waits for the leader */
export function SingleBidDecisionCard({ group }: { group: GroupDetail }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const decide = useDecideSingleBid();
  const decision = group.auction?.singleBidDecision;
  const timeLeft = useTimeLeft(decision?.dueAt);
  if (!decision) return null;
  const price = formatINR(decision.pricePaise);

  if (!decision.canDecide) {
    return <Notice tone="info" message={t('auction.singleBidWaiting', { price })} />;
  }

  const confirm = (accept: boolean) =>
    Alert.alert(
      t(accept ? 'auction.acceptConfirmTitle' : 'auction.declineConfirmTitle'),
      t(accept ? 'auction.acceptConfirmBody' : 'auction.declineConfirmBody', {
        price,
        count: group.memberCount,
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          style: accept ? 'default' : 'destructive',
          onPress: () => decide.mutate({ groupId: group.id, accept }),
        },
      ],
    );

  return (
    <View className="gap-3 rounded-card border border-warning/40 bg-warning/10 p-4">
      <View className="flex-row items-start gap-3">
        <TriangleAlert size={20} color={colors.warning} strokeWidth={2} />
        <View className="flex-1 gap-1">
          <AppText variant="bodyStrong">{t('auction.singleBidTitle')}</AppText>
          <AppText variant="caption" color="ink">
            {t('auction.singleBidBody', { price, time: timeLeft.label })}
          </AppText>
        </View>
      </View>
      {decide.error ? <Notice message={t(getErrorMessageKey(decide.error))} /> : null}
      <Button
        label={t('auction.acceptPrice', { price })}
        icon={Check}
        loading={decide.isPending && decide.variables?.accept === true}
        disabled={decide.isPending}
        onPress={() => confirm(true)}
      />
      <Button
        label={t('auction.declineAndRefund')}
        icon={XCircle}
        variant="secondary"
        loading={decide.isPending && decide.variables?.accept === false}
        disabled={decide.isPending}
        onPress={() => confirm(false)}
      />
    </View>
  );
}
