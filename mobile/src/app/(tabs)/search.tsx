/**
 * Search tab (DIS-2): typo-tolerant product search with a 300 ms debounce and recent
 * searches saved on the phone. Results show prices for the user's city.
 */
import { Clock, Search, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProductList } from '@/components/features/ProductList';
import { AppText } from '@/components/ui/AppText';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useRecentSearches } from '@/hooks/useRecentSearches';
import { useThemeColors } from '@/hooks/useThemeColors';
import { fontClassFor } from '@/theme/fonts';
import { cx } from '@/utils/genericFunctions';

const MIN_QUERY_LENGTH = 2;

/**
 * @returns Search screen
 */
export default function SearchScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const query = useDebouncedValue(text.trim(), 300);
  const { recent, add, remove, clear } = useRecentSearches();
  const isSearching = query.length >= MIN_QUERY_LENGTH;

  const recentSearches = recent.length ? (
    <View className="gap-2 pt-4">
      <View className="flex-row items-center justify-between">
        <AppText variant="heading">{t('search.recent')}</AppText>
        <Pressable
          onPress={clear}
          accessibilityRole="button"
          className="min-h-12 justify-center px-2"
        >
          <AppText variant="bodyStrong" color="primary">
            {t('search.clear')}
          </AppText>
        </Pressable>
      </View>
      {recent.map((term) => (
        <View
          key={term}
          className="min-h-12 flex-row items-center gap-3 rounded-button bg-surface px-3"
        >
          <Clock size={18} color={colors.muted} strokeWidth={2} />
          <Pressable
            onPress={() => setText(term)}
            accessibilityRole="button"
            className="min-h-12 flex-1 justify-center"
          >
            <AppText variant="body">{term}</AppText>
          </Pressable>
          <Pressable
            onPress={() => remove(term)}
            accessibilityRole="button"
            accessibilityLabel={t('search.removeRecent', { term })}
            className="h-12 w-12 items-center justify-center"
          >
            <X size={18} color={colors.muted} strokeWidth={2} />
          </Pressable>
        </View>
      ))}
    </View>
  ) : (
    <View className="items-center px-6 pt-16">
      <Search size={32} color={colors.muted} strokeWidth={1.8} />
      <AppText variant="heading" className="mt-4 text-center">
        {t('search.emptyTitle')}
      </AppText>
      <AppText variant="body" color="muted" className="mt-2 text-center">
        {t('search.emptyBody')}
      </AppText>
    </View>
  );

  return (
    <View className="flex-1 bg-bg" style={{ paddingTop: insets.top }}>
      <View className="w-full max-w-[640px] self-center px-4 pb-2 pt-3">
        <AppText variant="title" accessibilityRole="header" className="pb-3">
          {t('search.title')}
        </AppText>
        <View className="min-h-14 flex-row items-center gap-2 rounded-button border-2 border-line bg-surface px-3">
          <Search size={20} color={colors.muted} strokeWidth={2} />
          <TextInput
            value={text}
            onChangeText={setText}
            onSubmitEditing={() => add(text)}
            placeholder={t('search.placeholder')}
            placeholderTextColor={colors.muted}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            accessibilityLabel={t('search.placeholder')}
            className={cx(
              'min-h-14 flex-1 text-[17px] text-ink',
              fontClassFor('medium', i18n.language),
            )}
          />
          {text ? (
            <Pressable
              onPress={() => setText('')}
              accessibilityRole="button"
              accessibilityLabel={t('search.clearText')}
              className="h-12 w-12 items-center justify-center"
            >
              <X size={20} color={colors.muted} strokeWidth={2} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {isSearching ? (
        <ProductList
          q={query}
          header={<View className="h-3" />}
          emptyTitle={t('search.noResultsTitle', { query })}
          emptyBody={t('search.noResultsBody')}
          onOpenProduct={() => add(query)}
        />
      ) : (
        <View className="w-full max-w-[640px] self-center px-4">{recentSearches}</View>
      )}
    </View>
  );
}
