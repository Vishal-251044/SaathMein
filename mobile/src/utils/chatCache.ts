/**
 * Chat cache helpers: put a message into the paged chat cache (TanStack Query infinite
 * data). Pinned messages live on the first (newest) page only.
 */
import type { InfiniteData } from '@tanstack/react-query';

import type { ChatMessage, ChatPage } from '@/types/live';

/**
 * Replace a message by id, or add it as the newest message.
 * @param data - Cached pages
 * @param incoming - Message from the server
 * @param fromRoom - true for live room events: they are neutral (no "mine" / my vote), so
 *   the viewer's own fields are kept from the cached copy
 * @returns New cache value
 */
export function putChatMessage(
  data: InfiniteData<ChatPage> | undefined,
  incoming: ChatMessage,
  fromRoom = false,
): InfiniteData<ChatPage> | undefined {
  if (!data) return data;
  let found = false;
  const merge = (current: ChatMessage): ChatMessage =>
    fromRoom
      ? {
          ...incoming,
          isMine: current.isMine,
          reportedByMe: current.reportedByMe || incoming.reportedByMe,
          poll: incoming.poll ? { ...incoming.poll, myVote: current.poll?.myVote ?? -1 } : null,
        }
      : incoming;

  const pages = data.pages.map((page, index) => {
    const messages = page.messages.map((item) => {
      if (item.id !== incoming.id) return item;
      found = true;
      return merge(item);
    });
    if (index !== 0) return { ...page, messages };
    const others = page.pinned.filter((item) => item.id !== incoming.id);
    const showPinned = incoming.pinned && !incoming.hidden;
    return { ...page, messages, pinned: showPinned ? [incoming, ...others] : others };
  });
  if (!found && pages[0]) pages[0] = { ...pages[0], messages: [incoming, ...pages[0].messages] };
  return { ...data, pages };
}
