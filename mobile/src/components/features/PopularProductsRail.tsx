/**
 * PopularProductsRail — "Popular in {city}" horizontal rail on Home: the products most
 * buyers in the city are looking at. Swipeable, with skeleton and retry states.
 */
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Package, RefreshCw } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { FlatList, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { PressableScale } from '@/components/animations/PressableScale';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { usePopularProducts } from '@/hooks/useProducts';
import { useThemeColors } from '@/hooks/useThemeColors';
import type { ProductCard } from '@/types/catalog';
import { enterUp } from '@/utils/animations';
import { formatINR } from '@/utils/genericFunctions';
import { sizedImageUrl } from '@/utils/imageUrl';

const CARD_WIDTH = 156;
const IMAGE_HEIGHT = 112;

/** One product card in the rail. */
function RailCard({ product }: { product: ProductCard }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const imageUrl = sizedImageUrl(product.imageUrl, CARD_WIDTH);

  return (
    <PressableScale
      onPress={() => router.push({ pathname: '/product/[id]', params: { id: product.id } })}
      accessibilityRole="button"
      accessibilityLabel={product.name}
      className="overflow-hidden rounded-card border border-line bg-surface"
      style={{ width: CARD_WIDTH }}
    >
      <View className="items-center justify-center bg-bg-band" style={{ height: IMAGE_HEIGHT }}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={{ width: CARD_WIDTH, height: IMAGE_HEIGHT }}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <Package size={28} color={colors.muted} strokeWidth={1.8} />
        )}
      </View>
      <View className="gap-0.5 p-3">
        <AppText variant="label" numberOfLines={1}>
          {product.brand}
        </AppText>
        <AppText variant="bodyStrong" numberOfLines={2}>
          {product.model}
        </AppText>
        <AppText variant="caption" numberOfLines={1}>
          {product.fromPricePaise != null
            ? t('catalog.fromPrice', { price: formatINR(product.fromPricePaise) })
            : t('catalog.priceSoon')}
        </AppText>
      </View>
    </PressableScale>
  );
}

interface PopularProductsRailProps {
  cityName: string;
}

/**
 * @param props.cityName - Buyer's city name (translated)
 */
export function PopularProductsRail({ cityName }: PopularProductsRailProps) {
  const { t } = useTranslation();
  const { data, isPending, isError, refetch, isFetching } = usePopularProducts();

  // Nothing live yet: hide the rail rather than show an empty strip
  if (data && data.length === 0) return null;

  return (
    <Animated.View entering={enterUp(1)} className="mt-8">
      <AppText variant="heading" className="mb-3">
        {t('home.popularIn', { city: cityName })}
      </AppText>

      {isPending ? (
        <View className="flex-row gap-3" accessibilityLabel={t('common.loading')}>
          {[0, 1, 2].map((key) => (
            <View
              key={key}
              className="rounded-card bg-bg-band"
              style={{ width: CARD_WIDTH, height: IMAGE_HEIGHT + 88 }}
            />
          ))}
        </View>
      ) : null}

      {isError ? (
        <View className="items-start gap-3 rounded-card border border-line bg-surface p-4">
          <AppText variant="body" color="muted">
            {t('home.popularError')}
          </AppText>
          <Button
            label={t('common.retry')}
            icon={RefreshCw}
            variant="secondary"
            onPress={() => refetch()}
            loading={isFetching}
          />
        </View>
      ) : null}

      {data ? (
        <FlatList
          horizontal
          data={data}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <RailCard product={item} />}
          ItemSeparatorComponent={() => <View className="w-3" />}
          showsHorizontalScrollIndicator={false}
          // Let the rail bleed to the screen edge while the first card lines up with content
          style={{ marginHorizontal: -16 }}
          contentContainerStyle={{ paddingHorizontal: 16 }}
          snapToInterval={CARD_WIDTH + 12}
          decelerationRate="fast"
        />
      ) : null}
    </Animated.View>
  );
}
