/**
 * InviteQrSheet — the group's invite as a QR (GRP-6), e.g. for a society notice board.
 * The QR holds the https share link, so any phone camera opens the group in the app
 * (Android App Links) or the share page. The code is shown too for typing.
 */
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';

const QR_SIZE = 220;

interface Props {
  visible: boolean;
  onClose: () => void;
  shareUrl: string;
  inviteCode: string;
  productName: string;
}

/** @returns QR bottom sheet */
export function InviteQrSheet({ visible, onClose, shareUrl, inviteCode, productName }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
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
        className="items-center gap-4 rounded-t-card bg-surface px-5 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 16) + 8 }}
        accessibilityViewIsModal
      >
        <View className="h-1.5 w-12 rounded-full bg-line" />
        <AppText variant="heading" className="text-center">
          {t('group.qrTitle', { name: productName })}
        </AppText>
        <View
          className="rounded-card bg-white p-4"
          accessible
          accessibilityLabel={t('group.qrA11y')}
        >
          <QRCode value={shareUrl} size={QR_SIZE} color="#12131F" backgroundColor="#FFFFFF" />
        </View>
        <AppText variant="title" mono selectable>
          {inviteCode}
        </AppText>
        <AppText variant="caption" className="text-center">
          {t('group.qrHint')}
        </AppText>
        <View className="w-full">
          <Button label={t('common.close')} variant="secondary" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}
