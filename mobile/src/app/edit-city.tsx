/**
 * Profile → Change city and area (ACC-2: city is always editable).
 */
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { CityAreaForm } from '@/components/features/CityAreaForm';
import { StackScreen } from '@/components/layout/StackScreen';
import { useUpdateProfile } from '@/hooks/useProfile';
import { useAuthStore } from '@/stores/auth.store';
import { getErrorMessageKey } from '@/utils/errorMessages';

/**
 * @returns Change city screen
 */
export default function EditCityScreen() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const updateProfile = useUpdateProfile();

  return (
    <StackScreen title={t('city.changeTitle')}>
      <CityAreaForm
        initial={{
          cityId: user?.cityId ?? null,
          area: user?.area ?? null,
          pincode: user?.pincode ?? null,
        }}
        submitLabel={t('common.save')}
        isSubmitting={updateProfile.isPending}
        errorKey={updateProfile.error ? getErrorMessageKey(updateProfile.error) : null}
        onSubmit={(value) => updateProfile.mutate(value, { onSuccess: () => router.back() })}
      />
    </StackScreen>
  );
}
