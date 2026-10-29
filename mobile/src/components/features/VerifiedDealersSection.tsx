/**
 * VerifiedDealersSection — "Verified dealers in {city}" on the product page (TRU-1):
 * dealers who sell this category in the buyer's city. They compete in the auction when a
 * group fills up.
 */
import { RefreshCw, Store } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { EmptyState } from '@/components/features/EmptyState';
import { SellerProfileCard } from '@/components/features/SellerProfileCard';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { useVerifiedSellers } from '@/hooks/useMarketplace';
import { getErrorMessageKey } from '@/utils/errorMessages';

const MAX_SHOWN = 5;

interface VerifiedDealersSectionProps {
  categoryId: string | null;
  cityName: string;
}

/**
 * @param props.categoryId - Product's category
 * @param props.cityName - Buyer's city name (translated)
 */
export function VerifiedDealersSection({ categoryId, cityName }: VerifiedDealersSectionProps) {
  const { t } = useTranslation();
  const { data, isPending, isError, error, refetch, isFetching } = useVerifiedSellers(categoryId);
  const sellers = data?.slice(0, MAX_SHOWN) ?? [];

  return (
    <View className="gap-3">
      <View>
        <AppText variant="heading">{t('sellers.title', { city: cityName })}</AppText>
        <AppText variant="caption" className="mt-0.5">
          {t('sellers.subtitle')}
        </AppText>
      </View>

      {isPending ? (
        <View className="gap-3" accessibilityLabel={t('common.loading')}>
          {[0, 1].map((key) => (
            <View key={key} className="h-20 rounded-card bg-bg-band" />
          ))}
        </View>
      ) : null}

      {isError ? (
        <EmptyState
          icon={Store}
          title={t('errors.generic')}
          body={t(getErrorMessageKey(error))}
          action={
            <Button
              label={t('common.retry')}
              icon={RefreshCw}
              variant="secondary"
              onPress={() => refetch()}
              loading={isFetching}
            />
          }
        />
      ) : null}

      {data && sellers.length === 0 ? (
        <EmptyState icon={Store} title={t('sellers.emptyTitle')} body={t('sellers.emptyBody')} />
      ) : null}

      {sellers.map((seller) => (
        <SellerProfileCard key={seller.id} seller={seller} />
      ))}
    </View>
  );
}
