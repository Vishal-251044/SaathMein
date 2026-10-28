/**
 * LanguageSwitcher — segmented control for English / हिन्दी / मराठी (ACC-2).
 * Each option is written in its own script so users can always find their language.
 * The choice is saved on the phone and, when logged in, on the account.
 */
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { useUpdateProfile } from '@/hooks/useProfile';
import { type AppLanguage, LANGUAGE_LABELS, SUPPORTED_LANGUAGES } from '@/i18n';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import { cx } from '@/utils/genericFunctions';

/**
 * @returns Three-option language selector
 */
export function LanguageSwitcher() {
  const language = useSettingsStore((state) => state.language);
  const setLanguage = useSettingsStore((state) => state.setLanguage);
  const isSignedIn = useAuthStore((state) => state.status === 'signedIn');
  const updateProfile = useUpdateProfile();

  /** Switch the UI now; sync to the account in the background. */
  const choose = (code: AppLanguage) => {
    if (code === language) return;
    setLanguage(code);
    if (isSignedIn) updateProfile.mutate({ language: code });
  };

  return (
    <View className="flex-row gap-1 rounded-button bg-bg-band p-1" accessibilityRole="radiogroup">
      {SUPPORTED_LANGUAGES.map((code) => {
        const isActive = code === language;
        return (
          <Pressable
            key={code}
            onPress={() => choose(code)}
            accessibilityRole="radio"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={LANGUAGE_LABELS[code]}
            className={cx(
              'min-h-12 flex-1 items-center justify-center rounded-[10px]',
              isActive && 'bg-surface',
            )}
          >
            <AppText variant="bodyStrong" color={isActive ? 'ink' : 'muted'}>
              {LANGUAGE_LABELS[code]}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
