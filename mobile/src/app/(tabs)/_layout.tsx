/**
 * Bottom tab navigator: Home, Search, My Groups, Saathi, Profile, drawn by AnimatedTabBar
 * (sliding pill, lifting icons, selection haptic). The Saathi tab is violet when active
 * (violet always means AI).
 */
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AnimatedTabBar } from '@/components/layout/AnimatedTabBar';

/**
 * @returns Tab navigator
 */
export default function TabsLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      tabBar={(props) => <AnimatedTabBar {...props} />}
      screenOptions={{ headerShown: false, animation: 'fade' }}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.home') }} />
      <Tabs.Screen name="search" options={{ title: t('tabs.search') }} />
      <Tabs.Screen name="groups" options={{ title: t('tabs.groups') }} />
      <Tabs.Screen name="saathi" options={{ title: t('tabs.saathi') }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile') }} />
    </Tabs>
  );
}
