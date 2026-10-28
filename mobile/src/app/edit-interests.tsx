/**
 * Home / Profile → Edit interests (ACC-3).
 */
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { InterestsForm, type InterestsValue } from '@/components/features/InterestsForm';
import { StackScreen } from '@/components/layout/StackScreen';
import { useSaveInterests } from '@/hooks/useProfile';
import { useAuthStore } from '@/stores/auth.store';
import { getErrorMessageKey } from '@/utils/errorMessages';

/**
 * @returns Edit interests screen
 */
export default function EditInterestsScreen() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const saveInterests = useSaveInterests();

  const submit = ({ timeline, ...rest }: InterestsValue) =>
    saveInterests.mutate(
      { ...rest, timeline: timeline ?? undefined },
      { onSuccess: () => router.back() },
    );

  return (
    <StackScreen title={t('interests.editTitle')}>
      <InterestsForm
        initial={user?.interests}
        submitLabel={t('common.save')}
        isSubmitting={saveInterests.isPending}
        errorKey={saveInterests.error ? getErrorMessageKey(saveInterests.error) : null}
        onSubmit={submit}
      />
    </StackScreen>
  );
}
