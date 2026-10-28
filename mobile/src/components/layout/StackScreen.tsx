/**
 * StackScreen — layout for pushed screens (edit profile, change city...): back button,
 * title and scrollable content with safe-area and keyboard handling.
 */
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { useThemeColors } from '@/hooks/useThemeColors';

interface StackScreenProps {
  title: string;
  children: ReactNode;
}

/**
 * @param props.title - Screen title (translated)
 * @param props.children - Screen content
 */
export function StackScreen({ title, children }: StackScreenProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-bg"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        className="flex-row items-center gap-3 border-b border-line bg-bg px-4 pb-3"
        style={{ paddingTop: insets.top + 8 }}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          className="h-12 w-12 items-center justify-center rounded-button bg-bg-band"
        >
          <ArrowLeft size={22} color={colors.ink} strokeWidth={2} />
        </Pressable>
        <AppText variant="heading" accessibilityRole="header" className="flex-1" numberOfLines={1}>
          {title}
        </AppText>
      </View>
      <ScrollView
        contentContainerClassName="w-full max-w-[640px] self-center px-4 pt-5"
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
