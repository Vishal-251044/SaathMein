/**
 * PriceBlock — the city price on the product page, with a variant picker.
 * Shows each known price (ex-showroom, on-road, MRP) for the selected variant; falls back
 * to the whole-product price when a variant has none of its own.
 */
import { MapPin } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Chip } from '@/components/ui/Chip';
import { useThemeColors } from '@/hooks/useThemeColors';
import type { ProductPrice, ProductVariant } from '@/types/catalog';
import { formatINR } from '@/utils/genericFunctions';

interface PriceBlockProps {
  variants: ProductVariant[];
  prices: ProductPrice[];
  selectedVariant: string | null;
  onSelectVariant: (key: string | null) => void;
  cityName: string;
}

/**
 * Price entry for a variant (or the whole product).
 * @param prices - City prices
 * @param variantKey - Selected variant
 * @returns Matching entry, or the whole-product entry
 */
const priceFor = (prices: ProductPrice[], variantKey: string | null) =>
  prices.find((price) => price.variantKey === variantKey) ??
  prices.find((price) => price.variantKey === null) ??
  null;

/**
 * @param props.variants - Product variants
 * @param props.prices - Prices for the buyer's city
 * @param props.cityName - Localized city name
 */
export function PriceBlock({
  variants,
  prices,
  selectedVariant,
  onSelectVariant,
  cityName,
}: PriceBlockProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const price = priceFor(prices, selectedVariant);

  const rows = price
    ? [
        { key: 'exShowroom', label: t('catalog.exShowroom'), value: price.exShowroomPaise },
        { key: 'onRoad', label: t('catalog.onRoad'), value: price.onRoadPaise },
        { key: 'mrp', label: t('catalog.mrp'), value: price.mrpPaise },
      ].filter((row) => row.value != null)
    : [];

  return (
    <View className="gap-4 rounded-card border border-line bg-surface p-5">
      {variants.length ? (
        <View className="gap-2">
          <AppText variant="label">{t('catalog.variant')}</AppText>
          <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
            {variants.map((variant) => (
              <Chip
                key={variant.key}
                role="radio"
                label={variant.name}
                selected={selectedVariant === variant.key}
                onPress={() => onSelectVariant(variant.key)}
              />
            ))}
          </View>
        </View>
      ) : null}

      <View className="flex-row items-center gap-1">
        <MapPin size={14} color={colors.muted} strokeWidth={2} />
        <AppText variant="caption">{t('catalog.priceIn', { city: cityName })}</AppText>
      </View>

      {rows.length ? (
        <View className="gap-2">
          {rows.map((row, index) => (
            <View key={row.key} className="flex-row items-baseline justify-between gap-3">
              <AppText
                variant={index === 0 ? 'bodyStrong' : 'body'}
                color={index === 0 ? 'ink' : 'muted'}
              >
                {row.label}
              </AppText>
              <AppText variant={index === 0 ? 'title' : 'bodyStrong'} mono>
                {formatINR(row.value as number)}
              </AppText>
            </View>
          ))}
          <AppText variant="caption">{t('catalog.priceNote')}</AppText>
        </View>
      ) : (
        <AppText variant="body" color="muted">
          {t('catalog.noCityPrice')}
        </AppText>
      )}
    </View>
  );
}
