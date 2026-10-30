/**
 * Invite link entry (saathmein://g/<code>, GRP-6): opens the group behind an invite code.
 * Community groups that need approval file a join request here. https App Links and
 * links opened before login arrive with sharing on Day 8.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { Link2Off } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { EmptyState } from '@/components/features/EmptyState';
import { StackHeader } from '@/components/layout/StackHeader';
import { Button } from '@/components/ui/Button';
import { useJoinByCode } from '@/hooks/useGroups';
import { getErrorMessageKey } from '@/utils/errorMessages';

/**
 * @returns Invite link screen
 */
export default function InviteLinkScreen() {
  const { t } = useTranslation();
  const { code } = useLocalSearchParams<{ code: string }>();
  const join = useJoinByCode();
  const { mutate } = join;

  useEffect(() => {
    if (!code) return;
    mutate(code, {
      onSuccess: ({ group }) =>
        router.replace({ pathname: '/group/[id]', params: { id: group.id, code } }),
    });
  }, [code, mutate]);

  return (
    <View className="flex-1 bg-bg">
      <StackHeader title={t('group.title')} />
      <View className="px-4 pt-6">
        {join.isError ? (
          <EmptyState
            icon={Link2Off}
            title={t('joinCode.invalidTitle')}
            body={t(getErrorMessageKey(join.error))}
            action={
              <Button
                label={t('joinCode.goToGroups')}
                variant="secondary"
                onPress={() => router.replace('/groups')}
              />
            }
          />
        ) : (
          <View className="gap-4" accessibilityLabel={t('common.loading')}>
            <View className="h-24 rounded-card bg-bg-band" />
            <View className="h-40 rounded-card bg-bg-band" />
          </View>
        )}
      </View>
    </View>
  );
}
