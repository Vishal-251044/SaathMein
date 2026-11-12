/**
 * BannerCarousel — home banners from Admin → Curation (F34): swipeable, Sunrise gradient
 * when there is no image, title in my language. Links are in-app paths only.
 */
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { FlatList, useWindowDimensions, View } from 'react-native';

import { PressableScale } from '@/components/animations/PressableScale';
import { AppText } from '@/components/ui/AppText';
import { gradients } from '@/theme/tokens';
import type { HomeBanner } from '@/types/feed';
import { sizedImageUrl } from '@/utils/imageUrl';

const HEIGHT = 150;
const GUTTER = 16;

/** Banner text in the app language, English as fallback. */
const pick = (text: string | null, translations: { hi?: string; mr?: string }, language: string) =>
  (language === 'hi' || language === 'mr' ? translations[language] : undefined) || text || '';

/** @param props.banners - Active banners for my city */
export function BannerCarousel({ banners }: { banners: HomeBanner[] }) {
  const { i18n } = useTranslation();
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - GUTTER * 2, 520);
  if (!banners.length) return null;

  return (
    <FlatList
      horizontal
      data={banners}
      keyExtractor={(banner) => banner.id}
      showsHorizontalScrollIndicator={false}
      snapToInterval={cardWidth + 12}
      decelerationRate="fast"
      contentContainerStyle={{ gap: 12 }}
      className="-mx-4 px-4"
      renderItem={({ item }) => {
        const title = pick(item.title, item.titleTranslations, i18n.language);
        const subtitle = pick(item.subtitle, item.subtitleTranslations, i18n.language);
        const imageUrl = sizedImageUrl(item.imageUrl, cardWidth);
        return (
          <PressableScale
            disabled={!item.linkPath}
            onPress={() => item.linkPath && router.push(item.linkPath as Href)}
            accessibilityRole={item.linkPath ? 'link' : 'image'}
            accessibilityLabel={[title, subtitle].filter(Boolean).join('. ')}
            className="overflow-hidden rounded-card"
            style={{ width: cardWidth, height: HEIGHT }}
          >
            {imageUrl ? (
              <Image
                source={{ uri: imageUrl }}
                style={{ width: cardWidth, height: HEIGHT }}
                contentFit="cover"
              />
            ) : (
              <LinearGradient
                colors={gradients.sunrise}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ width: cardWidth, height: HEIGHT }}
              />
            )}
            <View className="absolute inset-x-0 bottom-0 gap-0.5 bg-black/35 px-4 py-3">
              <AppText variant="heading" color="white" numberOfLines={2}>
                {title}
              </AppText>
              {subtitle ? (
                <AppText variant="caption" color="whiteSoft" numberOfLines={1}>
                  {subtitle}
                </AppText>
              ) : null}
            </View>
          </PressableScale>
        );
      }}
    />
  );
}
