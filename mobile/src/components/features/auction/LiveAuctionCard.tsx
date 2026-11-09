/**
 * LiveAuctionCard — the falling price while verified dealers bid (AUC-9): current lowest
 * all-inclusive price (drops in on every new bid), money saved per member (mint), dealers
 * bidding, time left (last-minute bids add 5 minutes) and the price-drop chart.
 * Dealer names are never shown while bidding is live (AUC-6).
 */
import { Clock, Gavel, Pause, Store } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { PriceDropChart } from '@/components/features/auction/PriceDropChart';
import { AppText } from '@/components/ui/AppText';
import { formatTimer, useSecondsLeft } from '@/hooks/useSecondsLeft';
import { useThemeColors } from '@/hooks/useThemeColors';
import type { GroupAuction } from '@/types/group';
import { enterPop, enterPriceDrop } from '@/utils/animations';
import { formatINR } from '@/utils/genericFunctions';

/** @param props.auction - Buyer auction view */
export function LiveAuctionCard({ auction }: { auction: GroupAuction }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const isBidding = !auction.closedAt;
  const seconds = useSecondsLeft(isBidding ? auction.endsAt : null);
  const soon = seconds != null && seconds > 0 && seconds <= 300;
  const hasBid = auction.lowestPricePaise != null;
  const price = auction.lowestPricePaise ?? auction.ceilingPaise;

  return (
    <View className="gap-4 rounded-card border border-line bg-surface p-4">
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1 flex-row items-center gap-2">
          <Gavel size={18} color={colors.ink} strokeWidth={2} />
          <AppText variant="heading">{t('auction.liveTitle')}</AppText>
        </View>
        {auction.paused ? (
          <View className="flex-row items-center gap-1">
            <Pause size={14} color={colors.warning} strokeWidth={2} />
            <AppText variant="label">{t('auction.paused')}</AppText>
          </View>
        ) : isBidding && seconds != null ? (
          <View
            className="flex-row items-center gap-1"
            accessible
            accessibilityLabel={t('auction.timeLeftA11y', { time: formatTimer(seconds) })}
          >
            <Clock size={16} color={soon ? colors.danger : colors.muted} strokeWidth={2} />
            <AppText variant="bodyStrong" mono color={soon ? 'danger' : 'ink'}>
              {seconds > 0 ? formatTimer(seconds) : t('auction.closing')}
            </AppText>
          </View>
        ) : null}
      </View>

      <View className="gap-1" accessibilityLiveRegion="polite">
        <View className="flex-row items-center gap-2">
          <AppText variant="caption">
            {hasBid ? t('auction.lowestLabel') : t('auction.marketLabel')}
          </AppText>
          {hasBid ? (
            <Animated.View
              key={`badge-${auction.lowestPricePaise}`}
              entering={enterPop}
              className="rounded-full bg-primary/10 px-2 py-0.5"
            >
              <AppText variant="label" color="primary">
                {t('auction.newLowest')}
              </AppText>
            </Animated.View>
          ) : null}
        </View>
        <Animated.View key={`price-${price}`} entering={enterPriceDrop}>
          <AppText variant="display" mono>
            {price != null ? formatINR(price) : '—'}
          </AppText>
        </Animated.View>
        {auction.savedPerMemberPaise ? (
          <AppText variant="bodyStrong" color="savings">
            {t('auction.savedSoFar', { amount: formatINR(auction.savedPerMemberPaise) })}
          </AppText>
        ) : (
          <AppText variant="caption">{t('auction.waitingFirstBid')}</AppText>
        )}
      </View>

      <PriceDropChart ceilingPaise={auction.ceilingPaise} history={auction.history} />

      <View className="flex-row flex-wrap gap-x-5 gap-y-2 border-t border-line pt-3">
        <View className="flex-row items-center gap-1.5">
          <Store size={16} color={colors.muted} strokeWidth={2} />
          <AppText variant="caption" color="ink">
            {t('auction.dealersBidding', { count: auction.dealerCount })}
          </AppText>
        </View>
        <AppText variant="caption">{t('auction.bids', { count: auction.bidCount })}</AppText>
        {auction.extensions > 0 && isBidding ? (
          <AppText variant="caption">
            {t('auction.extended', { count: auction.extensions })}
          </AppText>
        ) : null}
      </View>
      {!isBidding && !auction.winner ? (
        <AppText variant="caption">{t('auction.bidsClosed')}</AppText>
      ) : null}
    </View>
  );
}
