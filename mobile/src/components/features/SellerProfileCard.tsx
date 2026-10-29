/**
 * SellerProfileCard — a verified dealer as buyers see it (TRU-1): business name, area,
 * rating (or "New dealer"), verified badge and distance. Never shows phone numbers.
 */
import { BadgeCheck, MapPin, Star, Store } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { useThemeColors } from '@/hooks/useThemeColors';
import { brand } from '@/theme/tokens';
import type { PublicSeller } from '@/types/seller';

interface SellerProfileCardProps {
  seller: PublicSeller;
}

/**
 * @param props.seller - Public dealer card from the API
 */
export function SellerProfileCard({ seller }: SellerProfileCardProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const details = [
    seller.area,
    seller.distanceKm != null ? t('sellers.distance', { km: seller.distanceKm }) : null,
  ].filter(Boolean);

  return (
    <View
      className="flex-row items-center gap-3 rounded-card border border-line bg-surface p-4"
      accessible
      accessibilityLabel={[
        seller.businessName,
        seller.verified ? t('sellers.verified') : null,
        seller.rating != null
          ? t('sellers.ratingA11y', { rating: seller.rating.toFixed(1), count: seller.ratingCount })
          : t('sellers.newDealer'),
        ...details,
      ]
        .filter(Boolean)
        .join(', ')}
    >
      <View className="h-12 w-12 items-center justify-center rounded-button bg-bg-band">
        <Store size={22} color={colors.ink} strokeWidth={2} />
      </View>
      <View className="flex-1 gap-0.5">
        <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
          <AppText variant="bodyStrong" numberOfLines={1} className="shrink">
            {seller.businessName}
          </AppText>
          {seller.verified ? (
            <View className="flex-row items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5">
              <BadgeCheck size={13} color={brand.primary} strokeWidth={2.2} />
              <AppText variant="label" color="primary">
                {t('sellers.verified')}
              </AppText>
            </View>
          ) : null}
        </View>
        <View className="flex-row flex-wrap items-center gap-x-3 gap-y-0.5">
          <View className="flex-row items-center gap-1">
            <Star size={13} color={colors.ink} strokeWidth={2} />
            <AppText variant="caption" color={seller.rating != null ? 'ink' : 'muted'}>
              {seller.rating != null
                ? t('sellers.rating', {
                    rating: seller.rating.toFixed(1),
                    count: seller.ratingCount,
                  })
                : t('sellers.newDealer')}
            </AppText>
          </View>
          {details.length ? (
            <View className="flex-row items-center gap-1">
              <MapPin size={13} color={colors.muted} strokeWidth={2} />
              <AppText variant="caption">{details.join(' · ')}</AppText>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}
