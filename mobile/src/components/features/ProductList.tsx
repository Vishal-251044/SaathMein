/**
 * ProductList — infinite, pull-to-refresh product list with skeleton, empty, error and
 * offline states. Used by category pages and search results.
 */
import { PackageSearch, WifiOff } from 'lucide-react-native';
import { type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';

import { EmptyState } from '@/components/features/EmptyState';
import { ProductListItem } from '@/components/features/ProductListItem';
import { Button } from '@/components/ui/Button';
import { useProductList } from '@/hooks/useProducts';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ApiClientError } from '@/services/api';
import type { ProductCard } from '@/types/catalog';
import { brand } from '@/theme/tokens';

interface ProductListProps {
  q?: string;
  categoryId?: string;
  enabled?: boolean;
  header?: ReactElement;
  emptyTitle: string;
  emptyBody: string;
  /** Action under the empty state (e.g. "Request this product"). */
  emptyAction?: ReactElement;
  onOpenProduct?: (product: ProductCard) => void;
}

/** Placeholder rows while the first page loads. */
function ListSkeleton() {
  return (
    <View className="gap-3" accessibilityLabel="Loading">
      {[0, 1, 2, 3, 4].map((key) => (
        <View key={key} className="h-20 rounded-card bg-bg-band" />
      ))}
    </View>
  );
}

/**
 * @param props.q - Search text
 * @param props.categoryId - Category filter
 * @param props.header - Content above the list (scrolls with it)
 */
export function ProductList({
  q,
  categoryId,
  enabled = true,
  header,
  emptyTitle,
  emptyBody,
  emptyAction,
  onOpenProduct,
}: ProductListProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const query = useProductList({ q, categoryId, enabled });
  const products = query.data?.pages.flatMap((page) => page.products) ?? [];
  const isOffline = query.error instanceof ApiClientError && query.error.code === 'NETWORK_ERROR';

  const renderEmpty = () => {
    if (!enabled) return null;
    if (query.isPending) return <ListSkeleton />;
    if (query.isError && !query.data) {
      return (
        <EmptyState
          icon={isOffline ? WifiOff : PackageSearch}
          title={isOffline ? t('catalog.offlineTitle') : t('errors.generic')}
          body={isOffline ? t('errors.network') : t('catalog.tryAgainBody')}
          action={
            <Button label={t('common.retry')} variant="secondary" onPress={() => query.refetch()} />
          }
        />
      );
    }
    return (
      <EmptyState icon={PackageSearch} title={emptyTitle} body={emptyBody} action={emptyAction} />
    );
  };

  return (
    <FlatList
      data={products}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <ProductListItem product={item} onOpen={onOpenProduct} />}
      ItemSeparatorComponent={() => <View className="h-3" />}
      ListHeaderComponent={header}
      ListEmptyComponent={renderEmpty}
      ListFooterComponent={
        query.isFetchingNextPage ? (
          <ActivityIndicator className="py-6" color={brand.primary} />
        ) : undefined
      }
      onEndReached={() => {
        if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
      }}
      onEndReachedThreshold={0.4}
      refreshControl={
        <RefreshControl
          refreshing={query.isRefetching && !query.isFetchingNextPage}
          onRefresh={() => {
            query.refetch();
          }}
          tintColor={colors.muted}
          colors={[brand.primary]}
        />
      }
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerClassName="w-full max-w-[640px] self-center px-4 pb-10"
      showsVerticalScrollIndicator={false}
    />
  );
}
