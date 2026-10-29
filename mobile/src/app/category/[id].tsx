/**
 * Category screen — all live products in one category, with prices for the user's city.
 */
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ProductList } from '@/components/features/ProductList';
import { RequestProductButton } from '@/components/features/RequestProductButton';
import { StackHeader } from '@/components/layout/StackHeader';
import { useCategories } from '@/hooks/useCatalog';
import { localizedName } from '@/utils/localize';

/**
 * @returns Category product list
 */
export default function CategoryScreen() {
  const { t, i18n } = useTranslation();
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const { data: groups } = useCategories();
  const category = (groups ?? []).flatMap((group) => group.children).find((c) => c.id === id);
  const title = category ? localizedName(category, i18n.language) : (name ?? t('catalog.products'));

  return (
    <View className="flex-1 bg-bg">
      <StackHeader title={title} />
      <ProductList
        categoryId={id}
        header={<View className="h-4" />}
        emptyTitle={t('catalog.emptyCategoryTitle')}
        emptyBody={t('catalog.emptyCategoryBody')}
        emptyAction={<RequestProductButton categoryId={id} />}
      />
    </View>
  );
}
