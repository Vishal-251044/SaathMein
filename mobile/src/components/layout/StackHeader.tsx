/**
 * StackHeader — back button + title bar for pushed screens that manage their own scrolling
 * (lists). StackScreen uses the same look for scrollable forms.
 */
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { useThemeColors } from '@/hooks/useThemeColors';

interface StackHeaderProps {
  title: string;
  /** Optional element on the right. */
  trailing?: ReactNode;
}

/**
 * @param props.title - Screen title (translated)
 */
export function StackHeader({ title, trailing }: StackHeaderProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-row items-center gap-3 border-b border-line bg-bg px-4 pb-3"
      style={{ paddingTop: insets.top + 8 }}
    >
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        accessibilityRole="button"
        accessibilityLabel={t('common.back')}
        className="h-12 w-12 items-center justify-center rounded-button bg-bg-band"
      >
        <ArrowLeft size={22} color={colors.ink} strokeWidth={2} />
      </Pressable>
      <AppText variant="heading" accessibilityRole="header" className="flex-1" numberOfLines={1}>
        {title}
      </AppText>
      {trailing}
    </View>
  );
}
