/**
 * OtpInput — six code boxes backed by one hidden TextInput, so paste and Android SMS
 * autofill (autoComplete="sms-otp") fill every box at once. The active box is highlighted.
 */
import { type ComponentRef, useRef } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { cx } from '@/utils/genericFunctions';

const CODE_LENGTH = 6;

interface OtpInputProps {
  value: string;
  onChange: (code: string) => void;
  /** Called once all 6 digits are entered. */
  onComplete?: (code: string) => void;
  hasError?: boolean;
  disabled?: boolean;
  accessibilityLabel: string;
}

/**
 * @param props.value - Current digits
 * @param props.onChange - Called with digits only (max 6)
 * @param props.onComplete - Called when the code is complete
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  hasError = false,
  disabled = false,
  accessibilityLabel,
}: OtpInputProps) {
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const digits = value.split('');

  /** Keep digits only, then notify when complete. */
  const handleChange = (text: string) => {
    const code = text.replace(/\D/g, '').slice(0, CODE_LENGTH);
    onChange(code);
    if (code.length === CODE_LENGTH) onComplete?.(code);
  };

  return (
    <Pressable onPress={() => inputRef.current?.focus()} disabled={disabled}>
      <View className="flex-row justify-between gap-2">
        {Array.from({ length: CODE_LENGTH }, (_, index) => {
          const isActive = !disabled && index === Math.min(value.length, CODE_LENGTH - 1);
          return (
            <View
              key={index}
              className={cx(
                'h-14 flex-1 items-center justify-center rounded-button border-2 bg-surface',
                hasError ? 'border-danger' : isActive ? 'border-primary' : 'border-line',
              )}
            >
              <AppText variant="title" mono>
                {digits[index] ?? ''}
              </AppText>
            </View>
          );
        })}
      </View>

      {/* Invisible input that receives typing, paste and SMS autofill */}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={CODE_LENGTH}
        autoFocus
        editable={!disabled}
        caretHidden
        accessibilityLabel={accessibilityLabel}
        className="absolute inset-0 opacity-0"
      />
    </Pressable>
  );
}
