/**
 * InvoiceCard — if the dealer did not scan my code, I can add a photo of the shop invoice
 * (PUR-2). The purchase then completes in 48 h unless the dealer objects (PUR-3,
 * decided 9 Nov 2026). Shows the waiting state after upload.
 */
import { Camera, FileCheck2, ImageUp } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { useUploadInvoice } from '@/hooks/usePurchase';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useTimeLeft } from '@/hooks/useTimeLeft';
import type { GroupPurchase } from '@/types/group';
import { getErrorMessageKey } from '@/utils/errorMessages';

/** @param props.purchase - My purchase */
export function InvoiceCard({ purchase }: { purchase: GroupPurchase }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const upload = useUploadInvoice(purchase.groupId);
  const waiting = useTimeLeft(purchase.autoCompleteAt ?? undefined);

  if (purchase.status === 'invoice_uploaded') {
    return (
      <View className="flex-row items-start gap-3 rounded-card border border-line bg-surface p-4">
        <FileCheck2 size={20} color={colors.ink} strokeWidth={2} />
        <View className="flex-1 gap-1">
          <AppText variant="bodyStrong">{t('purchase.invoiceSent')}</AppText>
          <AppText variant="caption">
            {t('purchase.invoiceWaiting', { time: waiting.label })}
          </AppText>
        </View>
      </View>
    );
  }
  if (purchase.status === 'objected') {
    return <Notice tone="info" message={t('purchase.invoiceObjected')} />;
  }
  if (purchase.status !== 'pending') return null;

  const busy = upload.isPending;
  return (
    <View className="gap-3 rounded-card border border-line bg-surface p-4">
      <View className="gap-1">
        <AppText variant="bodyStrong">{t('purchase.invoiceTitle')}</AppText>
        <AppText variant="caption">{t('purchase.invoiceBody')}</AppText>
      </View>
      {upload.error ? <Notice message={t(getErrorMessageKey(upload.error))} /> : null}
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Button
            label={t('purchase.takePhoto')}
            icon={Camera}
            variant="secondary"
            loading={busy && upload.variables?.source === 'camera'}
            disabled={busy}
            onPress={() => upload.mutate({ purchaseId: purchase.id, source: 'camera' })}
          />
        </View>
        <View className="flex-1">
          <Button
            label={t('purchase.fromGallery')}
            icon={ImageUp}
            variant="secondary"
            loading={busy && upload.variables?.source === 'library'}
            disabled={busy}
            onPress={() => upload.mutate({ purchaseId: purchase.id, source: 'library' })}
          />
        </View>
      </View>
    </View>
  );
}
