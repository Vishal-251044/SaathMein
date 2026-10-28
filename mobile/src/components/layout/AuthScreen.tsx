/**
 * AuthScreen — layout for login screens: safe areas, keyboard avoidance, the brand mark,
 * a title block, scrollable content and a footer pinned above the keyboard.
 */
import { type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { LogoMark } from '@/components/ui/LogoMark';
import { enterUp } from '@/utils/animations';

interface AuthScreenProps {
  title: string;
  subtitle?: string;
  /** Optional element above the logo (e.g. a back button). */
  header?: ReactNode;
  children: ReactNode;
  /** Primary action area, kept above the keyboard. */
  footer?: ReactNode;
}

/**
 * @param props.title - Screen title (translated)
 * @param props.subtitle - Line under the title (translated)
 */
export function AuthScreen({ title, subtitle, header, children, footer }: AuthScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-bg"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerClassName="grow px-5 pb-6"
        contentContainerStyle={{ paddingTop: insets.top + 12 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="w-full max-w-[480px] self-center">
          {header}
          <Animated.View entering={enterUp(0)} className="mt-6">
            <LogoMark size={52} />
            <AppText variant="title" accessibilityRole="header" className="mt-6">
              {title}
            </AppText>
            {subtitle ? (
              <AppText variant="body" color="muted" className="mt-2">
                {subtitle}
              </AppText>
            ) : null}
          </Animated.View>
          <Animated.View entering={enterUp(1)} className="mt-8">
            {children}
          </Animated.View>
        </View>
      </ScrollView>

      {footer ? (
        <View
          className="w-full max-w-[480px] self-center px-5 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}
        >
          {footer}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
