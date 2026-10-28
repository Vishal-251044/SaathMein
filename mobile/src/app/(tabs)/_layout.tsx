/**
 * Bottom tab navigator: Home, Search, My Groups, Saathi, Profile.
 * The Saathi tab turns violet when active (violet always means AI).
 */
import { Tabs } from 'expo-router';
import { CircleUserRound, House, Search, Sparkles, UsersRound } from 'lucide-react-native';
import { type ComponentType } from 'react';
import { type ColorValue } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useThemeColors } from '@/hooks/useThemeColors';
import { brand } from '@/theme/tokens';

type LucideIcon = ComponentType<{ size?: number; color?: ColorValue; strokeWidth?: number }>;

/**
 * Build a tabBarIcon renderer for a Lucide icon (thicker stroke when focused).
 * @param Icon - Lucide icon component
 * @returns tabBarIcon option
 */
function tabIcon(Icon: LucideIcon) {
  return function TabBarIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <Icon size={24} color={color} strokeWidth={focused ? 2.3 : 1.9} />;
  };
}

/**
 * @returns Tab navigator
 */
export default function TabsLayout() {
  const { t, i18n } = useTranslation();
  const { colors } = useThemeColors();
  const isDevanagari = i18n.language === 'hi' || i18n.language === 'mr';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: brand.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
        },
        tabBarLabelStyle: {
          fontFamily: isDevanagari
            ? 'NotoSansDevanagari_600SemiBold'
            : 'PlusJakartaSans_600SemiBold',
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.home'), tabBarIcon: tabIcon(House) }} />
      <Tabs.Screen
        name="search"
        options={{ title: t('tabs.search'), tabBarIcon: tabIcon(Search) }}
      />
      <Tabs.Screen
        name="groups"
        options={{ title: t('tabs.groups'), tabBarIcon: tabIcon(UsersRound) }}
      />
      <Tabs.Screen
        name="saathi"
        options={{
          title: t('tabs.saathi'),
          tabBarIcon: tabIcon(Sparkles),
          tabBarActiveTintColor: colors.ai,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: t('tabs.profile'), tabBarIcon: tabIcon(CircleUserRound) }}
      />
    </Tabs>
  );
}
