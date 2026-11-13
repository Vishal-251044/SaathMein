/**
 * My deal codes (PUR-1, /deal-codes): every code ready to show at the showroom as a full
 * ticket, and bought ones with the saving. Saved for offline use (lib/queryPersist.ts), so
 * the ticket opens at the dealer even without internet.
 */
import { router } from 'expo-router';
import { ChevronRight, Ticket } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/animations/PressableScale';
import { EmptyState } from '@/components/features/EmptyState';
import { QueryErrorState } from '@/components/features/QueryErrorState';
import { DealCodeTicket } from '@/components/features/purchase/DealCodeTicket';
import { StackHeader } from '@/components/layout/StackHeader';
import { AppText } from '@/components/ui/AppText';
import { useMyDealCodes } from '@/hooks/usePurchase';
import { useThemeColors } from '@/hooks/useThemeColors';
import { formatINR } from '@/utils/genericFunctions';

const OPEN = ['pending', 'invoice_uploaded', 'objected'];

/** @returns My deal codes screen */
export default function DealCodesScreen() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const query = useMyDealCodes();
  const items = query.data ?? [];
  const open = items.filter((item) => OPEN.includes(item.status));
  const done = items.filter((item) => item.status === 'completed');

  return (
    <View className="flex-1 bg-bg">
      <StackHeader title={t('dealCodes.title')} />
      <ScrollView
        contentContainerStyle={{ gap: 16, padding: 16, paddingBottom: 32 + insets.bottom }}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => {
              query.refetch();
            }}
          />
        }
      >
        {query.isPending ? (
          <View className="gap-4" accessibilityLabel={t('common.loading')}>
            <View className="h-64 rounded-card bg-bg-band" />
            <View className="h-20 rounded-card bg-bg-band" />
          </View>
        ) : query.isError && !query.data ? (
          <QueryErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Ticket}
            title={t('dealCodes.emptyTitle')}
            body={t('dealCodes.emptyBody')}
          />
        ) : (
          <>
            {open.length ? (
              <View className="gap-4">
                <AppText variant="heading">{t('dealCodes.openSection')}</AppText>
                {open.map((item) => (
                  <View key={item.id} className="gap-2">
                    {item.productName ? (
                      <AppText variant="bodyStrong">{item.productName}</AppText>
                    ) : null}
                    <DealCodeTicket purchase={item} dealerName={item.dealerName} />
                  </View>
                ))}
              </View>
            ) : null}
            {done.length ? (
              <View className="gap-3">
                <AppText variant="heading">{t('dealCodes.doneSection')}</AppText>
                {done.map((item) => (
                  <PressableScale
                    key={item.id}
                    onPress={() =>
                      router.push({ pathname: '/group/[id]', params: { id: item.groupId } })
                    }
                    accessibilityRole="button"
                    accessibilityLabel={t('dealCodes.openGroup', {
                      name: item.productName ?? item.dealCode,
                    })}
                    className="min-h-12 flex-row items-center gap-3 rounded-card border border-line bg-surface p-4"
                  >
                    <View className="flex-1 gap-1">
                      <AppText variant="bodyStrong" numberOfLines={1}>
                        {item.productName ?? item.dealCode}
                      </AppText>
                      <AppText variant="caption" color="muted" numberOfLines={1}>
                        {item.dealerName ?? ''}
                      </AppText>
                      {item.savedPaise ? (
                        <AppText variant="caption" color="savings">
                          {t('dealCodes.saved', { amount: formatINR(item.savedPaise) })}
                        </AppText>
                      ) : null}
                    </View>
                    <ChevronRight size={20} color={colors.muted} strokeWidth={2} />
                  </PressableScale>
                ))}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}
