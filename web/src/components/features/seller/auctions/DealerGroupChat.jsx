'use client';

/**
 * DealerGroupChat — the winning dealer talks to the group's buyers (Day 13 carry-over,
 * LIV-5). Messages are posted as the business, never the staff member's own name; buyers
 * show by first name only. Live through the group's Socket.io room, polling every 10 s
 * while the socket is down.
 */
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, MessageCircle, Send } from 'lucide-react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import { getSellerSocket } from '@/lib/sellerSocket';
import { listGroupMessages, sendGroupMessage } from '@/services/sellerAuction.service';
import { AUCTION_POLL_MS, SOCKET_EVENTS } from '@/utils/constants';
import { cn, formatDateTime } from '@/utils/genericFunctions';

/**
 * @param {Object} props
 * @param {string} props.groupId
 * @returns {JSX.Element}
 */
export default function DealerGroupChat({ groupId }) {
  const queryClient = useQueryClient();
  const queryKey = ['seller', 'group-chat', groupId];
  const liveRef = useRef(false);
  const [text, setText] = useState('');
  const query = useQuery({
    queryKey,
    queryFn: () => listGroupMessages({ groupId }),
    refetchInterval: () => (liveRef.current ? false : AUCTION_POLL_MS),
  });
  const send = useMutation({
    mutationFn: sendGroupMessage,
    onSuccess: () => {
      setText('');
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // Follow the group room; new messages refresh the list
  useEffect(() => {
    const socket = getSellerSocket();
    const join = () =>
      socket.emit(SOCKET_EVENTS.GROUP_JOIN, { groupId }, (ack) => {
        liveRef.current = Boolean(ack?.ok);
      });
    const onMessage = () =>
      queryClient.invalidateQueries({ queryKey: ['seller', 'group-chat', groupId] });
    const onDisconnect = () => {
      liveRef.current = false;
    };
    socket.on('connect', join);
    socket.on('disconnect', onDisconnect);
    socket.on(SOCKET_EVENTS.CHAT_MESSAGE, onMessage);
    if (socket.connected) join();
    else socket.connect();
    return () => {
      socket.emit(SOCKET_EVENTS.GROUP_LEAVE, { groupId });
      socket.off('connect', join);
      socket.off('disconnect', onDisconnect);
      socket.off(SOCKET_EVENTS.CHAT_MESSAGE, onMessage);
      liveRef.current = false;
    };
  }, [groupId, queryClient]);

  const messages = [...(query.data?.messages || [])].reverse(); // oldest first

  return (
    <section className="rounded-card border border-line bg-surface shadow-card">
      <div className="flex items-center gap-3 border-b border-line px-5 py-4 sm:px-6">
        <MessageCircle className="size-5 text-primary" strokeWidth={2} aria-hidden="true" />
        <div>
          <h2 className="text-base font-bold text-ink">Group chat</h2>
          <p className="text-xs text-muted">Buyers see your messages under your business name.</p>
        </div>
      </div>
      <div
        className="flex max-h-[420px] min-h-40 flex-col gap-3 overflow-y-auto px-5 py-4 sm:px-6"
        aria-live="polite"
      >
        {query.isPending ? (
          <div className="h-32 animate-pulse rounded-card bg-bg-band" aria-busy="true" />
        ) : query.isError ? (
          <Alert>{query.error.message}</Alert>
        ) : messages.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">
            No messages yet. Say hello and share showroom timings.
          </p>
        ) : (
          messages.map((message) => {
            const mine = message.senderType === 'seller';
            return (
              <div
                key={message.id}
                className={cn(
                  'flex max-w-[85%] flex-col',
                  mine ? 'self-end items-end' : 'self-start',
                )}
              >
                <span className="text-xs font-semibold text-muted">
                  {message.senderType === 'system'
                    ? 'SaathMein'
                    : message.sender?.firstName || 'Member'}
                  {message.sender?.isLeader ? ' · leader' : ''}
                </span>
                <p
                  className={cn(
                    'mt-0.5 whitespace-pre-wrap break-words rounded-card px-3 py-2 text-sm',
                    mine ? 'bg-primary/10 text-ink' : 'bg-bg-band text-ink',
                  )}
                >
                  {message.hidden ? (
                    <span className="italic text-muted">Hidden after reports</span>
                  ) : (
                    message.text ||
                    (message.images?.length
                      ? 'Photo'
                      : message.poll
                        ? `Poll: ${message.poll.question}`
                        : '')
                  )}
                </p>
                <span className="mt-0.5 text-[11px] text-muted">
                  {formatDateTime(message.createdAt)}
                </span>
              </div>
            );
          })
        )}
      </div>
      <form
        className="flex items-end gap-2 border-t border-line px-5 py-3 sm:px-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (text.trim()) send.mutate({ groupId, text: text.trim() });
        }}
      >
        <label className="min-w-0 flex-1">
          <span className="sr-only">Message</span>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={1}
            maxLength={1000}
            placeholder="Write to the group"
            className="min-h-11 w-full resize-y rounded-button border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-primary focus:outline-none"
          />
        </label>
        <Button type="submit" disabled={send.isPending || !text.trim()} aria-label="Send message">
          {send.isPending ? (
            <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden="true" />
          ) : (
            <Send className="size-4" strokeWidth={2} aria-hidden="true" />
          )}
        </Button>
      </form>
      {send.isError ? <Alert className="mx-5 mb-3 sm:mx-6">{send.error.message}</Alert> : null}
    </section>
  );
}
