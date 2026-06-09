/**
 * Canonical types for the internal messaging domain.
 * Mirrors packages/db/migrations/059_messaging.sql.
 */

/** Optional thing a conversation is "about", scoped by any app. */
export interface ConversationContext {
  /** e.g. "artwork" | "order" | "org" | "direct" — app-defined. */
  type: string;
  /** Id of the context entity (kept as text so any id shape works). */
  id: string;
}

export interface MessageParticipant {
  userId: string;
  displayName: string | null;
  email: string | null;
  lastReadAt: string | null;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
  /** Joined for display. */
  senderName?: string | null;
}

export interface Conversation {
  id: string;
  subject: string | null;
  context: ConversationContext | null;
  createdAt: string;
  lastMessageAt: string;
}

/** A conversation as shown in a user's inbox list. */
export interface ConversationSummary extends Conversation {
  /** Everyone in the thread except the viewing user. */
  others: MessageParticipant[];
  /** Most recent message body + time, for the list preview. */
  lastMessagePreview: string | null;
  lastMessageSenderId: string | null;
  /** Unread messages for the viewing user. */
  unreadCount: number;
}

/** A full conversation with its messages + participants. */
export interface ConversationThread extends Conversation {
  participants: MessageParticipant[];
  messages: Message[];
}
