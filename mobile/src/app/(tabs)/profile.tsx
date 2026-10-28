/**
 * Profile tab. Day 1: account placeholder, language switcher and (in development builds)
 * the backend connection status. Phone login arrives on Day 2.
 */
import { CircleUserRound } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/features/EmptyState';
import { LanguageSwitcher } from '@/components/features/LanguageSwitcher';
import { ServerStatusCard } from '@/components/features/ServerStatusCard';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { AppText } from '@/components/ui/AppText';

/**
 * @returns Profile screen
 */
export default function ProfileScreen() {
  const { t } = useTranslation();

  return (
    <Screen>
      <ScreenHeader title={t('profile.title')} />
      <EmptyState
        icon={CircleUserRound}
        title={t('profile.emptyTitle')}
        body={t('profile.emptyBody')}
      />

      <AppText variant="heading" className="mb-3 mt-8">
        {t('profile.language')}
      </AppText>
      <LanguageSwitcher />

      {__DEV__ ? (
        <>
          <AppText variant="heading" className="mb-3 mt-8">
            {t('profile.serverStatus')}
          </AppText>
          <ServerStatusCard />
        </>
      ) : null}
    </Screen>
  );
}
