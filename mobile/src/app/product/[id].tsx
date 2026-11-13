/**
 * Product page (CAT-2, DIS-4, TRU-1): images, variants with the user's city price, specs,
 * open groups in the city, verified dealers in the city and the "Start a group" call to action.
 * "Start a group" opens the create flow, which first offers similar open groups (GRP-2).
 */
import { router, useLocalSearchParams } from 'expo-router';
import { PackageX, UsersRound } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/features/EmptyState';
import { GroupCard } from '@/components/features/GroupCard';
import { PriceBlock } from '@/components/features/PriceBlock';
import { ProductImageCarousel } from '@/components/features/ProductImageCarousel';
import { VerifiedDealersSection } from '@/components/features/VerifiedDealersSection';
import { StackHeader } from '@/components/layout/StackHeader';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { useCategories, useCities } from '@/hooks/useCatalog';
import { useProductGroups } from '@/hooks/useGroups';
import { useProduct } from '@/hooks/useProducts';
import { ApiClientError } from '@/services/api';
import { enterUp } from '@/utils/animations';
import { getErrorMessageKey } from '@/utils/errorMessages';
import { localizedName } from '@/utils/localize';
import { Skeleton } from '@/components/animations/Skeleton';

/** Skeleton while the product loads. */
function ProductSkeleton() {
  return (
    <View className="gap-4 px-4 pt-4">
      <Skeleton className="h-64 rounded-card" />
      <Skeleton className="h-6 w-2/3 rounded-button" />
      <Skeleton className="h-32 rounded-card" />
    </View>
  );
}

/**
 * @returns Product screen
 */
export default function ProductScreen() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: product, isPending, isError, error, refetch, isFetching } = useProduct(id);
  const { data: cities } = useCities();
  const { data: groups } = useCategories();
  const { data: openGroups } = useProductGroups(id);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);

  const city = cities?.find((item) => item.id === product?.cityId);
  const cityName = localizedName(city, i18n.language) || t('catalog.yourCity');
  const category = (groups ?? [])
    .flatMap((group) => group.children)
    .find((c) => c.id === product?.categoryId);
  // First variant is selected until the user picks one
  const variantKey = selectedVariant ?? product?.variants[0]?.key ?? null;
  const isNotFound = error instanceof ApiClientError && error.status === 404;

  return (
    <View className="flex-1 bg-bg">
      <StackHeader title={product?.brand ?? t('catalog.product')} />

      {isPending ? <ProductSkeleton /> : null}

      {isError && !product ? (
        <View className="px-4 pt-6">
          <EmptyState
            icon={PackageX}
            title={isNotFound ? t('catalog.notFoundTitle') : t('errors.generic')}
            body={isNotFound ? t('catalog.notFoundBody') : t(getErrorMessageKey(error))}
            action={
              isNotFound ? undefined : (
                <Button
                  label={t('common.retry')}
                  variant="secondary"
                  onPress={() => refetch()}
                  loading={isFetching}
                />
              )
            }
          />
        </View>
      ) : null}

      {product ? (
        <>
          <ScrollView
            contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
            showsVerticalScrollIndicator={false}
          >
            <ProductImageCarousel images={product.images} productName={product.name} />

            <View className="w-full max-w-[640px] gap-6 self-center px-4 pt-5">
              <Animated.View entering={enterUp(0)}>
                {category ? (
                  <AppText variant="label">{localizedName(category, i18n.language)}</AppText>
                ) : null}
                <AppText variant="title" className="mt-1">
                  {product.name}
                </AppText>
              </Animated.View>

              <Animated.View entering={enterUp(1)}>
                <PriceBlock
                  variants={product.variants}
                  prices={product.prices}
                  selectedVariant={variantKey}
                  onSelectVariant={setSelectedVariant}
                  cityName={cityName}
                />
              </Animated.View>

              {product.description ? (
                <AppText variant="body" color="muted">
                  {product.description}
                </AppText>
              ) : null}

              {Object.keys(product.specs).length ? (
                <View className="gap-3">
                  <AppText variant="heading">{t('catalog.specs')}</AppText>
                  <View className="overflow-hidden rounded-card border border-line bg-surface">
                    {Object.entries(product.specs).map(([name, value], index) => (
                      <View
                        key={name}
                        className={`flex-row justify-between gap-4 px-4 py-3 ${index > 0 ? 'border-t border-line' : ''}`}
                      >
                        <AppText variant="body" color="muted">
                          {name}
                        </AppText>
                        <AppText variant="bodyStrong" className="flex-1 text-right">
                          {String(value)}
                        </AppText>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              <View className="gap-3">
                <AppText variant="heading">{t('catalog.openGroupsIn', { city: cityName })}</AppText>
                {openGroups?.groups.length ? (
                  openGroups.groups.map((group) => (
                    <GroupCard key={group.id} group={group} hideProduct />
                  ))
                ) : (
                  <EmptyState
                    icon={UsersRound}
                    title={t('catalog.noGroupTitle')}
                    body={t('catalog.noGroupBody', { city: cityName })}
                  />
                )}
              </View>

              <VerifiedDealersSection categoryId={product.categoryId} cityName={cityName} />
            </View>
          </ScrollView>

          {/* Sticky call to action above the home indicator */}
          <View
            className="absolute bottom-0 w-full border-t border-line bg-bg px-4 pt-3"
            style={{ paddingBottom: Math.max(insets.bottom, 12) }}
          >
            <View className="w-full max-w-[640px] gap-2 self-center">
              <Button
                label={t('catalog.startGroup')}
                icon={UsersRound}
                onPress={() =>
                  router.push({
                    pathname: '/group/create',
                    params: { productId: product.id, ...(variantKey ? { variantKey } : {}) },
                  })
                }
                accessibilityHint={t('catalog.startGroupHint')}
              />
            </View>
          </View>
        </>
      ) : null}
    </View>
  );
}
