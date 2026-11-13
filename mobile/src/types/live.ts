/**
 * Live update, chat and notification types (Socket.io events and /groups/:id/messages,
 * /notifications — PRD §10.7).
 */
import type { GroupMemberPreview, GroupStatus } from './group';

export const SOCKET_EVENTS = {
  JOIN_GROUP: 'group:join',
  LEAVE_GROUP: 'group:leave',
  GROUP_COUNT: 'group:count',
  GROUP_MEMBER: 'group:member',
  GROUP_STATUS: 'group:status',
  CHAT_MESSAGE: 'chat:message',
  CHAT_UPDATE: 'chat:update',
  NOTIFICATION: 'notification:new',
  AUCTION_LOWEST: 'auction:lowest',
  AUCTION_EXTENDED: 'auction:extended',
  AUCTION_WON: 'auction:won',
  DEAL_TIER: 'deal:tier',
} as const;

export interface GroupCountEvent {
  groupId: string;
  memberCount: number;
  targetSize: number;
  status: GroupStatus;
}

export interface GroupMemberEvent {
  groupId: string;
  member: Omit<GroupMemberPreview, 'isLeader'>;
}

export interface GroupStatusEvent {
  groupId: string;
  status: GroupStatus;
  memberCount: number;
}

export interface ChatPoll {
  question: string;
  closed: boolean;
  options: { text: string; votes: number }[];
  /** Index of my vote, -1 when I have not voted. */
  myVote: number;
}

export interface ChatMessage {
  id: string;
  senderType: 'buyer' | 'seller' | 'saathi' | 'system';
  sender: {
    firstName: string | null;
    avatarUrl: string | null;
    isLeader: boolean;
    isDealer?: boolean;
  } | null;
  isMine: boolean;
  text: string | null;
  images: { publicId: string; url: string }[];
  poll: ChatPoll | null;
  pinned: boolean;
  hidden: boolean;
  reportedByMe: boolean;
  createdAt: string;
}

export interface ChatPage {
  messages: ChatMessage[];
  pinned: ChatMessage[];
  hasMore: boolean;
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: { groupId?: string; url?: string; type?: string };
  read: boolean;
  createdAt: string;
}

/** New lowest price (shared numbers only, never dealer names — AUC-6). */
export interface AuctionLowestEvent {
  groupId: string;
  lowestPricePaise: number | null;
  savedPerMemberPaise: number | null;
  dealerCount: number;
  bidCount: number;
  endsAt: string | null;
  extensions: number;
}

export interface AuctionExtendedEvent {
  groupId: string;
  endsAt: string;
  extensions?: number;
  closedAt?: string;
}
