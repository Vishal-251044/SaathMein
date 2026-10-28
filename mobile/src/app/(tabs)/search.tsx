/**
 * Search tab. Day 1: empty state. Product and group search arrives on Day 4.
 */
import { Search } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/features/EmptyState';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';

/**
 * @returns Search screen
 */
export default function SearchScreen() {
  const { t } = useTranslation();

  return (
    <Screen>
      <ScreenHeader title={t('search.title')} />
      <EmptyState icon={Search} title={t('search.emptyTitle')} body={t('search.emptyBody')} />
    </Screen>
  );
}
