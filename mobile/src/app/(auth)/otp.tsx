/**
 * OTP screen — step 2 of login (ACC-1). Firebase checks the SMS code; its ID token is
 * exchanged for SaathMein tokens; the navigator then moves to the tabs automatically.
 * Android instant verification (no typing needed) is handled too.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { OtpInput } from '@/components/features/OtpInput';
import { AuthScreen } from '@/components/layout/AuthScreen';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { useCountdown } from '@/hooks/useCountdown';
import { useThemeColors } from '@/hooks/useThemeColors';
import { getDeviceId } from '@/lib/deviceId';
import { confirmOtp, onAutoVerified, sendOtp } from '@/lib/phoneAuth';
import { requestOtp, verifyOtp } from '@/services/auth.service';
import { useAuthStore } from '@/stores/auth.store';
import { getErrorMessageKey } from '@/utils/errorMessages';
import { formatIndianPhone } from '@/utils/genericFunctions';

const RESEND_AFTER_SECONDS = 30;

/**
 * @returns OTP entry screen
 */
export default function OtpScreen() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const { phone = '' } = useLocalSearchParams<{ phone: string }>();
  const completeLogin = useAuthStore((state) => state.completeLogin);
  const { secondsLeft, isDone, restart } = useCountdown(RESEND_AFTER_SECONDS);

  const [code, setCode] = useState('');
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [infoKey, setInfoKey] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const isVerifyingRef = useRef(false);

  /** Confirm the code with Firebase, then log in to SaathMein. */
  const verify = useCallback(
    async (enteredCode: string) => {
      if (isVerifyingRef.current) return;
      isVerifyingRef.current = true;
      setIsVerifying(true);
      setErrorKey(null);
      setInfoKey(null);
      try {
        const idToken = await confirmOtp(enteredCode);
        const result = await verifyOtp(idToken, await getDeviceId());
        await completeLogin(result); // navigator switches to the tabs
      } catch (error) {
        setErrorKey(getErrorMessageKey(error));
        setCode('');
      } finally {
        isVerifyingRef.current = false;
        setIsVerifying(false);
      }
    },
    [completeLogin],
  );

  // Android can verify the number without the user typing the code
  useEffect(() => onAutoVerified(() => verify('')), [verify]);

  /** Send a new code after the countdown. */
  const resend = async () => {
    setIsResending(true);
    setErrorKey(null);
    try {
      await requestOtp(phone, await getDeviceId());
      await sendOtp(phone);
      setInfoKey('auth.codeResent');
      restart();
    } catch (error) {
      setErrorKey(getErrorMessageKey(error));
    } finally {
      setIsResending(false);
    }
  };

  return (
    <AuthScreen
      title={t('auth.otpTitle')}
      subtitle={t('auth.otpSentTo', { phone: formatIndianPhone(phone) })}
      header={
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('auth.changeNumber')}
          className="h-12 w-12 items-center justify-center rounded-button bg-bg-band"
        >
          <ArrowLeft size={22} color={colors.ink} strokeWidth={2} />
        </Pressable>
      }
      footer={
        <Button
          label={t('auth.verify')}
          onPress={() => verify(code)}
          loading={isVerifying}
          disabled={code.length !== 6}
        />
      }
    >
      <View className="gap-5">
        <OtpInput
          value={code}
          onChange={(value) => {
            setCode(value);
            setErrorKey(null);
          }}
          onComplete={verify}
          hasError={Boolean(errorKey)}
          disabled={isVerifying}
          accessibilityLabel={t('auth.otpLabel')}
        />

        {errorKey ? <Notice message={t(errorKey)} /> : null}
        {infoKey && !errorKey ? <Notice tone="info" message={t(infoKey)} /> : null}

        <View className="flex-row flex-wrap items-center justify-between gap-2">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            className="min-h-12 justify-center"
          >
            <AppText variant="bodyStrong" color="primary">
              {t('auth.changeNumber')}
            </AppText>
          </Pressable>

          {isDone ? (
            <Pressable
              onPress={resend}
              disabled={isResending}
              accessibilityRole="button"
              className="min-h-12 justify-center"
            >
              <AppText variant="bodyStrong" color="primary">
                {t('auth.resend')}
              </AppText>
            </Pressable>
          ) : (
            <AppText variant="caption">{t('auth.resendIn', { seconds: secondsLeft })}</AppText>
          )}
        </View>
      </View>
    </AuthScreen>
  );
}
