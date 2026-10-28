/**
 * Onboarding step 2 — what the user plans to buy (ACC-3). Skippable; either way the app
 * moves on to Home once the API marks onboarding complete.
 */
import { useTranslation } from 'react-i18next';

import { InterestsForm, type InterestsValue } from '@/components/features/InterestsForm';
import { AuthScreen } from '@/components/layout/AuthScreen';
import { useSaveInterests } from '@/hooks/useProfile';
import { getErrorMessageKey } from '@/utils/errorMessages';

/**
 * @returns Interests screen
 */
export default function OnboardingInterestsScreen() {
  const { t } = useTranslation();
  const saveInterests = useSaveInterests();

  const submit = ({ timeline, ...rest }: InterestsValue) =>
    saveInterests.mutate({ ...rest, timeline: timeline ?? undefined });

  return (
    <AuthScreen title={t('interests.title')} subtitle={t('interests.subtitle')}>
      <InterestsForm
        submitLabel={t('interests.save')}
        isSubmitting={saveInterests.isPending}
        errorKey={saveInterests.error ? getErrorMessageKey(saveInterests.error) : null}
        onSubmit={submit}
        onSkip={() => saveInterests.mutate({ categories: [], brands: [] })}
      />
    </AuthScreen>
  );
}
