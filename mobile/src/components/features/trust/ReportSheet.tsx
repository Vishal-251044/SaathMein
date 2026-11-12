/**
 * ReportSheet — report a group, member, dealer, message or review (TRU-3): reason chips
 * (spam, fraud, abuse, price not honoured, other) and optional details. Shows a thank-you
 * state; a second report of the same thing explains it is already being reviewed.
 */
import { Flag } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Notice } from '@/components/ui/Notice';
import { TextField } from '@/components/ui/TextField';
import { useCreateReport } from '@/hooks/useTrust';
import type { ReportReason, ReportTarget } from '@/types/trust';
import { getErrorMessageKey } from '@/utils/errorMessages';

const REASONS: ReportReason[] = ['spam', 'fraud', 'abuse', 'price_not_honoured', 'other'];

interface Props {
  visible: boolean;
  onClose: () => void;
  targetType: ReportTarget;
  targetId: string;
  groupId?: string;
}

/** @returns Report bottom sheet */
export function ReportSheet({ visible, onClose, targetType, targetId, groupId }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const report = useCreateReport();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');

  const close = () => {
    onClose();
    report.reset();
    setReason(null);
    setDetails('');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={close}
      statusBarTranslucent
    >
      <Pressable
        className="flex-1 bg-black/40"
        onPress={close}
        accessibilityRole="button"
        accessibilityLabel={t('common.cancel')}
      />
      <View
        className="gap-4 rounded-t-card bg-surface px-5 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 16) + 8 }}
        accessibilityViewIsModal
      >
        <View className="h-1.5 w-12 self-center rounded-full bg-line" />
        <AppText variant="heading">{t(`report.title.${targetType}`)}</AppText>
        {report.isSuccess ? (
          <>
            <Notice tone="info" message={t('report.thanks')} />
            <Button label={t('common.close')} variant="secondary" onPress={close} />
          </>
        ) : (
          <>
            <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
              {REASONS.map((item) => (
                <Chip
                  key={item}
                  role="radio"
                  label={t(`report.reasons.${item}`)}
                  selected={reason === item}
                  onPress={() => setReason(item)}
                />
              ))}
            </View>
            <TextField
              label={t('report.detailsLabel')}
              value={details}
              onChangeText={setDetails}
              multiline
              maxLength={1000}
            />
            {report.error ? <Notice message={t(getErrorMessageKey(report.error))} /> : null}
            <Button
              label={t('report.send')}
              icon={Flag}
              disabled={!reason}
              loading={report.isPending}
              onPress={() =>
                reason &&
                report.mutate({
                  targetType,
                  targetId,
                  groupId,
                  reason,
                  ...(details.trim() ? { details: details.trim() } : {}),
                })
              }
            />
            <Button label={t('common.cancel')} variant="ghost" onPress={close} />
          </>
        )}
      </View>
    </Modal>
  );
}
