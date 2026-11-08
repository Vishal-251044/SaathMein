/**
 * JoinGroupBar — the group page's main action, based on the group and my place in it:
 * pay the token to join (open group or a seat offered to me), join / leave the waitlist
 * (full group), or leave the group (member). Money screens stay calm and clear.
 */
import { router } from 'expo-router';
import { Clock, ListOrdered, LogOut, UsersRound } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { LeaveGroupSheet } from '@/components/features/LeaveGroupSheet';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { useWaitlist } from '@/hooks/usePayments';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useTimeLeft } from '@/hooks/useTimeLeft';
import type { GroupDetail } from '@/types/group';
import { getErrorMessageKey } from '@/utils/errorMessages';
import { formatINR } from '@/utils/genericFunctions';

/** @param props.group - Group page data; props.code - invite code used to open it */
export function JoinGroupBar({ group, code }: { group: GroupDetail; code?: string }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const [leaving, setLeaving] = useState(false);
  const waitlist = useWaitlist(group.id);
  const membership = group.myMembership;
  const offer = useTimeLeft(membership?.seatOfferExpiresAt ?? undefined);
  const token = formatINR(group.tokenAmountPaise);
  const isSeated = ['active', 'accepted', 'purchased'].includes(membership?.status ?? '');
  const isWaitlisted = membership?.status === 'waitlisted';
  const hasOffer = isWaitlisted && Boolean(membership?.seatOfferExpiresAt) && !offer.isOver;
  const needsApproval =
    group.requiresApproval &&
    !group.isLeader &&
    !['approved', 'waitlisted'].includes(membership?.status ?? '');
  const waitlistError = waitlist.join.error ?? waitlist.leave.error;
  const goPay = () =>
    router.push({
      pathname: '/pay/[groupId]',
      params: { groupId: group.id, ...(code ? { code } : {}) },
    });

  if (isSeated) {
    return (
      <View className="gap-2">
        <Button
          label={t('join.leave')}
          icon={LogOut}
          variant="ghost"
          onPress={() => setLeaving(true)}
        />
        <LeaveGroupSheet groupId={group.id} visible={leaving} onClose={() => setLeaving(false)} />
      </View>
    );
  }

  if (hasOffer) {
    return (
      <View className="gap-3">
        <Notice tone="info" message={t('join.offerBody', { time: offer.label })} />
        <Button label={t('join.payToJoin', { amount: token })} icon={UsersRound} onPress={goPay} />
      </View>
    );
  }

  if (group.status === 'open' && !needsApproval && membership?.status !== 'pending_approval') {
    return (
      <View className="gap-2">
        <Button label={t('join.payToJoin', { amount: token })} icon={UsersRound} onPress={goPay} />
        <AppText variant="caption" className="text-center">
          {t('join.refundable')}
        </AppText>
      </View>
    );
  }

  if (['full', 'auction_live', 'won'].includes(group.status)) {
    return (
      <View className="gap-2">
        {waitlistError ? <Notice message={t(getErrorMessageKey(waitlistError))} /> : null}
        {isWaitlisted ? (
          <>
            <View className="flex-row items-center justify-center gap-1.5">
              <Clock size={14} color={colors.muted} strokeWidth={2} />
              <AppText variant="body">
                {t('join.waitlistPosition', { position: membership?.waitlistPosition ?? '-' })}
              </AppText>
            </View>
            <Button
              label={t('join.leaveWaitlist')}
              variant="ghost"
              loading={waitlist.leave.isPending}
              onPress={() => waitlist.leave.mutate()}
            />
          </>
        ) : (
          <>
            <Button
              label={t('join.joinWaitlist')}
              icon={ListOrdered}
              variant="secondary"
              loading={waitlist.join.isPending}
              onPress={() => waitlist.join.mutate(code)}
            />
            <AppText variant="caption" className="text-center">
              {t('join.waitlistExplain')}
            </AppText>
          </>
        )}
      </View>
    );
  }
  return null;
}
