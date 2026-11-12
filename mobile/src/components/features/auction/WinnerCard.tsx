/**
 * WinnerCard — after the group is won (AUC-8): the dealer (name, verified, rating,
 * address), the price per member, money saved (mint), my deal code ticket to show at the
 * showroom, and the 24 h window in which I may still leave (refund minus back-out fee).
 * Money screens stay calm: clarity first.
 */
import { BadgeCheck, MapPin, Star, Ticket } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/ui/AppText';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useTimeLeft } from '@/hooks/useTimeLeft';
import type { GroupDetail, PublicDealer } from '@/types/group';
import { enterUp } from '@/utils/animations';
import { formatINR } from '@/utils/genericFunctions';

/** Address in one line. */
const addressLine = (dealer: PublicDealer) =>
  [dealer.address?.line1, dealer.address?.area ?? dealer.area, dealer.address?.pincode]
    .filter(Boolean)
    .join(', ');

/** @param props.group - Won / purchasing group */
export function WinnerCard({ group }: { group: GroupDetail }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const exit = useTimeLeft(group.exitWindowEndsAt ?? undefined);
  const dealer = group.auction?.winner ?? group.deal?.seller ?? null;
  const price = group.winningPricePaise;
  const marketPrice = group.auction?.ceilingPaise ?? group.deal?.basePricePaise ?? null;
  const saved = price != null && marketPrice ? Math.max(0, marketPrice - price) : 0;
  const hasCode = Boolean(group.myMembership?.dealCode);
  // The full ticket (QR, validity) is shown by DealCodeTicket when the purchase exists
  const dealCode = group.myPurchase ? null : (group.myMembership?.dealCode ?? null);
  if (!dealer || price == null) return null;

  return (
    <Animated.View
      entering={enterUp(1)}
      className="gap-4 rounded-card border border-line bg-surface p-4"
    >
      <View className="gap-1">
        <AppText variant="caption">{t('auction.winnerTitle')}</AppText>
        <View className="flex-row items-center gap-1.5">
          <Pressable
            onPress={() => router.push({ pathname: '/seller/[id]', params: { id: dealer.id } })}
            accessibilityRole="link"
            accessibilityHint={t('dealer.openProfile')}
            className="min-h-12 flex-shrink justify-center"
          >
            <AppText variant="heading" color="primary">
              {dealer.businessName}
            </AppText>
          </Pressable>
          {dealer.verified ? (
            <BadgeCheck
              size={18}
              color={colors.ink}
              strokeWidth={2}
              accessibilityLabel={t('sellers.verified')}
            />
          ) : null}
        </View>
        <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1">
          {dealer.rating != null ? (
            <View className="flex-row items-center gap-1">
              <Star size={14} color={colors.warning} strokeWidth={2} />
              <AppText variant="caption" color="ink">
                {t('auction.rating', {
                  rating: dealer.rating.toFixed(1),
                  count: dealer.ratingCount,
                })}
              </AppText>
            </View>
          ) : (
            <AppText variant="caption">{t('auction.newDealer')}</AppText>
          )}
          {addressLine(dealer) ? (
            <View className="flex-row items-center gap-1">
              <MapPin size={14} color={colors.muted} strokeWidth={2} />
              <AppText variant="caption">{addressLine(dealer)}</AppText>
            </View>
          ) : null}
        </View>
      </View>

      <View className="flex-row items-end justify-between gap-3 border-t border-line pt-3">
        <View className="gap-0.5">
          <AppText variant="caption">{t('auction.yourPrice')}</AppText>
          <AppText variant="title" mono>
            {formatINR(price)}
          </AppText>
        </View>
        {saved > 0 ? (
          <AppText variant="bodyStrong" color="savings">
            {t('auction.youSave', { amount: formatINR(saved) })}
          </AppText>
        ) : null}
      </View>

      {dealCode ? (
        <View
          className="gap-1 rounded-button border border-dashed border-line bg-bg-band px-4 py-3"
          accessible
          accessibilityLabel={t('auction.dealCodeA11y', { code: dealCode.split('').join(' ') })}
        >
          <View className="flex-row items-center gap-1.5">
            <Ticket size={16} color={colors.muted} strokeWidth={2} />
            <AppText variant="label">{t('auction.dealCodeLabel')}</AppText>
          </View>
          <AppText variant="title" mono selectable>
            {dealCode}
          </AppText>
          <AppText variant="caption">{t('auction.dealCodeHint')}</AppText>
        </View>
      ) : null}

      {group.status === 'won' && group.exitWindowEndsAt && !exit.isOver && hasCode ? (
        <AppText variant="caption">
          {t('auction.exitWindow', {
            time: exit.label,
            fee: formatINR(group.backoutFeePaise),
          })}
        </AppText>
      ) : null}
    </Animated.View>
  );
}
