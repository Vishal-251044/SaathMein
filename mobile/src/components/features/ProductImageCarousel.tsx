/**
 * ProductImageCarousel — swipeable product images with page dots (CAT-2 product page).
 * Shows a calm placeholder when a product has no images yet.
 */
import { Image } from 'expo-image';
import { Package } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, useWindowDimensions, View } from 'react-native';

import { useThemeColors } from '@/hooks/useThemeColors';
import { cx } from '@/utils/genericFunctions';
import { sizedImageUrl } from '@/utils/imageUrl';

const MAX_WIDTH = 640;
const ASPECT = 0.75; // 4:3

interface ProductImageCarouselProps {
  images: { url: string }[];
  productName: string;
}

/**
 * @param props.images - Image URLs (first = cover)
 * @param props.productName - For accessibility labels
 */
export function ProductImageCarousel({ images, productName }: ProductImageCarouselProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const { width: windowWidth } = useWindowDimensions();
  const width = Math.min(windowWidth, MAX_WIDTH);
  const height = Math.round(width * ASPECT);
  const [index, setIndex] = useState(0);

  if (!images.length) {
    return (
      <View
        className="items-center justify-center self-center bg-bg-band"
        style={{ width, height }}
        accessibilityLabel={t('catalog.noImage')}
      >
        <Package size={56} color={colors.muted} strokeWidth={1.4} />
      </View>
    );
  }

  return (
    <View className="self-center" style={{ width }}>
      <FlatList
        data={images}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.url}
        onMomentumScrollEnd={(event) =>
          setIndex(Math.round(event.nativeEvent.contentOffset.x / width))
        }
        renderItem={({ item, index: imageIndex }) => (
          <Image
            source={{ uri: sizedImageUrl(item.url, width) ?? item.url }}
            style={{ width, height }}
            contentFit="contain"
            transition={200}
            accessibilityLabel={t('catalog.imageLabel', {
              name: productName,
              index: imageIndex + 1,
              total: images.length,
            })}
          />
        )}
      />
      {images.length > 1 ? (
        <View className="absolute bottom-3 w-full flex-row justify-center gap-1.5">
          {images.map((image, dotIndex) => (
            <View
              key={image.url}
              className={cx(
                'h-2 rounded-full',
                dotIndex === index ? 'w-5 bg-primary' : 'w-2 bg-white/80',
              )}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
