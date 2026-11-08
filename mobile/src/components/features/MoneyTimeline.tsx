/**
 * MoneyTimeline — where my token is (PAY-6): paid → held → refunded / back-out fee kept /
 * sent to the dealer → released, with a receipt (Razorpay payment id, method, time).
 * Mint is used only for money that came back to me (refunds), per the colour rules.
 */
import {
  ArrowDownLeft,
  ArrowUpRight,
  CircleDollarSign,
  Clock,
  Lock,
  Receipt,
  RefreshCw,
  Store,
  XCircle,
} from 'lucide-react-native';
import { type ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { type ColorValue, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { useGroupPayments } from '@/hooks/usePayments';
import { useThemeColors } from '@/hooks/useThemeColors';
import type { MoneyEventType } from '@/types/payment';
import { getErrorMessageKey } from '@/utils/errorMessages';
import { formatINR } from '@/utils/genericFunctions';

type IconType = ComponentType<{ size?: number; color?: ColorValue; strokeWidth?: number }>;

const ICONS: Record<MoneyEventType, IconType> = {
  paid: ArrowUpRight,
  held: Lock,
  refund_started: Clock,
  refunded: ArrowDownLeft,
  fee_kept: CircleDollarSign,
  sent_to_dealer: Store,
  released: Store,
  returned_from_dealer: ArrowDownLeft,
  failed: XCircle,
};

/** @param props.groupId - Group whose payments to show */
export function MoneyTimeline({ groupId }: { groupId: string }) {
  const { t, i18n } = useTranslation();
  const { colors } = useThemeColors();
  const { data: payments, isPending, error, refetch } = useGroupPayments(groupId, true);
  const locale = i18n.language === 'en' ? 'en-IN' : `${i18n.language}-IN`;
  const when = (at: string) =>
    new Date(at).toLocaleString(locale, {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    });

  if (isPending)
    return (
      <View className="h-32 rounded-card bg-bg-band" accessibilityLabel={t('common.loading')} />
    );
  if (error) {
    return (
      <View className="items-start gap-3 rounded-card border border-line bg-surface p-4">
        <AppText variant="body" color="muted">
          {t(getErrorMessageKey(error))}
        </AppText>
        <Button
          label={t('common.retry')}
          icon={RefreshCw}
          variant="secondary"
          onPress={() => refetch()}
        />
      </View>
    );
  }
  if (!payments?.length) return null;

  return (
    <View className="gap-3">
      <AppText variant="heading">{t('money.title')}</AppText>
      {payments.map((payment) => (
        <View key={payment.id} className="gap-4 rounded-card border border-line bg-surface p-4">
          {payment.timeline.map((event, index) => {
            const Icon = ICONS[event.type];
            const isRefund = event.type === 'refunded' || event.type === 'returned_from_dealer';
            const iconColor =
              event.type === 'failed' ? colors.danger : isRefund ? colors.savings : colors.ink;
            return (
              <View key={`${event.type}-${index}`} className="flex-row items-start gap-3">
                <View className="h-9 w-9 items-center justify-center rounded-full bg-bg-band">
                  <Icon size={18} color={iconColor} strokeWidth={2} />
                </View>
                <View className="flex-1">
                  <AppText variant="bodyStrong">{t(`money.event.${event.type}`)}</AppText>
                  {event.reason ? (
                    <AppText variant="caption">
                      {t(`money.reason.${event.reason}`, { defaultValue: '' })}
                    </AppText>
                  ) : null}
                  <AppText variant="caption">{when(event.at)}</AppText>
                </View>
                <AppText variant="bodyStrong" mono color={isRefund ? 'savings' : 'ink'}>
                  {formatINR(event.amountPaise)}
                </AppText>
              </View>
            );
          })}
          {payment.razorpayPaymentId ? (
            <View className="gap-1 border-t border-line pt-3">
              <View className="flex-row items-center gap-1.5">
                <Receipt size={14} color={colors.muted} strokeWidth={2} />
                <AppText variant="label">{t('money.receipt')}</AppText>
              </View>
              <AppText variant="caption" mono selectable>
                {payment.razorpayPaymentId}
              </AppText>
              <AppText variant="caption">
                {[
                  payment.method
                    ? t(`money.method.${payment.method}`, { defaultValue: payment.method })
                    : null,
                  payment.paidAt ? when(payment.paidAt) : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </AppText>
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}
