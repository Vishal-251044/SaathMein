/**
 * ReviewSheet — rate the dealer after a completed purchase (TRU-2): 1–5 stars (48 dp
 * touch targets) and an optional comment. Bottom sheet; only completed buyers see it.
 */
import { Star } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { TextField } from '@/components/ui/TextField';
import { useCreateReview } from '@/hooks/usePurchase';
import { useThemeColors } from '@/hooks/useThemeColors';
import type { GroupPurchase } from '@/types/group';
import { getErrorMessageKey } from '@/utils/errorMessages';

const STARS = [1, 2, 3, 4, 5];

interface Props {
  purchase: GroupPurchase;
  dealerName: string | null;
  visible: boolean;
  onClose: () => void;
}

/** @returns Review bottom sheet */
export function ReviewSheet({ purchase, dealerName, visible, onClose }: Props) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const review = useCreateReview(purchase.groupId);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');

  const submit = () =>
    review.mutate(
      { purchaseId: purchase.id, rating, ...(text.trim() ? { text: text.trim() } : {}) },
      { onSuccess: onClose },
    );

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
        <AppText variant="heading">
          {t('purchase.reviewTitle', { name: dealerName ?? t('purchase.theDealer') })}
        </AppText>
        <View className="flex-row justify-center gap-1" accessibilityRole="radiogroup">
          {STARS.map((value) => (
            <Pressable
              key={value}
              onPress={() => setRating(value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: rating === value }}
              accessibilityLabel={t('purchase.starsA11y', { count: value })}
              className="h-12 w-12 items-center justify-center"
            >
              <Star
                size={32}
                strokeWidth={1.75}
                color={value <= rating ? colors.warning : colors.muted}
                fill={value <= rating ? colors.warning : 'transparent'}
              />
            </Pressable>
          ))}
        </View>
        <TextField
          label={t('purchase.reviewTextLabel')}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={1000}
          placeholder={t('purchase.reviewTextHint')}
        />
        {review.error ? <Notice message={t(getErrorMessageKey(review.error))} /> : null}
        <Button
          label={t('purchase.submitReview')}
          disabled={rating === 0}
          loading={review.isPending}
          onPress={submit}
        />
        <Button label={t('common.cancel')} variant="ghost" onPress={onClose} />
      </View>
    </Modal>
  );
}
