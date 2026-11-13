/**
 * ChatMessageItem — one chat message: my messages on the right, others on the left with
 * first name (leader tagged), text, photo, poll (tap an option to vote) and pinned mark.
 * Long press: report (others' messages) and pin / unpin (leader). Hidden messages show a
 * neutral note instead of their content.
 */
import { Image } from 'expo-image';
import { EyeOff, Pin } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { useThemeColors } from '@/hooks/useThemeColors';
import { brand } from '@/theme/tokens';
import type { ChatMessage } from '@/types/live';
import { cx } from '@/utils/genericFunctions';
import { sizedImageUrl } from '@/utils/imageUrl';

const IMAGE_WIDTH = 240;

interface ChatMessageItemProps {
  message: ChatMessage;
  isLeaderViewer: boolean;
  onVote: (optionIndex: number) => void;
  onReport: () => void;
  onPin: (pinned: boolean) => void;
}

/**
 * @param props.message - Message
 * @param props.isLeaderViewer - I lead this group (may pin)
 */
export function ChatMessageItem({
  message,
  isLeaderViewer,
  onVote,
  onReport,
  onPin,
}: ChatMessageItemProps) {
  const { t, i18n } = useTranslation();
  const { colors } = useThemeColors();
  const mine = message.isMine;
  const time = new Date(message.createdAt).toLocaleTimeString(
    i18n.language === 'en' ? 'en-IN' : `${i18n.language}-IN`,
    {
      hour: 'numeric',
      minute: '2-digit',
    },
  );

  const showActions = () => {
    const actions: { text: string; onPress?: () => void; style?: 'cancel' | 'destructive' }[] = [];
    if (isLeaderViewer && !message.hidden) {
      actions.push({
        text: message.pinned ? t('chat.unpin') : t('chat.pin'),
        onPress: () => onPin(!message.pinned),
      });
    }
    if (!mine && !message.reportedByMe) {
      actions.push({ text: t('chat.report'), style: 'destructive', onPress: onReport });
    }
    if (!actions.length) return;
    Alert.alert(t('chat.actionsTitle'), undefined, [
      ...actions,
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const totalVotes = message.poll?.options.reduce((sum, option) => sum + option.votes, 0) ?? 0;

  return (
    <View className={cx('flex-row items-end gap-2', mine ? 'justify-end' : 'justify-start')}>
      {!mine ? (
        <Avatar url={message.sender?.avatarUrl} name={message.sender?.firstName} size={28} />
      ) : null}
      <Pressable
        onLongPress={showActions}
        delayLongPress={350}
        accessibilityHint={t('chat.longPressHint')}
        className={cx(
          'max-w-[80%] gap-1.5 rounded-card px-3.5 py-2.5',
          mine ? 'rounded-br-md bg-primary/10' : 'rounded-bl-md border border-line bg-surface',
        )}
      >
        {!mine && message.sender ? (
          <AppText variant="label" color="primary">
            {message.sender.firstName ?? t('group.someone')}
            {message.sender.isLeader ? ` · ${t('group.leaderTag')}` : ''}
            {message.sender.isDealer ? ` · ${t('group.dealerTag')}` : ''}
          </AppText>
        ) : null}

        {message.hidden ? (
          <View className="flex-row items-center gap-1.5">
            <EyeOff size={14} color={colors.muted} strokeWidth={2} />
            <AppText variant="caption">{t('chat.hidden')}</AppText>
          </View>
        ) : null}

        {message.images.map((image) => (
          <Image
            key={image.publicId}
            source={{ uri: sizedImageUrl(image.url, IMAGE_WIDTH) ?? image.url }}
            style={{ width: IMAGE_WIDTH, height: IMAGE_WIDTH * 0.75, borderRadius: 12 }}
            contentFit="cover"
            accessibilityLabel={t('chat.photo')}
          />
        ))}

        {message.text ? <AppText variant="body">{message.text}</AppText> : null}

        {message.poll ? (
          <View className="gap-2" style={{ minWidth: 220 }}>
            <AppText variant="bodyStrong">{message.poll.question}</AppText>
            {message.poll.options.map((option, index) => {
              const chosen = message.poll?.myVote === index;
              const share = totalVotes ? option.votes / totalVotes : 0;
              return (
                <Pressable
                  key={option.text}
                  onPress={() => onVote(index)}
                  disabled={message.poll?.closed}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: chosen }}
                  accessibilityLabel={t('chat.voteA11y', {
                    option: option.text,
                    count: option.votes,
                  })}
                  className={cx(
                    'min-h-12 overflow-hidden rounded-button border',
                    chosen ? 'border-primary' : 'border-line',
                  )}
                >
                  {/* Vote share bar (transform only) */}
                  <View
                    className="absolute inset-y-0 left-0 w-full bg-primary/10"
                    style={{ transform: [{ scaleX: share }], transformOrigin: 'left' }}
                  />
                  <View className="flex-1 flex-row items-center justify-between px-3 py-2">
                    <AppText variant={chosen ? 'bodyStrong' : 'body'}>{option.text}</AppText>
                    <AppText variant="caption" mono>
                      {option.votes}
                    </AppText>
                  </View>
                </Pressable>
              );
            })}
            <AppText variant="caption">{t('chat.votes', { count: totalVotes })}</AppText>
          </View>
        ) : null}

        <View className="flex-row items-center justify-end gap-1">
          {message.pinned ? <Pin size={12} color={brand.primary} strokeWidth={2} /> : null}
          <AppText variant="caption">{time}</AppText>
        </View>
      </Pressable>
    </View>
  );
}
