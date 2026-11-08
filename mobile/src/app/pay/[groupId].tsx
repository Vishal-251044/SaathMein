/**
 * Pay the token to join a group (PAY-1, GRP-7). A calm money screen: what you pay, what
 * happens to it (refund rules), then Razorpay Checkout (UPI first). The amount shown and
 * charged comes from the server. After paying, the server verifies the signature and
 * gives the seat; if the group filled up meanwhile, the token is refunded in full.
 */
import { router, useLocalSearchParams } from 'expo-router';
import {
  CheckCircle2,
  Clock,
  Lock,
  RotateCcw,
  ShieldCheck,
  Store,
  Undo2,
} from 'lucide-react-native';
import { type ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { type ColorValue, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { StackScreen } from '@/components/layout/StackScreen';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { useGroup } from '@/hooks/useGroups';
import { usePayToken } from '@/hooks/usePayments';
import { useThemeColors } from '@/hooks/useThemeColors';
import { CheckoutError } from '@/lib/razorpay';
import { brand } from '@/theme/tokens';
import { enterUp } from '@/utils/animations';
import { getErrorMessageKey } from '@/utils/errorMessages';
import { formatINR } from '@/utils/genericFunctions';

type IconType = ComponentType<{ size?: number; color?: ColorValue; strokeWidth?: number }>;

/** One refund rule line. */
function Rule({ icon: Icon, text }: { icon: IconType; text: string }) {
  const { colors } = useThemeColors();
  return (
    <View className="flex-row gap-3">
      <Icon size={18} color={colors.muted} strokeWidth={2} />
      <AppText variant="body" className="flex-1">
        {text}
      </AppText>
    </View>
  );
}

/** Translated message for a failed payment attempt. */
function errorMessageKey(error: unknown): string {
  if (error instanceof CheckoutError) {
    if (error.kind === 'cancelled') return 'pay.cancelled';
    if (error.kind === 'unavailable') return 'pay.needsAppBuild';
    return 'pay.failed';
  }
  return getErrorMessageKey(error);
}

/**
 * @returns Pay token screen
 */
export default function PayScreen() {
  const { t } = useTranslation();
  const { groupId, code } = useLocalSearchParams<{ groupId: string; code?: string }>();
  const { data: group, isPending, error: groupError } = useGroup(groupId, code);
  const pay = usePayToken();
  const outcome = pay.data?.outcome;

  if (isPending || !group) {
    return (
      <StackScreen title={t('pay.title')}>
        {groupError ? (
          <Notice message={t(getErrorMessageKey(groupError))} />
        ) : (
          <View className="gap-4" accessibilityLabel={t('common.loading')}>
            <View className="h-28 rounded-card bg-bg-band" />
            <View className="h-40 rounded-card bg-bg-band" />
          </View>
        )}
      </StackScreen>
    );
  }

  const token = formatINR(group.tokenAmountPaise);
  const goToGroup = () => router.replace({ pathname: '/group/[id]', params: { id: group.id } });

  // Result after Checkout
  if (outcome === 'joined' || outcome === 'already_processed' || outcome === 'processing') {
    const joined = outcome !== 'processing';
    return (
      <StackScreen title={t('pay.title')}>
        <Animated.View
          entering={enterUp(0)}
          className="items-center gap-3 rounded-card border border-line bg-surface px-6 py-10"
          accessibilityLiveRegion="polite"
        >
          {joined ? (
            <CheckCircle2 size={44} color={brand.primary} strokeWidth={1.8} />
          ) : (
            <Clock size={44} color={brand.primary} strokeWidth={1.8} />
          )}
          <AppText variant="heading" className="text-center">
            {joined ? t('pay.joinedTitle') : t('pay.processingTitle')}
          </AppText>
          <AppText variant="body" color="muted" className="text-center">
            {joined ? t('pay.joinedBody', { amount: token }) : t('pay.processingBody')}
          </AppText>
          <Button label={t('pay.goToGroup')} onPress={goToGroup} className="mt-3 self-stretch" />
        </Animated.View>
      </StackScreen>
    );
  }
  if (outcome === 'seat_unavailable' || outcome === 'mismatch') {
    return (
      <StackScreen title={t('pay.title')}>
        <Notice
          tone="warning"
          title={t('pay.seatGoneTitle')}
          message={t('pay.seatGoneBody', { amount: token })}
        />
        <Button
          label={t('pay.goToGroup')}
          variant="secondary"
          onPress={goToGroup}
          className="mt-6"
        />
      </StackScreen>
    );
  }

  const viaOffer = Boolean(group.myMembership?.seatOfferExpiresAt);

  return (
    <StackScreen title={t('pay.title')}>
      <Animated.View
        entering={enterUp(0)}
        className="gap-1 rounded-card border border-line bg-surface p-5"
      >
        <AppText variant="label">{t('pay.forGroup')}</AppText>
        <AppText variant="bodyStrong">{group.product.name}</AppText>
        <AppText variant="caption">{group.variantName ?? t('group.anyVariant')}</AppText>
        <View className="mt-4 flex-row items-end justify-between border-t border-line pt-4">
          <AppText variant="body" color="muted">
            {t('pay.tokenLabel')}
          </AppText>
          <AppText variant="title" mono accessibilityLabel={t('pay.tokenA11y', { amount: token })}>
            {token}
          </AppText>
        </View>
      </Animated.View>

      {viaOffer ? <Notice tone="info" message={t('pay.seatOffer')} className="mt-4" /> : null}

      <Animated.View entering={enterUp(1)} className="mt-6 gap-4">
        <AppText variant="heading">{t('pay.rulesTitle')}</AppText>
        <Rule icon={RotateCcw} text={t('pay.ruleOpen')} />
        <Rule
          icon={Lock}
          text={
            group.backoutFeePaise > 0
              ? t('pay.ruleLocked', { fee: formatINR(group.backoutFeePaise) })
              : t('pay.ruleLockedNoFee')
          }
        />
        <Rule icon={Undo2} text={t('pay.ruleFailed')} />
        <Rule icon={Store} text={t('pay.rulePartPayment')} />
      </Animated.View>

      <View className="mt-8 gap-3">
        {pay.error ? <Notice message={t(errorMessageKey(pay.error))} /> : null}
        <Button
          label={t('pay.payButton', { amount: token })}
          loading={pay.isPending}
          onPress={() => pay.mutate({ groupId: group.id, code })}
          accessibilityHint={t('pay.payHint')}
        />
        <View className="flex-row items-center justify-center gap-1.5">
          <ShieldCheck size={14} color={brand.primary} strokeWidth={2} />
          <AppText variant="caption">{t('pay.secure')}</AppText>
        </View>
      </View>
    </StackScreen>
  );
}
