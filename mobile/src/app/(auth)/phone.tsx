/**
 * Phone screen — step 1 of login (ACC-1). The API checks abuse limits first (ACC-4),
 * then Firebase sends the 6-digit SMS code.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { PhoneNumberField } from '@/components/features/PhoneNumberField';
import { AuthScreen } from '@/components/layout/AuthScreen';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { getDeviceId } from '@/lib/deviceId';
import { isPhoneAuthAvailable, sendOtp } from '@/lib/phoneAuth';
import { requestOtp } from '@/services/auth.service';
import { getErrorMessageKey } from '@/utils/errorMessages';
import { INDIAN_MOBILE_REGEX, toIndianE164 } from '@/utils/genericFunctions';

/**
 * @returns Phone number entry screen
 */
export default function PhoneScreen() {
  const { t } = useTranslation();
  const [localNumber, setLocalNumber] = useState('');
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const canUsePhoneAuth = isPhoneAuthAvailable();
  const isValid = INDIAN_MOBILE_REGEX.test(localNumber);

  /** Ask the API for permission, send the SMS, then open the OTP screen. */
  const handleSendCode = async () => {
    if (!isValid || isSending) return;
    setErrorKey(null);
    setIsSending(true);
    try {
      const phone = toIndianE164(localNumber);
      await requestOtp(phone, await getDeviceId());
      await sendOtp(phone);
      router.push({ pathname: '/otp', params: { phone } });
    } catch (error) {
      setErrorKey(getErrorMessageKey(error));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <AuthScreen
      title={t('auth.phoneTitle')}
      subtitle={t('auth.phoneSubtitle')}
      footer={
        <View className="gap-3">
          <Button
            label={t('auth.sendCode')}
            onPress={handleSendCode}
            loading={isSending}
            disabled={!isValid || !canUsePhoneAuth}
          />
          <AppText variant="caption" className="text-center">
            {t('auth.terms')}
          </AppText>
        </View>
      }
    >
      <View className="gap-4">
        {!canUsePhoneAuth ? (
          <Notice
            tone="warning"
            title={t('auth.unavailableTitle')}
            message={t('auth.unavailableBody')}
          />
        ) : null}
        <PhoneNumberField
          label={t('auth.phoneLabel')}
          value={localNumber}
          onChange={(value) => {
            setLocalNumber(value);
            setErrorKey(null);
          }}
          onSubmit={handleSendCode}
          hasError={Boolean(errorKey)}
          disabled={isSending}
        />
        {errorKey ? <Notice message={t(errorKey)} /> : null}
      </View>
    </AuthScreen>
  );
}
