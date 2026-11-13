/**
 * Profile tab (ACC-2, ACC-5): photo, name, phone, city and interests with edit links,
 * language, logout, delete account, and (development builds) backend status.
 */
import { router, type Href } from 'expo-router';
import {
  ChevronRight,
  FileText,
  Heart,
  LogOut,
  MapPin,
  Gift,
  MessageSquarePlus,
  Pencil,
  Scale,
  Ticket,
  Trash2,
} from 'lucide-react-native';
import { type ComponentType, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, type ColorValue, Linking, Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { LanguageSwitcher } from '@/components/features/LanguageSwitcher';
import { ServerStatusCard } from '@/components/features/ServerStatusCard';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { useCities } from '@/hooks/useCatalog';
import { useDeleteAccount } from '@/hooks/useProfile';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useAuthStore } from '@/stores/auth.store';
import { enterUp } from '@/utils/animations';
import { getErrorMessageKey } from '@/utils/errorMessages';
import { WEB_URL } from '@/utils/constants';
import { formatIndianPhone } from '@/utils/genericFunctions';
import { localizedName } from '@/utils/localize';

/** Legal pages on the website (e-commerce rules). */
const LEGAL_LINKS = [
  { key: 'terms', path: '/legal/terms' },
  { key: 'privacy', path: '/legal/privacy' },
  { key: 'refunds', path: '/legal/refund-policy' },
  { key: 'grievance', path: '/legal/grievance-officer' },
] as const;

type IconType = ComponentType<{ size?: number; color?: ColorValue; strokeWidth?: number }>;

/** One tappable settings row. */
function ProfileRow({
  icon: Icon,
  label,
  value,
  href,
  url,
}: {
  icon: IconType;
  label: string;
  value?: string;
  href?: Href;
  /** Opens in the browser (legal pages on the website). */
  url?: string;
}) {
  const { colors } = useThemeColors();
  return (
    <Pressable
      onPress={() => {
        if (href) router.push(href);
        else if (url) Linking.openURL(url).catch(() => {});
      }}
      accessibilityRole={url ? 'link' : 'button'}
      accessibilityLabel={value ? `${label}, ${value}` : label}
      className="min-h-14 flex-row items-center gap-3 px-4 py-3"
    >
      <Icon size={20} color={colors.muted} strokeWidth={2} />
      <View className="flex-1">
        <AppText variant="bodyStrong">{label}</AppText>
        {value ? <AppText variant="caption">{value}</AppText> : null}
      </View>
      <ChevronRight size={20} color={colors.muted} strokeWidth={2} />
    </Pressable>
  );
}

/**
 * @returns Profile screen
 */
export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useThemeColors();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const refreshUser = useAuthStore((state) => state.refreshUser);
  const deleteAccount = useDeleteAccount();
  const { data: cities } = useCities();

  // Started offline: load the profile once the API is reachable
  useEffect(() => {
    if (!user) refreshUser().catch(() => {});
  }, [user, refreshUser]);

  const city = cities?.find((item) => item.id === user?.cityId);
  const area = city?.areas.find((item) => item.name === user?.area);
  const place = [localizedName(area, i18n.language), localizedName(city, i18n.language)]
    .filter(Boolean)
    .join(', ');
  const interestCount = user?.interests.categories.length ?? 0;

  /** Ask before logging out (the user will need a new OTP). */
  const confirmLogout = () => {
    Alert.alert(t('profile.logoutConfirmTitle'), t('profile.logoutConfirmBody'), [
      { text: t('profile.cancel'), style: 'cancel' },
      { text: t('profile.logout'), style: 'destructive', onPress: () => logout() },
    ]);
  };

  /** Deletion is permanent, so it needs an explicit confirmation (ACC-5). */
  const confirmDelete = () => {
    Alert.alert(t('profile.deleteConfirmTitle'), t('profile.deleteConfirmBody'), [
      { text: t('profile.cancel'), style: 'cancel' },
      {
        text: t('profile.deleteAccount'),
        style: 'destructive',
        onPress: () => deleteAccount.mutate(),
      },
    ]);
  };

  return (
    <Screen>
      <ScreenHeader title={t('profile.title')} />

      <Animated.View
        entering={enterUp(0)}
        className="flex-row items-center gap-4 rounded-card border border-line bg-surface p-5"
      >
        <Avatar url={user?.avatar?.url} name={user?.name} size={64} />
        <View className="flex-1">
          <AppText variant="heading" numberOfLines={1}>
            {user?.name || t('profile.addName')}
          </AppText>
          <AppText variant="caption" mono className="mt-0.5">
            {formatIndianPhone(user?.phone)}
          </AppText>
        </View>
        <Pressable
          onPress={() => router.push('/edit-profile')}
          accessibilityRole="button"
          accessibilityLabel={t('profile.editTitle')}
          className="h-12 w-12 items-center justify-center rounded-button bg-bg-band"
        >
          <Pencil size={18} color={colors.ink} strokeWidth={2} />
        </Pressable>
      </Animated.View>

      <Animated.View
        entering={enterUp(1)}
        className="mt-4 overflow-hidden rounded-card border border-line bg-surface"
      >
        <ProfileRow
          icon={MapPin}
          label={t('profile.city')}
          value={place || t('profile.notSet')}
          href="/edit-city"
        />
        <View className="border-t border-line" />
        <ProfileRow
          icon={Heart}
          label={t('profile.interests')}
          value={
            interestCount
              ? t('profile.interestCount', { count: interestCount })
              : t('profile.notSet')
          }
          href="/edit-interests"
        />
        <View className="border-t border-line" />
        <ProfileRow icon={Ticket} label={t('dealCodes.title')} href="/deal-codes" />
        <View className="border-t border-line" />
        <ProfileRow icon={Scale} label={t('dispute.listTitle')} href="/my-disputes" />
        <View className="border-t border-line" />
        <ProfileRow
          icon={Gift}
          label={t('wallet.profileRow')}
          value={t('wallet.profileRowHint')}
          href="/wallet"
        />
        <View className="border-t border-line" />
        <ProfileRow
          icon={MessageSquarePlus}
          label={t('request.profileRow')}
          value={t('request.profileRowHint')}
          href="/request-product"
        />
      </Animated.View>

      <AppText variant="heading" className="mb-3 mt-8">
        {t('profile.language')}
      </AppText>
      <LanguageSwitcher />

      <AppText variant="heading" className="mb-3 mt-8">
        {t('legal.title')}
      </AppText>
      <View className="overflow-hidden rounded-card border border-line bg-surface">
        {LEGAL_LINKS.map((item, index) => (
          <View key={item.path}>
            {index ? <View className="border-t border-line" /> : null}
            <ProfileRow
              icon={FileText}
              label={t(`legal.${item.key}`)}
              url={`${WEB_URL}${item.path}`}
            />
          </View>
        ))}
      </View>

      {__DEV__ ? (
        <>
          <AppText variant="heading" className="mb-3 mt-8">
            {t('profile.serverStatus')}
          </AppText>
          <ServerStatusCard />
        </>
      ) : null}

      <View className="mt-10 gap-3">
        <Button
          label={t('profile.logout')}
          icon={LogOut}
          variant="secondary"
          onPress={confirmLogout}
        />
        {deleteAccount.error ? (
          <Notice message={t(getErrorMessageKey(deleteAccount.error))} />
        ) : null}
        <Button
          label={t('profile.deleteAccount')}
          icon={Trash2}
          variant="ghost"
          onPress={confirmDelete}
          loading={deleteAccount.isPending}
        />
      </View>
    </Screen>
  );
}
