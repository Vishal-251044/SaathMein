/**
 * Request a missing product (CAT-5): brand, model, optional category and note. Opened from
 * empty search results, an empty category and the Profile tab. SaathMein staff see the
 * requests in the admin console and add popular ones to the catalog.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { CheckCircle2, Send } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { CategoryPicker } from '@/components/features/CategoryPicker';
import { StackScreen } from '@/components/layout/StackScreen';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { TextField } from '@/components/ui/TextField';
import { useCategories } from '@/hooks/useCatalog';
import { useRequestProduct } from '@/hooks/useMarketplace';
import { brand } from '@/theme/tokens';
import { enterUp } from '@/utils/animations';
import { getErrorMessageKey } from '@/utils/errorMessages';

const MAX_NOTE_LENGTH = 500;

/**
 * @returns Request product screen
 */
export default function RequestProductScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ q?: string; categoryId?: string }>();
  const { data: groups } = useCategories();
  const request = useRequestProduct();
  const [brandName, setBrandName] = useState('');
  const [model, setModel] = useState(params.q ?? '');
  const [categoryId, setCategoryId] = useState<string | null>(params.categoryId ?? null);
  const [note, setNote] = useState('');

  const canSend = brandName.trim().length > 0 && model.trim().length > 0;

  /** Send the request. */
  const submit = () => {
    request.mutate({
      brand: brandName.trim(),
      model: model.trim(),
      ...(categoryId ? { categoryId } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    });
  };

  if (request.isSuccess) {
    return (
      <StackScreen title={t('request.title')}>
        <Animated.View
          entering={enterUp(0)}
          className="items-center gap-3 rounded-card border border-line bg-surface px-6 py-10"
          accessibilityLiveRegion="polite"
        >
          <CheckCircle2 size={40} color={brand.primary} strokeWidth={1.8} />
          <AppText variant="heading" className="text-center">
            {t('request.sentTitle')}
          </AppText>
          <AppText variant="body" color="muted" className="text-center">
            {t('request.sentBody', { name: `${request.data.brand} ${request.data.model}` })}
          </AppText>
          <Button
            label={t('request.done')}
            onPress={() => router.back()}
            className="mt-3 self-stretch"
          />
        </Animated.View>
      </StackScreen>
    );
  }

  return (
    <StackScreen title={t('request.title')}>
      <AppText variant="body" color="muted">
        {t('request.intro')}
      </AppText>

      <View className="mt-6 gap-5">
        <TextField
          label={t('request.brand')}
          value={brandName}
          onChangeText={setBrandName}
          placeholder={t('request.brandPlaceholder')}
          autoCapitalize="words"
          maxLength={60}
          returnKeyType="next"
        />
        <TextField
          label={t('request.model')}
          value={model}
          onChangeText={setModel}
          placeholder={t('request.modelPlaceholder')}
          maxLength={120}
          returnKeyType="next"
        />

        {groups?.length ? (
          <View className="gap-3">
            <AppText variant="bodyStrong">{t('request.category')}</AppText>
            <CategoryPicker
              groups={groups}
              selectedIds={categoryId ? [categoryId] : []}
              onToggle={(id) => setCategoryId((current) => (current === id ? null : id))}
            />
          </View>
        ) : null}

        <TextField
          label={t('request.note')}
          value={note}
          onChangeText={setNote}
          placeholder={t('request.notePlaceholder')}
          multiline
          numberOfLines={3}
          maxLength={MAX_NOTE_LENGTH}
          hint={t('request.noteHint')}
        />

        {request.error ? <Notice message={t(getErrorMessageKey(request.error))} /> : null}
        <Button
          label={t('request.send')}
          icon={Send}
          loading={request.isPending}
          disabled={!canSend}
          onPress={submit}
        />
      </View>
    </StackScreen>
  );
}
