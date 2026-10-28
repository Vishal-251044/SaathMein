/**
 * My Groups tab. Day 1: empty state. Joined and led groups arrive on Day 6.
 */
import { UsersRound } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/features/EmptyState';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';

/**
 * @returns My Groups screen
 */
export default function GroupsScreen() {
  const { t } = useTranslation();

  return (
    <Screen>
      <ScreenHeader title={t('groups.title')} />
      <EmptyState icon={UsersRound} title={t('groups.emptyTitle')} body={t('groups.emptyBody')} />
    </Screen>
  );
}
