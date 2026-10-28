/**
 * TextField — labelled text input with error text. Uses the language-aware font so
 * Hindi and Marathi typing renders correctly.
 */
import { useTranslation } from 'react-i18next';
import { TextInput, type TextInputProps, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { useThemeColors } from '@/hooks/useThemeColors';
import { fontClassFor } from '@/theme/fonts';
import { cx } from '@/utils/genericFunctions';

interface TextFieldProps extends Omit<TextInputProps, 'className'> {
  label: string;
  error?: string | null;
  hint?: string;
  mono?: boolean;
}

/**
 * @param props.label - Visible label (translated)
 * @param props.error - Error message (translated)
 * @param props.hint - Helper text (translated)
 */
export function TextField({ label, error, hint, mono = false, ...inputProps }: TextFieldProps) {
  const { i18n } = useTranslation();
  const { colors } = useThemeColors();

  return (
    <View className="gap-2">
      <AppText variant="label" color="ink">
        {label}
      </AppText>
      <TextInput
        placeholderTextColor={colors.muted}
        accessibilityLabel={label}
        className={cx(
          'min-h-14 rounded-button border-2 bg-surface px-4 text-[17px] text-ink',
          mono ? 'font-mono' : fontClassFor('medium', i18n.language),
          error ? 'border-danger' : 'border-line',
        )}
        {...inputProps}
      />
      {error ? (
        <AppText variant="caption" color="danger">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption">{hint}</AppText>
      ) : null}
    </View>
  );
}
