/**
 * DealTierLadder — a seller-led deal (AUC-9): the dealer, every tier (buyers → price),
 * which tiers are unlocked, the price now and "X more to unlock". The price drops for
 * everyone when a tier unlocks. Below the first tier at the deadline, everyone is
 * refunded (decided 8 Nov 2026).
 */
import { BadgeCheck, Check, Lock, Store } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/ui/AppText';
import { useThemeColors } from '@/hooks/useThemeColors';
import type { GroupDeal } from '@/types/group';
import { enterPop } from '@/utils/animations';
import { formatINR } from '@/utils/genericFunctions';

interface Props {
  deal: GroupDeal;
  memberCount: number;
  isOpen: boolean;
}

/** @returns Tier ladder card */
export function DealTierLadder({ deal, memberCount, isOpen }: Props) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();

  return (
    <View className="gap-4 rounded-card border border-line bg-surface p-4">
      {deal.seller ? (
        <View className="flex-row items-center gap-2">
          <Store size={18} color={colors.ink} strokeWidth={2} />
          <AppText variant="bodyStrong" className="flex-shrink">
            {t('deal.by', { name: deal.seller.businessName })}
          </AppText>
          {deal.seller.verified ? (
            <BadgeCheck
              size={16}
              color={colors.ink}
              strokeWidth={2}
              accessibilityLabel={t('sellers.verified')}
            />
          ) : null}
        </View>
      ) : null}

      <View className="gap-1">
        <AppText variant="caption">{t('deal.priceNow')}</AppText>
        <AppText variant="display" mono>
          {formatINR(deal.pricePaise)}
        </AppText>
        {deal.currentTier ? (
          <AppText variant="bodyStrong" color="savings">
            {t('deal.saving', { amount: formatINR(deal.basePricePaise - deal.pricePaise) })}
          </AppText>
        ) : null}
        {isOpen && deal.nextTier && deal.membersToNext ? (
          <AppText variant="body" color="ink">
            {t('deal.moreToUnlock', {
              count: deal.membersToNext,
              price: formatINR(deal.nextTier.pricePaise),
            })}
          </AppText>
        ) : null}
      </View>

      <View className="gap-2" accessibilityRole="list">
        {deal.tiers.map((tier) => {
          const reached = memberCount >= tier.size;
          return (
            <View
              key={tier.size}
              className={`flex-row items-center gap-3 rounded-button px-3 py-3 ${reached ? 'bg-savings/10' : 'bg-bg-band'}`}
              accessible
              accessibilityLabel={t(reached ? 'deal.tierUnlockedA11y' : 'deal.tierLockedA11y', {
                size: tier.size,
                price: formatINR(tier.pricePaise),
              })}
            >
              {reached ? (
                <Animated.View entering={enterPop}>
                  <Check size={18} color={colors.savings} strokeWidth={2.5} />
                </Animated.View>
              ) : (
                <Lock size={16} color={colors.muted} strokeWidth={2} />
              )}
              <AppText variant="body" color="ink" className="flex-1">
                {t('deal.tierBuyers', { count: tier.size })}
              </AppText>
              <AppText variant="bodyStrong" mono color={reached ? 'savings' : 'ink'}>
                {formatINR(tier.pricePaise)}
              </AppText>
            </View>
          );
        })}
      </View>

      {isOpen ? <AppText variant="caption">{t('deal.refundRule')}</AppText> : null}
    </View>
  );
}
