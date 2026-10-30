/**
 * Group page (GRP-3): product, people counter, time left, members (first names only),
 * status timeline, share code, and the leader's tools (extend / start early, join
 * requests, cancel an empty group). Joining with a token arrives on Day 7, chat and live
 * socket updates on Day 8, the live auction card on Day 9.
 */
import { router, useLocalSearchParams } from 'expo-router';
import {
  Clock,
  Copy,
  Crown,
  Lock,
  PackageX,
  Share2,
  UsersRound,
  XCircle,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, RefreshControl, ScrollView, Share, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/animations/PressableScale';
import { EmptyState } from '@/components/features/EmptyState';
import { GroupStatusBadge } from '@/components/features/GroupStatusBadge';
import { GroupStatusTimeline } from '@/components/features/GroupStatusTimeline';
import { JoinRequestsCard } from '@/components/features/JoinRequestsCard';
import { LeaderDecisionCard } from '@/components/features/LeaderDecisionCard';
import { PeopleCounter } from '@/components/features/PeopleCounter';
import { StackHeader } from '@/components/layout/StackHeader';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { useCancelGroup, useGroup } from '@/hooks/useGroups';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useTimeLeft } from '@/hooks/useTimeLeft';
import { ApiClientError } from '@/services/api';
import { enterUp } from '@/utils/animations';
import { getErrorMessageKey } from '@/utils/errorMessages';
import { formatINR } from '@/utils/genericFunctions';

/** Skeleton while the group loads. */
function GroupSkeleton() {
  return (
    <View className="gap-4 px-4 pt-4">
      <View className="h-24 rounded-card bg-bg-band" />
      <View className="h-28 rounded-card bg-bg-band" />
      <View className="h-48 rounded-card bg-bg-band" />
    </View>
  );
}

/**
 * @returns Group screen
 */
export default function GroupScreen() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const { id, code } = useLocalSearchParams<{ id: string; code?: string }>();
  const { data: group, isPending, isError, error, refetch, isRefetching } = useGroup(id, code);
  const cancel = useCancelGroup();
  const timeLeft = useTimeLeft(group?.deadline);
  const isNotFound = error instanceof ApiClientError && error.status === 404;

  /** Share the invite code with the system share sheet (deep links arrive on Day 8). */
  const share = () => {
    if (!group?.inviteCode) return;
    Share.share({
      message: t('group.shareMessage', { name: group.product.name, code: group.inviteCode }),
    }).catch(() => {});
  };

  const confirmCancel = () => {
    if (!group) return;
    Alert.alert(t('group.cancelConfirmTitle'), t('group.cancelConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('group.cancelGroup'),
        style: 'destructive',
        onPress: () => cancel.mutate(group.id),
      },
    ]);
  };

  return (
    <View className="flex-1 bg-bg">
      <StackHeader title={t('group.title')} />

      {isPending ? <GroupSkeleton /> : null}

      {isError ? (
        <View className="px-4 pt-6">
          <EmptyState
            icon={PackageX}
            title={isNotFound ? t('group.notFoundTitle') : t('errors.generic')}
            body={isNotFound ? t('group.notFoundBody') : t(getErrorMessageKey(error))}
            action={
              isNotFound ? undefined : (
                <Button label={t('common.retry')} variant="secondary" onPress={() => refetch()} />
              )
            }
          />
        </View>
      ) : null}

      {group ? (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => {
                refetch();
              }}
            />
          }
        >
          <View className="w-full max-w-[640px] gap-5 self-center px-4 pt-4">
            <Animated.View entering={enterUp(0)}>
              <PressableScale
                onPress={() =>
                  router.push({ pathname: '/product/[id]', params: { id: group.product.id } })
                }
                accessibilityRole="button"
                accessibilityLabel={group.product.name}
                className="gap-1"
              >
                <AppText variant="title">{group.product.name}</AppText>
                <AppText variant="body" color="muted">
                  {group.variantName ?? t('group.anyVariant')}
                </AppText>
              </PressableScale>
              <View className="mt-3 flex-row flex-wrap items-center gap-2">
                <GroupStatusBadge status={group.status} />
                {group.visibility === 'community' ? (
                  <View className="flex-row items-center gap-1">
                    <Lock size={13} color={colors.muted} strokeWidth={2} />
                    <AppText variant="label">{t('group.community')}</AppText>
                  </View>
                ) : null}
                {group.leader?.firstName ? (
                  <View className="flex-row items-center gap-1">
                    <Crown size={13} color={colors.muted} strokeWidth={2} />
                    <AppText variant="label">
                      {group.isLeader
                        ? t('group.youLead')
                        : t('group.ledBy', { name: group.leader.firstName })}
                    </AppText>
                  </View>
                ) : null}
              </View>
            </Animated.View>

            <Animated.View
              entering={enterUp(1)}
              className="gap-4 rounded-card border border-line bg-surface p-4"
            >
              <PeopleCounter
                memberCount={group.memberCount}
                targetSize={group.targetSize}
                members={group.members}
                size="lg"
              />
              {group.status === 'open' ? (
                <View className="flex-row items-center gap-1.5">
                  <Clock
                    size={16}
                    color={timeLeft.isSoon ? colors.warning : colors.muted}
                    strokeWidth={2}
                  />
                  <AppText variant="body" color={timeLeft.isSoon ? 'ink' : 'muted'}>
                    {group.awaitingLeaderDecision ? t('group.deadlinePassed') : timeLeft.label}
                  </AppText>
                </View>
              ) : null}
              <View className="flex-row justify-between gap-3 border-t border-line pt-3">
                <AppText variant="caption">{t('group.tokenLabel')}</AppText>
                <AppText variant="bodyStrong" mono>
                  {formatINR(group.tokenAmountPaise)}
                </AppText>
              </View>
            </Animated.View>

            {group.leaderDecision ? <LeaderDecisionCard group={group} /> : null}
            {group.isLeader && group.requiresApproval && group.status === 'open' ? (
              <JoinRequestsCard groupId={group.id} />
            ) : null}

            {group.status === 'open' && !group.isLeader && !group.myMembership ? (
              <Notice tone="info" message={t('group.joinSoon')} />
            ) : null}
            {group.myMembership?.status === 'pending_approval' ? (
              <Notice tone="info" message={t('group.awaitingApprovalBody')} />
            ) : null}
            {group.isLeader && group.memberCount === 0 && group.status === 'open' ? (
              <Notice tone="info" message={t('group.leaderPaySoon')} />
            ) : null}

            {group.note ? (
              <View className="gap-1">
                <AppText variant="label">{t('group.noteLabel')}</AppText>
                <AppText variant="body">{group.note}</AppText>
              </View>
            ) : null}

            {group.inviteCode ? (
              <Animated.View
                entering={enterUp(2)}
                className="gap-3 rounded-card border border-line bg-surface p-4"
              >
                <AppText variant="heading">{t('group.inviteTitle')}</AppText>
                <View className="flex-row items-center gap-3">
                  <View className="flex-1 rounded-button bg-bg-band px-4 py-3">
                    <AppText
                      variant="heading"
                      mono
                      selectable
                      accessibilityLabel={t('group.codeA11y', {
                        code: group.inviteCode.split('').join(' '),
                      })}
                    >
                      {group.inviteCode}
                    </AppText>
                  </View>
                  <Pressable
                    onPress={share}
                    accessibilityRole="button"
                    accessibilityLabel={t('group.share')}
                    className="h-12 w-12 items-center justify-center rounded-button border border-line"
                  >
                    <Share2 size={20} color={colors.ink} strokeWidth={2} />
                  </Pressable>
                </View>
                <View className="flex-row items-center gap-1.5">
                  <Copy size={13} color={colors.muted} strokeWidth={2} />
                  <AppText variant="caption">{t('group.inviteHint')}</AppText>
                </View>
              </Animated.View>
            ) : null}

            <View className="gap-3">
              <AppText variant="heading">{t('group.membersTitle')}</AppText>
              {group.members.length ? (
                <View className="flex-row flex-wrap gap-2">
                  {group.members.map((member, index) => (
                    <View
                      key={`${member.firstName}-${index}`}
                      className="rounded-full bg-bg-band px-3 py-1.5"
                    >
                      <AppText variant="caption" color="ink">
                        {member.firstName ?? t('group.someone')}
                        {member.isLeader ? ` · ${t('group.leaderTag')}` : ''}
                      </AppText>
                    </View>
                  ))}
                </View>
              ) : (
                <EmptyState
                  icon={UsersRound}
                  title={t('group.noMembersTitle')}
                  body={t('group.noMembersBody')}
                />
              )}
            </View>

            <View className="gap-3">
              <AppText variant="heading">{t('group.timelineTitle')}</AppText>
              <GroupStatusTimeline status={group.status} history={group.statusHistory} />
            </View>

            {group.canCancel ? (
              <View className="gap-2">
                {cancel.error ? <Notice message={t(getErrorMessageKey(cancel.error))} /> : null}
                <Button
                  label={t('group.cancelGroup')}
                  icon={XCircle}
                  variant="ghost"
                  loading={cancel.isPending}
                  onPress={confirmCancel}
                />
              </View>
            ) : null}
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
}
