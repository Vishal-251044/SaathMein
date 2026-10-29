/**
 * ProductListItem — one product row in category lists and search results:
 * image (or icon), brand + model, and the "from" price in the user's city.
 */
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ChevronRight, Package } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { PressableScale } from '@/components/animations/PressableScale';
import { AppText } from '@/components/ui/AppText';
import { useThemeColors } from '@/hooks/useThemeColors';
import type { ProductCard } from '@/types/catalog';
import { formatINR } from '@/utils/genericFunctions';
import { sizedImageUrl } from '@/utils/imageUrl';

const THUMB_SIZE = 64;

interface ProductListItemProps {
  product: ProductCard;
  onOpen?: (product: ProductCard) => void;
}

/**
 * @param props.product - Product card from the API
 * @param props.onOpen - Called before navigating (e.g. to save a recent search)
 */
export function ProductListItem({ product, onOpen }: ProductListItemProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const imageUrl = sizedImageUrl(product.imageUrl, THUMB_SIZE);

  return (
    <PressableScale
      onPress={() => {
        onOpen?.(product);
        router.push({ pathname: '/product/[id]', params: { id: product.id } });
      }}
      accessibilityRole="button"
      accessibilityLabel={product.name}
      className="min-h-20 flex-row items-center gap-3 rounded-card border border-line bg-surface p-3"
    >
      <View
        className="items-center justify-center overflow-hidden rounded-button bg-bg-band"
        style={{ width: THUMB_SIZE, height: THUMB_SIZE }}
      >
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={{ width: THUMB_SIZE, height: THUMB_SIZE }}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <Package size={26} color={colors.muted} strokeWidth={1.8} />
        )}
      </View>
      <View className="flex-1">
        <AppText variant="label">{product.brand}</AppText>
        <AppText variant="bodyStrong" numberOfLines={2}>
          {product.model}
        </AppText>
        <AppText variant="caption" className="mt-0.5">
          {product.fromPricePaise != null
            ? t('catalog.fromPrice', { price: formatINR(product.fromPricePaise) })
            : t('catalog.priceSoon')}
        </AppText>
      </View>
      <ChevronRight size={20} color={colors.muted} strokeWidth={2} />
    </PressableScale>
  );
}
