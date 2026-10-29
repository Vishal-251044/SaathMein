/**
 * CategoryGrid — Home "Browse categories" (Day 4): a two-column grid of sub-categories
 * with icons; tapping opens the category's products.
 */
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { PressableScale } from '@/components/animations/PressableScale';
import { AppText } from '@/components/ui/AppText';
import { useCategories } from '@/hooks/useCatalog';
import { brand } from '@/theme/tokens';
import { enterUp } from '@/utils/animations';
import { categoryIcon } from '@/utils/categoryIcons';
import { localizedName } from '@/utils/localize';

/**
 * @returns Category grid (skeleton while loading; hidden when categories cannot load)
 */
export function CategoryGrid() {
  const { t, i18n } = useTranslation();
  const { data: groups, isPending } = useCategories();
  const categories = (groups ?? []).flatMap((group) => group.children);

  if (isPending) {
    return (
      <View className="flex-row flex-wrap gap-3">
        {[0, 1, 2, 3].map((key) => (
          <View key={key} className="h-24 grow basis-[45%] rounded-card bg-bg-band" />
        ))}
      </View>
    );
  }
  if (!categories.length) return null;

  return (
    <View className="flex-row flex-wrap gap-3">
      {categories.map((category, index) => {
        const Icon = categoryIcon(category.icon);
        const name = localizedName(category, i18n.language);
        return (
          <Animated.View
            key={category.id}
            entering={enterUp(index, 40)}
            className="grow basis-[45%]"
          >
            <PressableScale
              onPress={() =>
                router.push({ pathname: '/category/[id]', params: { id: category.id, name } })
              }
              accessibilityRole="button"
              accessibilityLabel={t('catalog.openCategory', { name })}
              className="min-h-24 justify-between gap-3 rounded-card border border-line bg-surface p-4"
            >
              <View className="h-10 w-10 items-center justify-center rounded-button bg-primary/10">
                <Icon size={22} color={brand.primary} strokeWidth={2} />
              </View>
              <AppText variant="bodyStrong" numberOfLines={2}>
                {name}
              </AppText>
            </PressableScale>
          </Animated.View>
        );
      })}
    </View>
  );
}
