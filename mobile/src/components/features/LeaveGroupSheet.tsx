/**
 * LeaveGroupSheet — bottom sheet to leave a group with a refund preview (PAY-3): full
 * refund while open; token minus the back-out fee after seats lock; not possible while
 * dealers bid. The preview comes from the server, so it always matches what is refunded.
 */
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { useLeaveGroup, useLeavePreview } from '@/hooks/usePayments';
import { getErrorMessageKey } from '@/utils/errorMessages';
import { formatINR } from '@/utils/genericFunctions';

interface LeaveGroupSheetProps {
  groupId: string;
  visible: boolean;
  onClose: () => void;
}

/**
 * @param props.groupId - Group to leave
 * @param props.visible - Sheet open
 * @param props.onClose - Close the sheet
 */
export function LeaveGroupSheet({ groupId, visible, onClose }: LeaveGroupSheetProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const preview = useLeavePreview(groupId, visible);
  const leave = useLeaveGroup(groupId);
  const terms = preview.data;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        className="flex-1 bg-black/40"
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('common.cancel')}
      />
      <View
        className="gap-4 rounded-t-card bg-surface px-5 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 16) + 8 }}
        accessibilityViewIsModal
      >
        <View className="h-1.5 w-12 self-center rounded-full bg-line" />
        <AppText variant="heading">{t('leave.title')}</AppText>

        {preview.isPending ? <View className="h-24 rounded-card bg-bg-band" /> : null}
        {preview.error ? <Notice message={t(getErrorMessageKey(preview.error))} /> : null}

        {terms && !terms.canLeave ? (
          <Notice
            tone="info"
            message={terms.reason === 'SEATS_LOCKED' ? t('leave.locked') : t('leave.notMember')}
          />
        ) : null}

        {terms?.canLeave ? (
          <View className="overflow-hidden rounded-card border border-line">
            <View className="flex-row justify-between px-4 py-3">
              <AppText variant="body" color="muted">
                {t('leave.paid')}
              </AppText>
              <AppText variant="bodyStrong" mono>
                {formatINR(terms.tokenPaise)}
              </AppText>
            </View>
            {terms.feePaise > 0 ? (
              <View className="flex-row justify-between border-t border-line px-4 py-3">
                <AppText variant="body" color="muted">
                  {t('leave.fee')}
                </AppText>
                <AppText variant="bodyStrong" mono>
                  − {formatINR(terms.feePaise)}
                </AppText>
              </View>
            ) : null}
            <View className="flex-row justify-between border-t border-line bg-bg-band px-4 py-3">
              <AppText variant="bodyStrong">{t('leave.refund')}</AppText>
              <AppText variant="heading" mono color="savings">
                {formatINR(terms.refundPaise)}
              </AppText>
            </View>
          </View>
        ) : null}
        {terms?.canLeave ? (
          <AppText variant="caption">
            {terms.feePaise > 0 ? t('leave.feeExplain') : t('leave.refundTime')}
          </AppText>
        ) : null}

        {leave.error ? <Notice message={t(getErrorMessageKey(leave.error))} /> : null}
        {terms?.canLeave ? (
          <Button
            label={t('leave.confirm')}
            variant="secondary"
            loading={leave.isPending}
            onPress={() => leave.mutate(undefined, { onSuccess: onClose })}
          />
        ) : null}
        <Button label={t('leave.stay')} variant="ghost" onPress={onClose} />
      </View>
    </Modal>
  );
}
