/**
 * Add your mobile number (/verify-phone) — for accounts made with Google (F4, decided
 * 17 Nov 2026): a verified phone is needed once before paying a token. Same OTP flow as
 * login (API abuse limits first, then Firebase SMS); the verified number is then linked
 * to this account and the person goes back to where they were (e.g. the payment).
 */
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { OtpInput } from '@/components/features/OtpInput';
import { PhoneNumberField } from '@/components/features/PhoneNumberField';
import { AuthScreen } from '@/components/layout/AuthScreen';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { useThemeColors } from '@/hooks/useThemeColors';
import { getDeviceId } from '@/lib/deviceId';
import { tapSuccess } from '@/lib/haptics';
import {
  confirmOtp,
  isPhoneAuthAvailable,
  onAutoVerified,
  sendOtp,
  signOutOfFirebase,
} from '@/lib/phoneAuth';
import { linkPhone, requestOtp } from '@/services/auth.service';
import { useAuthStore } from '@/stores/auth.store';
import { getErrorMessageKey } from '@/utils/errorMessages';
import { formatIndianPhone, INDIAN_MOBILE_REGEX, toIndianE164 } from '@/utils/genericFunctions';

/** @returns Add mobile number screen */
export default function VerifyPhoneScreen() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const setUser = useAuthStore((state) => state.setUser);
  const canUsePhoneAuth = isPhoneAuthAvailable();

  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [localNumber, setLocalNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const isVerifyingRef = useRef(false);

  /** API abuse check, then Firebase sends the SMS. */
  const sendCode = async () => {
    if (!INDIAN_MOBILE_REGEX.test(localNumber) || isBusy) return;
    setErrorKey(null);
    setIsBusy(true);
    try {
      const e164 = toIndianE164(localNumber);
      await requestOtp(e164, await getDeviceId());
      await sendOtp(e164);
      setPhone(e164);
      setStep('code');
    } catch (error) {
      setErrorKey(getErrorMessageKey(error));
    } finally {
      setIsBusy(false);
    }
  };

  /** Confirm the code, link the number to this account and go back. */
  const verify = useCallback(
    async (entered: string) => {
      if (isVerifyingRef.current) return;
      isVerifyingRef.current = true;
      setIsBusy(true);
      setErrorKey(null);
      try {
        const idToken = await confirmOtp(entered);
        const user = await linkPhone(idToken);
        await signOutOfFirebase(); // Firebase was only needed to check the SMS code
        setUser(user);
        tapSuccess();
        router.back();
      } catch (error) {
        setErrorKey(getErrorMessageKey(error));
        setCode('');
      } finally {
        isVerifyingRef.current = false;
        setIsBusy(false);
      }
    },
    [setUser],
  );

  // Android can verify the number without typing the code
  useEffect(() => {
    if (step !== 'code') return undefined;
    return onAutoVerified(() => verify(''));
  }, [step, verify]);

  return (
    <AuthScreen
      title={step === 'phone' ? t('phoneLink.title') : t('auth.otpTitle')}
      subtitle={
        step === 'phone'
          ? t('phoneLink.subtitle')
          : t('auth.otpSentTo', { phone: formatIndianPhone(phone) })
      }
      header={
        <Pressable
          onPress={() => (step === 'code' ? setStep('phone') : router.back())}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          className="h-12 w-12 items-center justify-center rounded-button bg-bg-band"
        >
          <ArrowLeft size={22} color={colors.ink} strokeWidth={2} />
        </Pressable>
      }
      footer={
        step === 'phone' ? (
          <Button
            label={t('auth.sendCode')}
            onPress={sendCode}
            loading={isBusy}
            disabled={!INDIAN_MOBILE_REGEX.test(localNumber) || !canUsePhoneAuth}
          />
        ) : (
          <Button
            label={t('auth.verify')}
            onPress={() => verify(code)}
            loading={isBusy}
            disabled={code.length !== 6}
          />
        )
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
        {step === 'phone' ? (
          <PhoneNumberField
            label={t('auth.phoneLabel')}
            value={localNumber}
            onChange={(value) => {
              setLocalNumber(value);
              setErrorKey(null);
            }}
            onSubmit={sendCode}
            hasError={Boolean(errorKey)}
            disabled={isBusy}
          />
        ) : (
          <OtpInput
            value={code}
            onChange={(value) => {
              setCode(value);
              setErrorKey(null);
            }}
            onComplete={verify}
            hasError={Boolean(errorKey)}
            disabled={isBusy}
            accessibilityLabel={t('auth.otpLabel')}
          />
        )}
        {errorKey ? <Notice message={t(errorKey)} /> : null}
        <AppText variant="caption">{t('phoneLink.privacy')}</AppText>
      </View>
    </AuthScreen>
  );
}
