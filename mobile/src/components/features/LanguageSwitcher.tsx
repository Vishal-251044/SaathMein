/**
 * LanguageSwitcher — segmented control for English / हिन्दी / मराठी (ACC-2).
 * Each option is written in its own script so users can always find their language.
 */
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { LANGUAGE_LABELS, SUPPORTED_LANGUAGES } from '@/i18n';
import { useSettingsStore } from '@/stores/settings.store';
import { cx } from '@/utils/genericFunctions';

/**
 * @returns Three-option language selector
 */
export function LanguageSwitcher() {
  const language = useSettingsStore((state) => state.language);
  const setLanguage = useSettingsStore((state) => state.setLanguage);

  return (
    <View className="flex-row gap-1 rounded-button bg-bg-band p-1" accessibilityRole="radiogroup">
      {SUPPORTED_LANGUAGES.map((code) => {
        const isActive = code === language;
        return (
          <Pressable
            key={code}
            onPress={() => setLanguage(code)}
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
