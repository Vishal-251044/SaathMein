/**
 * SavedCard — "You saved ₹X" after the purchase completes (PUR-4): mint saving, a small
 * celebratory entrance, share to WhatsApp with the group link, and the review prompt.
 * Image share cards come with AI on Day 19; this shares text + link.
 */
import { BadgeCheck, Share2, Star } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { ReviewSheet } from '@/components/features/purchase/ReviewSheet';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { useThemeColors } from '@/hooks/useThemeColors';
import { shareToWhatsApp } from '@/lib/share';
import type { GroupPurchase } from '@/types/group';
import { enterPop, enterUp } from '@/utils/animations';
import { formatINR } from '@/utils/genericFunctions';
import { Confetti } from '@/components/animations/Confetti';

interface Props {
  purchase: GroupPurchase;
  productName: string;
  dealerName: string | null;
  shareUrl: string | null;
}

/** @returns Saving card with share and review */
export function SavedCard({ purchase, productName, dealerName, shareUrl }: Props) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const [reviewing, setReviewing] = useState(false);
  const saved = purchase.savedPaise ?? 0;

  const share = () =>
    shareToWhatsApp(
      t('purchase.shareMessage', {
        amount: formatINR(saved),
        name: productName,
        link: shareUrl ?? 'https://saathmein.in',
      }),
    ).catch(() => {});

  return (
    <Animated.View
      entering={enterUp(1)}
      className="gap-4 rounded-card border border-line bg-surface p-4"
    >
      <View className="items-center gap-2 overflow-hidden rounded-card bg-savings/10 px-4 py-5">
        {saved > 0 ? <Confetti /> : null}
        <Animated.View entering={enterPop}>
          <BadgeCheck size={32} color={colors.savings} strokeWidth={2} />
        </Animated.View>
        <AppText variant="caption" color="ink">
          {t('purchase.completeTitle')}
        </AppText>
        {saved > 0 ? (
          <AppText variant="display" mono color="savings">
            {t('purchase.youSaved', { amount: formatINR(saved) })}
          </AppText>
        ) : null}
        <AppText variant="caption" className="text-center">
          {t('purchase.boughtAt', { name: productName, price: formatINR(purchase.pricePaise) })}
        </AppText>
      </View>
      {saved > 0 ? (
        <Button
          label={t('purchase.shareSaving')}
          icon={Share2}
          variant="secondary"
          onPress={share}
        />
      ) : null}
      {purchase.canReview ? (
        <Button
          label={t('purchase.rateDealer', { name: dealerName ?? t('purchase.theDealer') })}
          icon={Star}
          onPress={() => setReviewing(true)}
        />
      ) : purchase.reviewedAt ? (
        <AppText variant="caption" className="text-center">
          {t('purchase.thanksReview')}
        </AppText>
      ) : null}
      <ReviewSheet
        purchase={purchase}
        dealerName={dealerName}
        visible={reviewing}
        onClose={() => setReviewing(false)}
      />
    </Animated.View>
  );
}
