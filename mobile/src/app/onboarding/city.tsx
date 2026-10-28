/**
 * Onboarding step 1 — where the user lives (ACC-2). Also saves the language chosen on
 * first launch to the account, so it follows the user to a new phone.
 */
import { useTranslation } from 'react-i18next';

import { CityAreaForm } from '@/components/features/CityAreaForm';
import { AuthScreen } from '@/components/layout/AuthScreen';
import { useUpdateProfile } from '@/hooks/useProfile';
import { useSettingsStore } from '@/stores/settings.store';
import { getErrorMessageKey } from '@/utils/errorMessages';

/**
 * @returns City and area screen
 */
export default function OnboardingCityScreen() {
  const { t } = useTranslation();
  const language = useSettingsStore((state) => state.language);
  const updateProfile = useUpdateProfile();

  return (
    <AuthScreen title={t('city.title')} subtitle={t('city.subtitle')}>
      <CityAreaForm
        submitLabel={t('common.continue')}
        isSubmitting={updateProfile.isPending}
        errorKey={updateProfile.error ? getErrorMessageKey(updateProfile.error) : null}
        onSubmit={(value) => updateProfile.mutate({ ...value, language })}
      />
    </AuthScreen>
  );
}
