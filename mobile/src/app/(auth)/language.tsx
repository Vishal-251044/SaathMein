/**
 * Language picker — shown once, on first launch (Day 2). Each language is written in its
 * own script so everyone can find theirs. The choice is saved and can be changed in Profile.
 */
import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { PressableScale } from '@/components/animations/PressableScale';
import { AuthScreen } from '@/components/layout/AuthScreen';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import i18n, { type AppLanguage, LANGUAGE_LABELS, SUPPORTED_LANGUAGES } from '@/i18n';
import { useSettingsStore } from '@/stores/settings.store';
import { brand } from '@/theme/tokens';
import { cx } from '@/utils/genericFunctions';

/** English name under each option, to help when the phone language differs. */
const LANGUAGE_HINTS: Record<AppLanguage, string> = { en: 'English', hi: 'Hindi', mr: 'Marathi' };

/**
 * @returns Language selection screen
 */
export default function LanguageScreen() {
  const { t } = useTranslation();
  const setLanguage = useSettingsStore((state) => state.setLanguage);
  const [selected, setSelected] = useState<AppLanguage>(useSettingsStore.getState().language);

  /** Preview the language immediately so the screen itself switches. */
  const choose = (code: AppLanguage) => {
    setSelected(code);
    i18n.changeLanguage(code);
  };

  return (
    <AuthScreen
      title={t('language.title')}
      subtitle={t('language.subtitle')}
      footer={<Button label={t('language.continue')} onPress={() => setLanguage(selected)} />}
    >
      <View className="gap-3" accessibilityRole="radiogroup">
        {SUPPORTED_LANGUAGES.map((code) => {
          const isSelected = code === selected;
          return (
            <PressableScale
              key={code}
              onPress={() => choose(code)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${LANGUAGE_LABELS[code]}, ${LANGUAGE_HINTS[code]}`}
              className={cx(
                'min-h-16 flex-row items-center justify-between rounded-card border-2 bg-surface px-5 py-4',
                isSelected ? 'border-primary' : 'border-line',
              )}
            >
              <View>
                <AppText variant="heading">{LANGUAGE_LABELS[code]}</AppText>
                {code !== 'en' ? (
                  <AppText variant="caption" className="mt-0.5">
                    {LANGUAGE_HINTS[code]}
                  </AppText>
                ) : null}
              </View>
              <View
                className={cx(
                  'h-7 w-7 items-center justify-center rounded-full border-2',
                  isSelected ? 'border-primary bg-primary' : 'border-line',
                )}
              >
                {isSelected ? <Check size={16} color={brand.white} strokeWidth={3} /> : null}
              </View>
            </PressableScale>
          );
        })}
      </View>
    </AuthScreen>
  );
}
