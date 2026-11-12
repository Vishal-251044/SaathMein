/**
 * DealCodeTicket — festival-pass style ticket a member shows at the showroom (PUR-1):
 * signed QR, the 10-character code (mono), dealer, price, amount to pay at the shop and
 * validity. Calm money screen: clarity first. QR drawn with react-native-qrcode-svg
 * (approved 9 Nov 2026).
 */
import { Clock, Ticket } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { AppText } from '@/components/ui/AppText';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useTimeLeft } from '@/hooks/useTimeLeft';
import type { GroupPurchase } from '@/types/group';
import { formatINR } from '@/utils/genericFunctions';

const QR_SIZE = 168;

interface Props {
  purchase: GroupPurchase;
  dealerName: string | null;
}

/** @returns Ticket card */
export function DealCodeTicket({ purchase, dealerName }: Props) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const validity = useTimeLeft(purchase.validUntil);
  const date = new Date(purchase.validUntil).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });

  return (
    <View className="overflow-hidden rounded-card border border-line bg-surface">
      <View className="flex-row items-center gap-2 bg-bg-band px-4 py-3">
        <Ticket size={18} color={colors.ink} strokeWidth={2} />
        <AppText variant="bodyStrong" className="flex-1">
          {t('purchase.ticketTitle')}
        </AppText>
      </View>

      <View className="items-center gap-3 px-4 pt-4">
        {purchase.qrPayload ? (
          // White box keeps the QR scannable in dark mode
          <View
            className="rounded-button bg-white p-3"
            accessible
            accessibilityLabel={t('purchase.qrA11y')}
          >
            <QRCode
              value={purchase.qrPayload}
              size={QR_SIZE}
              color="#12131F"
              backgroundColor="#FFFFFF"
            />
          </View>
        ) : null}
        <View
          accessible
          accessibilityLabel={t('auction.dealCodeA11y', {
            code: purchase.dealCode.split('').join(' '),
          })}
        >
          <AppText variant="title" mono selectable>
            {purchase.dealCode}
          </AppText>
        </View>
      </View>

      {/* Perforation */}
      <View className="my-4 flex-row items-center">
        <View className="-ml-3 h-6 w-6 rounded-full bg-bg" />
        <View className="flex-1 border-t border-dashed border-line" />
        <View className="-mr-3 h-6 w-6 rounded-full bg-bg" />
      </View>

      <View className="gap-2 px-4 pb-4">
        {dealerName ? (
          <View className="flex-row justify-between gap-3">
            <AppText variant="caption">{t('purchase.dealer')}</AppText>
            <AppText variant="bodyStrong" className="flex-shrink text-right">
              {dealerName}
            </AppText>
          </View>
        ) : null}
        <View className="flex-row justify-between gap-3">
          <AppText variant="caption">{t('purchase.price')}</AppText>
          <AppText variant="bodyStrong" mono>
            {formatINR(purchase.pricePaise)}
          </AppText>
        </View>
        <View className="flex-row justify-between gap-3">
          <AppText variant="caption">{t('purchase.tokenPaid')}</AppText>
          <AppText variant="body" mono>
            − {formatINR(purchase.tokenPaise)}
          </AppText>
        </View>
        <View className="flex-row justify-between gap-3 border-t border-line pt-2">
          <AppText variant="bodyStrong">{t('purchase.payAtShop')}</AppText>
          <AppText variant="heading" mono>
            {formatINR(purchase.payAtShopPaise)}
          </AppText>
        </View>
        <View className="mt-1 flex-row items-center gap-1.5">
          <Clock
            size={14}
            color={validity.isSoon ? colors.warning : colors.muted}
            strokeWidth={2}
          />
          <AppText variant="caption" color={validity.isSoon ? 'ink' : 'muted'}>
            {t('purchase.validUntil', { date, time: validity.label })}
          </AppText>
        </View>
      </View>
    </View>
  );
}
