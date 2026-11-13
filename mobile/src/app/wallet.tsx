/**
 * Wallet and referrals (REF-1 to REF-3): SaathMein credits balance and history, my
 * referral link to share on WhatsApp, and (new accounts) adding a friend's code. A code
 * from a referral link opened before login is filled in here. Credits are not cash;
 * spending them on tokens arrives later (decided 12 Nov 2026).
 */
import { Gift, Share2, Ticket, Wallet as WalletIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/features/EmptyState';
import { StackHeader } from '@/components/layout/StackHeader';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { TextField } from '@/components/ui/TextField';
import { useApplyReferral, useReferral, useWallet } from '@/hooks/useDiscovery';
import { useThemeColors } from '@/hooks/useThemeColors';
import { getItem, removeItem, STORAGE_KEYS } from '@/lib/secureStorage';
import { shareToWhatsApp } from '@/lib/share';
import { getErrorMessageKey } from '@/utils/errorMessages';
import { formatINR } from '@/utils/genericFunctions';
import { Skeleton } from '@/components/animations/Skeleton';
import { brand } from '@/theme/tokens';

/** @returns Wallet screen */
export default function WalletScreen() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const wallet = useWallet();
  const referral = useReferral();
  const apply = useApplyReferral();
  const [code, setCode] = useState('');

  // A referral link opened earlier: fill the code in (the user confirms)
  useEffect(() => {
    getItem(STORAGE_KEYS.PENDING_REFERRAL)
      .then((pending) => {
        if (pending) setCode(pending);
      })
      .catch(() => {});
  }, []);

  const info = referral.data;
  const share = () => {
    if (!info) return;
    shareToWhatsApp(
      t('wallet.shareMessage', {
        amount: formatINR(info.friendCreditPaise),
        link: info.link,
        code: info.code,
      }),
    ).catch(() => {});
  };

  return (
    <View className="flex-1 bg-bg">
      <StackHeader title={t('wallet.title')} />
      <ScrollView
        contentContainerStyle={{ gap: 20, padding: 16, paddingBottom: 32 + insets.bottom }}
        refreshControl={
          <RefreshControl
            colors={[brand.primary]}
            tintColor={brand.primary}
            refreshing={wallet.isRefetching}
            onRefresh={() => {
              wallet.refetch();
              referral.refetch();
            }}
          />
        }
      >
        <View className="gap-1 rounded-card border border-line bg-surface p-5">
          <View className="flex-row items-center gap-2">
            <WalletIcon size={18} color={colors.muted} strokeWidth={2} />
            <AppText variant="caption">{t('wallet.balance')}</AppText>
          </View>
          {wallet.isPending ? (
            <Skeleton className="h-10 w-40 rounded-button" />
          ) : (
            <AppText variant="display" mono>
              {formatINR(wallet.data?.balancePaise ?? 0)}
            </AppText>
          )}
          <AppText variant="caption">{t('wallet.notCash')}</AppText>
        </View>

        {info?.enabled ? (
          <View className="gap-3 rounded-card border border-line bg-surface p-5">
            <View className="flex-row items-center gap-2">
              <Gift size={18} color={colors.ink} strokeWidth={2} />
              <AppText variant="heading">{t('wallet.inviteTitle')}</AppText>
            </View>
            <AppText variant="body" color="muted">
              {t('wallet.inviteBody', {
                you: formatINR(info.referrerCreditPaise),
                friend: formatINR(info.friendCreditPaise),
              })}
            </AppText>
            <View className="rounded-button bg-bg-band px-4 py-3">
              <AppText variant="caption">{t('wallet.yourCode')}</AppText>
              <AppText variant="title" mono selectable>
                {info.code}
              </AppText>
            </View>
            <Button label={t('wallet.shareInvite')} icon={Share2} onPress={share} />
            <AppText variant="caption">
              {t('wallet.inviteStats', {
                invited: info.invitedCount,
                rewarded: info.rewardedCount,
              })}
            </AppText>
            <AppText variant="caption">
              {t('wallet.leaderBonus', { amount: formatINR(info.leaderBonusPaise) })}
            </AppText>
          </View>
        ) : null}

        {info?.canAddCode ? (
          <View className="gap-3 rounded-card border border-line bg-surface p-5">
            <View className="flex-row items-center gap-2">
              <Ticket size={18} color={colors.ink} strokeWidth={2} />
              <AppText variant="heading">{t('wallet.haveCode')}</AppText>
            </View>
            <TextField
              label={t('wallet.friendCode')}
              value={code}
              onChangeText={(text) => setCode(text.toUpperCase())}
              autoCapitalize="characters"
              maxLength={12}
              mono
            />
            {apply.error ? <Notice message={t(getErrorMessageKey(apply.error))} /> : null}
            <Button
              label={t('wallet.addCode')}
              disabled={code.trim().length < 6}
              loading={apply.isPending}
              onPress={() =>
                apply.mutate(code.trim(), {
                  onSuccess: () => removeItem(STORAGE_KEYS.PENDING_REFERRAL).catch(() => {}),
                })
              }
            />
          </View>
        ) : info?.referredBy ? (
          <Notice tone="info" message={t('wallet.codeAdded')} />
        ) : null}

        <View className="gap-3">
          <AppText variant="heading">{t('wallet.historyTitle')}</AppText>
          {wallet.isError && !wallet.data ? (
            <Notice message={t(getErrorMessageKey(wallet.error))} />
          ) : wallet.data?.transactions.length ? (
            wallet.data.transactions.map((txn) => (
              <View
                key={txn.id}
                className="flex-row items-center justify-between gap-3 rounded-card border border-line bg-surface px-4 py-3"
              >
                <View className="flex-1">
                  <AppText variant="bodyStrong">{t(`wallet.types.${txn.type}`)}</AppText>
                  <AppText variant="caption">
                    {new Date(txn.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </AppText>
                </View>
                <AppText variant="bodyStrong" mono>
                  {txn.amountPaise > 0 ? '+' : '−'}
                  {formatINR(Math.abs(txn.amountPaise))}
                </AppText>
              </View>
            ))
          ) : wallet.isPending ? null : (
            <EmptyState icon={Gift} title={t('wallet.emptyTitle')} body={t('wallet.emptyBody')} />
          )}
        </View>
      </ScrollView>
    </View>
  );
}
