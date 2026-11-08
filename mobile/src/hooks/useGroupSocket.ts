/**
 * useGroupSocket — follow one group live (LIV-1): joins its room, applies the counter,
 * new members, status changes and chat messages straight into the TanStack Query cache,
 * and reports whether we are live so screens can fall back to polling.
 */
import { type InfiniteData, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import {
  connectSocket,
  getSocket,
  isSocketConnected,
  onSocketConnectionChange,
} from '@/lib/socket';
import type { GroupDetail } from '@/types/group';
import {
  type ChatMessage,
  type ChatPage,
  type GroupCountEvent,
  type GroupMemberEvent,
  type GroupStatusEvent,
  SOCKET_EVENTS,
} from '@/types/live';
import { putChatMessage } from '@/utils/chatCache';

/** Chat cache key for a group. */
export const chatKey = (groupId: string) => ['chat', groupId] as const;

/**
 * @param groupId - Group to follow (undefined while loading)
 * @param code - Invite code (community groups)
 * @returns `connected` and the last member who joined (for the join animation)
 */
export function useGroupSocket(groupId: string | undefined, code?: string) {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(isSocketConnected());
  const [lastJoined, setLastJoined] = useState<GroupMemberEvent['member'] | null>(null);

  useEffect(() => onSocketConnectionChange(setConnected), []);

  useEffect(() => {
    if (!groupId) return undefined;
    connectSocket();
    const socket = getSocket();

    const join = () =>
      socket.emit(
        SOCKET_EVENTS.JOIN_GROUP,
        { groupId, code },
        (ack: Partial<GroupCountEvent> & { ok: boolean }) => {
          // Current state right after (re)connecting
          if (ack?.ok && typeof ack.memberCount === 'number') {
            queryClient.setQueryData<GroupDetail>(['group', groupId], (group) =>
              group ? { ...group, memberCount: ack.memberCount as number } : group,
            );
          }
        },
      );

    const onCount = (event: GroupCountEvent) => {
      if (event.groupId !== groupId) return;
      queryClient.setQueryData<GroupDetail>(['group', groupId], (group) =>
        group
          ? {
              ...group,
              memberCount: event.memberCount,
              seatsLeft: Math.max(0, event.targetSize - event.memberCount),
            }
          : group,
      );
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    };
    const onMember = (event: GroupMemberEvent) => {
      if (event.groupId !== groupId) return;
      setLastJoined(event.member);
      queryClient.setQueryData<GroupDetail>(['group', groupId], (group) =>
        group
          ? { ...group, members: [...group.members, { ...event.member, isLeader: false }] }
          : group,
      );
    };
    const onStatus = (event: GroupStatusEvent) => {
      if (event.groupId !== groupId) return;
      // Status changes affect many fields (timeline, actions): reload the page data
      queryClient.invalidateQueries({ queryKey: ['group', groupId] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    };
    const onChat = ({ groupId: id, message }: { groupId: string; message: ChatMessage }) => {
      if (id !== groupId) return;
      queryClient.setQueryData<InfiniteData<ChatPage>>(chatKey(groupId), (data) =>
        putChatMessage(data, message, true),
      );
    };

    if (socket.connected) join();
    socket.on('connect', join);
    socket.on(SOCKET_EVENTS.GROUP_COUNT, onCount);
    socket.on(SOCKET_EVENTS.GROUP_MEMBER, onMember);
    socket.on(SOCKET_EVENTS.GROUP_STATUS, onStatus);
    socket.on(SOCKET_EVENTS.CHAT_MESSAGE, onChat);
    socket.on(SOCKET_EVENTS.CHAT_UPDATE, onChat);

    return () => {
      socket.emit(SOCKET_EVENTS.LEAVE_GROUP, { groupId });
      socket.off('connect', join);
      socket.off(SOCKET_EVENTS.GROUP_COUNT, onCount);
      socket.off(SOCKET_EVENTS.GROUP_MEMBER, onMember);
      socket.off(SOCKET_EVENTS.GROUP_STATUS, onStatus);
      socket.off(SOCKET_EVENTS.CHAT_MESSAGE, onChat);
      socket.off(SOCKET_EVENTS.CHAT_UPDATE, onChat);
    };
  }, [groupId, code, queryClient]);

  return { connected, lastJoined };
}
