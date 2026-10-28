/**
 * Profile tab. Day 2: the logged-in account, language switcher, logout and (in development
 * builds) the backend connection status. Name, photo and city editing arrive on Day 3.
 */
import { CircleUserRound, LogOut } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { LanguageSwitcher } from '@/components/features/LanguageSwitcher';
import { ServerStatusCard } from '@/components/features/ServerStatusCard';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useAuthStore } from '@/stores/auth.store';
import { enterUp } from '@/utils/animations';
import { formatIndianPhone } from '@/utils/genericFunctions';

/**
 * @returns Profile screen
 */
export default function ProfileScreen() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const refreshUser = useAuthStore((state) => state.refreshUser);

  // Started offline: load the profile once the API is reachable
  useEffect(() => {
    if (!user) refreshUser().catch(() => {});
  }, [user, refreshUser]);

  /** Ask before logging out (the user will need a new OTP). */
  const confirmLogout = () => {
    Alert.alert(t('profile.logoutConfirmTitle'), t('profile.logoutConfirmBody'), [
      { text: t('profile.cancel'), style: 'cancel' },
      { text: t('profile.logout'), style: 'destructive', onPress: () => logout() },
    ]);
  };

  return (
    <Screen>
      <ScreenHeader title={t('profile.title')} />

      <Animated.View
        entering={enterUp(0)}
        className="flex-row items-center gap-4 rounded-card border border-line bg-surface p-5"
      >
        <View className="h-14 w-14 items-center justify-center rounded-full bg-bg-band">
          <CircleUserRound size={30} color={colors.muted} strokeWidth={1.8} />
        </View>
        <View className="flex-1">
          <AppText variant="label">{t('profile.phone')}</AppText>
          <AppText variant="heading" mono className="mt-0.5">
            {formatIndianPhone(user?.phone)}
          </AppText>
          <AppText variant="caption" className="mt-1">
            {t('profile.accountBody')}
          </AppText>
        </View>
      </Animated.View>

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

      <Button
        label={t('profile.logout')}
        icon={LogOut}
        variant="secondary"
        onPress={confirmLogout}
        className="mt-10"
      />
    </Screen>
  );
}
