/**
 * AuthScreen — layout for login screens: safe areas, keyboard avoidance, the brand mark,
 * a title block, scrollable content and a footer pinned above the keyboard. Two soft
 * Sunrise glows drift behind the top of the screen and the logo pops in (decoration only:
 * transform / opacity, off with reduce motion).
 */
import { LinearGradient } from 'expo-linear-gradient';
import { type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Float } from '@/components/animations/Effects';
import { AppText } from '@/components/ui/AppText';
import { LogoMark } from '@/components/ui/LogoMark';
import { useThemeColors } from '@/hooks/useThemeColors';
import { gradients } from '@/theme/tokens';
import { enterPop, enterUp } from '@/utils/animations';

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
  const { scheme } = useThemeColors();
  const glow = scheme === 'dark' ? 0.22 : 0.16;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-bg"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Decorative Sunrise glows behind the header */}
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 320, overflow: 'hidden' }}
      >
        <Float distance={10} style={{ position: 'absolute', top: -90, right: -70, opacity: glow }}>
          <LinearGradient
            colors={gradients.sunrise}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ width: 260, height: 260, borderRadius: 130 }}
          />
        </Float>
        <Float
          distance={8}
          delay={1200}
          style={{ position: 'absolute', top: 60, left: -80, opacity: glow * 0.8 }}
        >
          <LinearGradient
            colors={[gradients.sunrise[2], gradients.sunrise[1]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ width: 180, height: 180, borderRadius: 90 }}
          />
        </Float>
      </View>
      <ScrollView
        contentContainerClassName="grow px-5 pb-6"
        contentContainerStyle={{ paddingTop: insets.top + 12 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="w-full max-w-[480px] self-center">
          {header}
          <Animated.View entering={enterUp(0)} className="mt-6">
            <Animated.View entering={enterPop} className="self-start">
              <LogoMark size={52} />
            </Animated.View>
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
