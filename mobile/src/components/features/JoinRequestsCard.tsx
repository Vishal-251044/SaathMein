/**
 * JoinRequestsCard — leader of a community group with approval sees who asked to join
 * and approves or declines (GRP-6). Approved people then pay the token (Day 7).
 */
import { Check, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { Notice } from '@/components/ui/Notice';
import { useDecideJoinRequest, useJoinRequests } from '@/hooks/useGroups';
import { useThemeColors } from '@/hooks/useThemeColors';
import { brand } from '@/theme/tokens';
import { getErrorMessageKey } from '@/utils/errorMessages';

/** @param props.groupId - Community group led by the viewer */
export function JoinRequestsCard({ groupId }: { groupId: string }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const { data: requests, error } = useJoinRequests(groupId, true);
  const decide = useDecideJoinRequest(groupId);

  if (!requests?.length && !error) return null;

  return (
    <View className="gap-3 rounded-card border border-line bg-surface p-4">
      <AppText variant="heading">
        {t('group.requestsTitle', { count: requests?.length ?? 0 })}
      </AppText>
      {error || decide.error ? (
        <Notice message={t(getErrorMessageKey(error ?? decide.error))} />
      ) : null}
      {(requests ?? []).map((request) => {
        const name = request.firstName ?? t('group.someone');
        return (
          <View key={request.userId} className="flex-row items-center gap-3">
            <Avatar url={request.avatarUrl} name={request.firstName} size={40} />
            <AppText variant="bodyStrong" className="flex-1" numberOfLines={1}>
              {name}
            </AppText>
            <Pressable
              onPress={() => decide.mutate({ userId: request.userId, approve: false })}
              disabled={decide.isPending}
              accessibilityRole="button"
              accessibilityLabel={t('group.decline', { name })}
              className="h-12 w-12 items-center justify-center rounded-button border border-line"
            >
              <X size={20} color={colors.danger} strokeWidth={2} />
            </Pressable>
            <Pressable
              onPress={() => decide.mutate({ userId: request.userId, approve: true })}
              disabled={decide.isPending}
              accessibilityRole="button"
              accessibilityLabel={t('group.approve', { name })}
              className="h-12 w-12 items-center justify-center rounded-button bg-primary/10"
            >
              <Check size={20} color={brand.primary} strokeWidth={2.4} />
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}
