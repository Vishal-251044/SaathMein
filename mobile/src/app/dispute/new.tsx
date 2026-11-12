/**
 * Open a dispute (TRU-4) about my purchase from the winning dealer: what went wrong, the
 * price the dealer asked (price not honoured), and up to 6 photos (invoice, quotation).
 * The dealer has 48 hours to answer, then SaathMein Support decides.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { Camera, ImageUp, Scale } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StackHeader } from '@/components/layout/StackHeader';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Notice } from '@/components/ui/Notice';
import { TextField } from '@/components/ui/TextField';
import { useAddEvidence, useOpenDispute } from '@/hooks/useTrust';
import type { OpenDisputeInput } from '@/types/trust';
import { getErrorMessageKey } from '@/utils/errorMessages';

const TYPES: OpenDisputeInput['type'][] = ['price_not_honoured', 'product_issue', 'other'];
const MAX_PHOTOS = 6;

/** Rupees text → paise (or undefined). */
const toPaise = (text: string) => {
  const clean = text.replace(/[,\s₹]/g, '');
  return /^\d+(\.\d{1,2})?$/.test(clean) ? Math.round(Number(clean) * 100) : undefined;
};

/** @returns Open dispute screen */
export default function OpenDisputeScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { purchaseId } = useLocalSearchParams<{ purchaseId: string }>();
  const addEvidence = useAddEvidence();
  const open = useOpenDispute();
  const [type, setType] = useState<OpenDisputeInput['type']>('price_not_honoured');
  const [description, setDescription] = useState('');
  const [quoted, setQuoted] = useState('');
  const [photos, setPhotos] = useState<NonNullable<OpenDisputeInput['evidence']>>([]);

  const add = (source: 'camera' | 'library') =>
    addEvidence.mutate(source, {
      onSuccess: (file) => {
        if (file) setPhotos((prev) => [...prev, file].slice(0, MAX_PHOTOS));
      },
    });

  const submit = () =>
    open.mutate(
      {
        purchaseId,
        type,
        description: description.trim(),
        ...(type === 'price_not_honoured' && toPaise(quoted)
          ? { quotedPricePaise: toPaise(quoted) }
          : {}),
        evidence: photos,
      },
      {
        onSuccess: (dispute) =>
          router.replace({ pathname: '/disputes/[id]', params: { id: dispute.id } }),
      },
    );

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-bg"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StackHeader title={t('dispute.newTitle')} />
      <ScrollView
        contentContainerStyle={{ gap: 20, padding: 16, paddingBottom: 32 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
      >
        <AppText variant="body" color="muted">
          {t('dispute.newIntro')}
        </AppText>
        <View className="gap-2">
          <AppText variant="label">{t('dispute.typeLabel')}</AppText>
          <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
            {TYPES.map((item) => (
              <Chip
                key={item}
                role="radio"
                label={t(`dispute.types.${item}`)}
                selected={type === item}
                onPress={() => setType(item)}
              />
            ))}
          </View>
        </View>
        {type === 'price_not_honoured' ? (
          <TextField
            label={t('dispute.quotedLabel')}
            value={quoted}
            onChangeText={setQuoted}
            keyboardType="decimal-pad"
            placeholder="₹"
            mono
          />
        ) : null}
        <TextField
          label={t('dispute.descriptionLabel')}
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={2000}
          hint={t('dispute.descriptionHint')}
        />
        <View className="gap-2">
          <AppText variant="label">
            {t('dispute.photosLabel', { count: photos.length, max: MAX_PHOTOS })}
          </AppText>
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Button
                label={t('purchase.takePhoto')}
                icon={Camera}
                variant="secondary"
                loading={addEvidence.isPending && addEvidence.variables === 'camera'}
                disabled={addEvidence.isPending || photos.length >= MAX_PHOTOS}
                onPress={() => add('camera')}
              />
            </View>
            <View className="flex-1">
              <Button
                label={t('purchase.fromGallery')}
                icon={ImageUp}
                variant="secondary"
                loading={addEvidence.isPending && addEvidence.variables === 'library'}
                disabled={addEvidence.isPending || photos.length >= MAX_PHOTOS}
                onPress={() => add('library')}
              />
            </View>
          </View>
          {addEvidence.error ? <Notice message={t(getErrorMessageKey(addEvidence.error))} /> : null}
        </View>
        {open.error ? <Notice message={t(getErrorMessageKey(open.error))} /> : null}
        <Button
          label={t('dispute.submit')}
          icon={Scale}
          disabled={description.trim().length < 20 || !purchaseId}
          loading={open.isPending}
          onPress={submit}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
