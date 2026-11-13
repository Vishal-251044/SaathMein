/**
 * Group chat (LIV-5): live messages (Socket.io, polling fallback), older messages on
 * scroll, pinned bar, text with abuse filtering on the server, photos, polls for the
 * leader, pin and report by long press. Keyboard-safe and member-only.
 */
import { useLocalSearchParams } from 'expo-router';
import { BarChart3, ImagePlus, MessagesSquare, Pin, RefreshCw, Send } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/features/EmptyState';
import { ChatMessageItem } from '@/components/features/chat/ChatMessageItem';
import { PollSheet } from '@/components/features/chat/PollSheet';
import { StackHeader } from '@/components/layout/StackHeader';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { useChatActions, useChatMessages } from '@/hooks/useChat';
import { useGroup } from '@/hooks/useGroups';
import { useGroupSocket } from '@/hooks/useGroupSocket';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ApiClientError } from '@/services/api';
import { fontClassFor } from '@/theme/fonts';
import { brand } from '@/theme/tokens';
import { getErrorMessageKey } from '@/utils/errorMessages';
import { cx } from '@/utils/genericFunctions';

const MAX_LENGTH = 1000;

/**
 * @returns Group chat screen
 */
export default function GroupChatScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { connected } = useGroupSocket(id);
  const { data: group } = useGroup(id, undefined, { live: connected });
  const messages = useChatMessages(id, true);
  const actions = useChatActions(id);
  const [text, setText] = useState('');
  const [pollOpen, setPollOpen] = useState(false);

  const list = messages.data?.pages.flatMap((page) => page.messages) ?? [];
  const pinned = messages.data?.pages[0]?.pinned ?? [];
  const isLeader = Boolean(group?.isLeader);
  const membersOnly = messages.error instanceof ApiClientError && messages.error.status === 403;
  const actionError =
    actions.send.error ??
    actions.vote.error ??
    actions.pin.error ??
    actions.report.error ??
    (actions.sendPhoto.error && !/PHOTO_CANCELLED/.test(String(actions.sendPhoto.error))
      ? actions.sendPhoto.error
      : null);

  const send = () => {
    const value = text.trim();
    if (!value) return;
    actions.send.mutate({ text: value }, { onSuccess: () => setText('') });
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-bg"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StackHeader title={group?.product.name ?? t('chat.title')} />

      {pinned.length ? (
        <View className="gap-1 border-b border-line bg-bg-band px-4 py-2">
          {pinned.map((message) => (
            <View key={message.id} className="flex-row items-center gap-2">
              <Pin size={14} color={brand.primary} strokeWidth={2} />
              <AppText variant="caption" color="ink" numberOfLines={1} className="flex-1">
                {message.text ?? message.poll?.question ?? t('chat.photo')}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}

      {!connected ? (
        <View className="bg-warning/10 px-4 py-1.5">
          <AppText variant="caption" color="ink">
            {t('chat.reconnecting')}
          </AppText>
        </View>
      ) : null}

      {membersOnly ? (
        <View className="px-4 pt-6">
          <EmptyState
            icon={MessagesSquare}
            title={t('chat.membersOnlyTitle')}
            body={t('chat.membersOnlyBody')}
          />
        </View>
      ) : (
        <FlatList
          inverted
          data={list}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ChatMessageItem
              message={item}
              isLeaderViewer={isLeader}
              onVote={(optionIndex) => actions.vote.mutate({ messageId: item.id, optionIndex })}
              onReport={() => actions.report.mutate(item.id)}
              onPin={(pinnedNow) => actions.pin.mutate({ messageId: item.id, pinned: pinnedNow })}
            />
          )}
          ItemSeparatorComponent={() => <View className="h-3" />}
          contentContainerStyle={{ padding: 16, flexGrow: 1 }}
          onEndReached={() => {
            if (messages.hasNextPage && !messages.isFetchingNextPage) messages.fetchNextPage();
          }}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            messages.isFetchingNextPage ? (
              <ActivityIndicator color={brand.primary} className="py-4" />
            ) : undefined
          }
          ListEmptyComponent={
            messages.isPending ? (
              <ActivityIndicator color={brand.primary} className="py-10" />
            ) : messages.isError && !messages.data ? (
              <EmptyState
                icon={MessagesSquare}
                title={t('errors.generic')}
                body={t(getErrorMessageKey(messages.error))}
                action={
                  <Button
                    label={t('common.retry')}
                    icon={RefreshCw}
                    variant="secondary"
                    onPress={() => messages.refetch()}
                  />
                }
              />
            ) : (
              // Inverted list: flip the empty state back upright
              <View style={{ transform: [{ scaleY: -1 }] }}>
                <EmptyState
                  icon={MessagesSquare}
                  title={t('chat.emptyTitle')}
                  body={t('chat.emptyBody')}
                />
              </View>
            )
          }
        />
      )}

      {!membersOnly ? (
        <View
          className="gap-2 border-t border-line bg-bg px-3 pt-2"
          style={{ paddingBottom: Math.max(insets.bottom, 8) }}
        >
          {actionError ? <Notice message={t(getErrorMessageKey(actionError))} /> : null}
          <View className="flex-row items-end gap-1">
            <Pressable
              onPress={() => actions.sendPhoto.mutate(undefined)}
              disabled={actions.sendPhoto.isPending}
              accessibilityRole="button"
              accessibilityLabel={t('chat.addPhoto')}
              className="h-12 w-12 items-center justify-center"
            >
              {actions.sendPhoto.isPending ? (
                <ActivityIndicator color={brand.primary} />
              ) : (
                <ImagePlus size={22} color={colors.ink} strokeWidth={2} />
              )}
            </Pressable>
            {isLeader ? (
              <Pressable
                onPress={() => setPollOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={t('chat.newPoll')}
                className="h-12 w-12 items-center justify-center"
              >
                <BarChart3 size={22} color={colors.ink} strokeWidth={2} />
              </Pressable>
            ) : null}
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={t('chat.placeholder')}
              placeholderTextColor={colors.muted}
              multiline
              maxLength={MAX_LENGTH}
              accessibilityLabel={t('chat.placeholder')}
              className={cx(
                'max-h-32 min-h-12 flex-1 rounded-button border border-line bg-surface px-4 py-3 text-[15px] text-ink',
                fontClassFor('regular', i18n.language),
              )}
            />
            <Pressable
              onPress={send}
              disabled={!text.trim() || actions.send.isPending}
              accessibilityRole="button"
              accessibilityLabel={t('chat.send')}
              className={cx(
                'h-12 w-12 items-center justify-center rounded-full',
                text.trim() ? 'bg-primary' : 'bg-bg-band',
              )}
            >
              {actions.send.isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Send size={20} color={text.trim() ? '#FFFFFF' : colors.muted} strokeWidth={2} />
              )}
            </Pressable>
          </View>
        </View>
      ) : null}

      <PollSheet
        visible={pollOpen}
        sending={actions.send.isPending}
        onClose={() => setPollOpen(false)}
        onSend={(poll) => actions.send.mutate({ poll }, { onSuccess: () => setPollOpen(false) })}
      />
    </KeyboardAvoidingView>
  );
}
