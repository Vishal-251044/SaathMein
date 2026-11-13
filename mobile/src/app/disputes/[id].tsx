/**
 * One dispute (TRU-4): my complaint, the dealer's answer, Support's decision (refund or
 * credits) and the timeline. Calm money screen: clarity first.
 */
import { useLocalSearchParams } from 'expo-router';
import { Scale } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/features/EmptyState';
import { DisputeStatusPill } from '@/components/features/trust/DisputeStatusPill';
import { StackHeader } from '@/components/layout/StackHeader';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { useMyDispute } from '@/hooks/useTrust';
import { getErrorMessageKey } from '@/utils/errorMessages';
import { formatINR } from '@/utils/genericFunctions';
import { Skeleton } from '@/components/animations/Skeleton';
import { brand } from '@/theme/tokens';

/** Short date and time. */
const when = (value: string) =>
  new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });

/** @returns Dispute detail screen */
export default function DisputeScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useMyDispute(id);

  if (query.isPending) {
    return (
      <View className="flex-1 bg-bg">
        <StackHeader title={t('dispute.title')} />
        <View className="gap-3 p-4">
          <Skeleton className="h-32 rounded-card" />
          <Skeleton className="h-40 rounded-card" />
        </View>
      </View>
    );
  }
  if (query.isError && !query.data) {
    return (
      <View className="flex-1 bg-bg">
        <StackHeader title={t('dispute.title')} />
        <View className="p-4">
          <EmptyState
            icon={Scale}
            title={t('errors.generic')}
            body={t(getErrorMessageKey(query.error))}
            action={
              <Button
                label={t('common.retry')}
                variant="secondary"
                onPress={() => query.refetch()}
              />
            }
          />
        </View>
      </View>
    );
  }
  const dispute = query.data;
  const decision = dispute.decision;

  return (
    <View className="flex-1 bg-bg">
      <StackHeader title={t('dispute.title')} />
      <ScrollView
        contentContainerStyle={{ gap: 16, padding: 16, paddingBottom: 32 + insets.bottom }}
        refreshControl={
          <RefreshControl
            colors={[brand.primary]}
            tintColor={brand.primary}
            refreshing={query.isRefetching}
            onRefresh={() => {
              query.refetch();
            }}
          />
        }
      >
        <View className="gap-2 rounded-card border border-line bg-surface p-4">
          <AppText variant="heading">{t(`dispute.types.${dispute.type}`)}</AppText>
          <DisputeStatusPill status={dispute.status} />
          <AppText variant="body">{dispute.description}</AppText>
          {dispute.quotedPricePaise ? (
            <AppText variant="caption">
              {t('dispute.quoted', { price: formatINR(dispute.quotedPricePaise) })}
            </AppText>
          ) : null}
          <AppText variant="caption">
            {t('dispute.files', { count: dispute.evidence.length })}
          </AppText>
        </View>

        {dispute.status === 'awaiting_seller' && dispute.sellerDueAt ? (
          <AppText variant="caption">
            {t('dispute.waitingDealer', { time: when(dispute.sellerDueAt) })}
          </AppText>
        ) : null}

        {dispute.sellerResponse ? (
          <View className="gap-1 rounded-card border border-line bg-surface p-4">
            <AppText variant="label">{t('dispute.dealerSays')}</AppText>
            <AppText variant="body">{dispute.sellerResponse.text}</AppText>
          </View>
        ) : null}

        {decision ? (
          <View className="gap-1 rounded-card border border-line bg-surface p-4">
            <AppText variant="label">{t('dispute.decisionTitle')}</AppText>
            {decision.outcome === 'refund' && decision.refundPaise ? (
              <AppText variant="bodyStrong" color="savings">
                {t('dispute.refunded', { amount: formatINR(decision.refundPaise) })}
              </AppText>
            ) : decision.outcome === 'credit' && decision.creditPaise ? (
              <AppText variant="bodyStrong" color="savings">
                {t('dispute.credited', { amount: formatINR(decision.creditPaise) })}
              </AppText>
            ) : (
              <AppText variant="bodyStrong">{t('dispute.noRefund')}</AppText>
            )}
            <AppText variant="body">{decision.note}</AppText>
          </View>
        ) : null}

        <View className="gap-3">
          <AppText variant="heading">{t('dispute.timelineTitle')}</AppText>
          {dispute.timeline.map((entry, index) => (
            <View key={`${entry.at}-${index}`} className="border-l-2 border-line pl-3">
              <AppText variant="bodyStrong">
                {t(`dispute.actions.${entry.action}`, { defaultValue: entry.action })}
              </AppText>
              <AppText variant="caption">{when(entry.at)}</AppText>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
