/**
 * PhoneNumberField — Indian mobile number input with a fixed +91 prefix.
 * Accepts pasted numbers like "+91 98765 43210" or "098765 43210" and keeps 10 digits.
 */
import { TextInput, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { useThemeColors } from '@/hooks/useThemeColors';
import { cx, normaliseIndianMobile } from '@/utils/genericFunctions';

interface PhoneNumberFieldProps {
  label: string;
  value: string;
  onChange: (localNumber: string) => void;
  onSubmit?: () => void;
  hasError?: boolean;
  disabled?: boolean;
}

/**
 * @param props.label - Field label (translated)
 * @param props.value - 10-digit local number
 * @param props.onChange - Called with digits only
 */
export function PhoneNumberField({
  label,
  value,
  onChange,
  onSubmit,
  hasError = false,
  disabled = false,
}: PhoneNumberFieldProps) {
  const { colors } = useThemeColors();

  return (
    <View className="gap-2">
      <AppText variant="label" color="ink">
        {label}
      </AppText>
      <View
        className={cx(
          'min-h-14 flex-row items-center rounded-button border-2 bg-surface',
          hasError ? 'border-danger' : 'border-line',
        )}
      >
        <View className="h-full justify-center border-r border-line px-4">
          <AppText variant="heading" mono>
            +91
          </AppText>
        </View>
        <TextInput
          value={value}
          onChangeText={(text) => onChange(normaliseIndianMobile(text))}
          onSubmitEditing={onSubmit}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          returnKeyType="done"
          maxLength={14} // room for pasted "+91 " prefixes before normalising
          editable={!disabled}
          autoFocus
          placeholder="98765 43210"
          placeholderTextColor={colors.muted}
          accessibilityLabel={label}
          className="min-h-14 flex-1 px-4 font-mono text-[20px] text-ink"
        />
      </View>
    </View>
  );
}
