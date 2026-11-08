/**
 * Chat hooks (LIV-5): paged messages (live updates arrive through useGroupSocket), send
 * text / photo / poll, vote, pin, report. Every server answer replaces the message in the
 * cache, so my own view (isMine, my vote) is always right.
 */
import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import { chatKey } from '@/hooks/useGroupSocket';
import { pickChatImage } from '@/lib/imagePicker';
import * as chatService from '@/services/chat.service';
import type { ChatMessage, ChatPage } from '@/types/live';
import { putChatMessage } from '@/utils/chatCache';

/** @returns Infinite query of chat pages (newest first) */
export function useChatMessages(groupId: string | undefined, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: chatKey(groupId ?? ''),
    queryFn: ({ pageParam }) => chatService.getMessages(groupId as string, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.messages.at(-1)?.id : undefined),
    enabled: Boolean(groupId) && enabled,
  });
}

/** Mutation helper that writes the returned message into the cache. */
function useChatMutation<TInput>(groupId: string, fn: (input: TInput) => Promise<ChatMessage>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (message) =>
      queryClient.setQueryData<InfiniteData<ChatPage>>(chatKey(groupId), (data) =>
        putChatMessage(data, message),
      ),
  });
}

/** @returns Mutations for one group's chat */
export function useChatActions(groupId: string) {
  const send = useChatMutation(groupId, (input: chatService.SendMessageInput) =>
    chatService.sendMessage(groupId, input),
  );
  const sendPhoto = useChatMutation(groupId, async (caption: string | undefined) => {
    // Resized on the phone first (small uploads on mobile data)
    const image = await pickChatImage();
    if (!image) throw new Error('PHOTO_CANCELLED');
    const upload = await chatService.uploadChatImage(groupId, { ...image, fileName: 'chat.jpg' });
    return chatService.sendMessage(groupId, {
      image: upload,
      ...(caption ? { text: caption } : {}),
    });
  });
  const vote = useChatMutation(
    groupId,
    ({ messageId, optionIndex }: { messageId: string; optionIndex: number }) =>
      chatService.votePoll(groupId, messageId, optionIndex),
  );
  const pin = useChatMutation(
    groupId,
    ({ messageId, pinned }: { messageId: string; pinned: boolean }) =>
      chatService.pinMessage(groupId, messageId, pinned),
  );
  const report = useChatMutation(groupId, (messageId: string) =>
    chatService.reportMessage(groupId, messageId),
  );
  return { send, sendPhoto, vote, pin, report };
}
