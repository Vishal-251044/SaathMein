/**
 * My Groups tab (GRP-4): groups I joined and groups I lead, plus "Have an invite code?".
 * Pull to refresh; loading, error, empty and offline states.
 */
import { router } from 'expo-router';
import { Crown, KeyRound, RefreshCw, UsersRound, WifiOff } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/features/EmptyState';
import { GroupCard } from '@/components/features/GroupCard';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Notice } from '@/components/ui/Notice';
import { TextField } from '@/components/ui/TextField';
import { useJoinByCode, useMyGroups } from '@/hooks/useGroups';
import { ApiClientError } from '@/services/api';
import { brand } from '@/theme/tokens';
import { getErrorMessageKey } from '@/utils/errorMessages';
import { Skeleton } from '@/components/animations/Skeleton';

type Tab = 'joined' | 'leading';

/** "Have an invite code?" box. */
function JoinCodeBox() {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const join = useJoinByCode();
  const cleaned = code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

  return (
    <View className="gap-3 rounded-card border border-line bg-surface p-4">
      <TextField
        label={t('joinCode.label')}
        value={code}
        onChangeText={setCode}
        placeholder={t('joinCode.placeholder')}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={12}
        mono
      />
      {join.error ? <Notice message={t(getErrorMessageKey(join.error))} /> : null}
      <Button
        label={t('joinCode.open')}
        icon={KeyRound}
        variant="secondary"
        disabled={cleaned.length < 6}
        loading={join.isPending}
        onPress={() =>
          join.mutate(cleaned, {
            onSuccess: ({ group }) => {
              setCode('');
              router.push({ pathname: '/group/[id]', params: { id: group.id, code: cleaned } });
            },
          })
        }
      />
    </View>
  );
}

/**
 * @returns My Groups screen
 */
export default function GroupsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('joined');
  const query = useMyGroups(tab);
  const groups = query.data?.pages.flatMap((page) => page.groups) ?? [];
  const isOffline = query.error instanceof ApiClientError && query.error.code === 'NETWORK_ERROR';

  const header = (
    <View className="gap-4 pb-4">
      <ScreenHeader title={t('groups.title')} />
      <View className="flex-row gap-2" accessibilityRole="tablist">
        <Chip
          label={t('groups.joined')}
          icon={UsersRound}
          role="radio"
          selected={tab === 'joined'}
          onPress={() => setTab('joined')}
        />
        <Chip
          label={t('groups.leading')}
          icon={Crown}
          role="radio"
          selected={tab === 'leading'}
          onPress={() => setTab('leading')}
        />
      </View>
    </View>
  );

  const renderEmpty = () => {
    if (query.isPending) {
      return (
        <View className="gap-3" accessibilityLabel={t('common.loading')}>
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-36 rounded-card" />
          ))}
        </View>
      );
    }
    if (query.isError && !query.data) {
      return (
        <EmptyState
          icon={isOffline ? WifiOff : UsersRound}
          title={isOffline ? t('catalog.offlineTitle') : t('errors.generic')}
          body={t(getErrorMessageKey(query.error))}
          action={
            <Button
              label={t('common.retry')}
              icon={RefreshCw}
              variant="secondary"
              onPress={() => query.refetch()}
            />
          }
        />
      );
    }
    return tab === 'joined' ? (
      <EmptyState
        icon={UsersRound}
        title={t('groups.emptyTitle')}
        body={t('groups.emptyBody')}
        action={
          <Button
            label={t('groups.browse')}
            variant="secondary"
            onPress={() => router.push('/search')}
          />
        }
      />
    ) : (
      <EmptyState
        icon={Crown}
        title={t('groups.emptyLeadingTitle')}
        body={t('groups.emptyLeadingBody')}
      />
    );
  };

  return (
    <View className="flex-1 bg-bg" style={{ paddingTop: insets.top }}>
      <FlatList
        data={groups}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <GroupCard group={item} />}
        ItemSeparatorComponent={() => <View className="h-3" />}
        ListHeaderComponent={header}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={
          <View className="pt-6">
            {query.isFetchingNextPage ? (
              <ActivityIndicator className="pb-6" color={brand.primary} />
            ) : null}
            <JoinCodeBox />
          </View>
        }
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
        }}
        onEndReachedThreshold={0.4}
        refreshing={query.isRefetching && !query.isFetchingNextPage}
        onRefresh={() => {
          query.refetch();
        }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 32,
          width: '100%',
          maxWidth: 640,
          alignSelf: 'center',
        }}
      />
    </View>
  );
}
