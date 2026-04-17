import type { User } from './user';

export interface Reply {
  id: string;
  threadId: string;        // The parent Thread (Post, Meeting, Workshop, etc.)
  parentReplyId?: string;  // If this is a reply to another reply
  sessionId?: string;      // Optional link to a specific WorkshopSession
  userId: string;
  content: string;
  reactionCount: number;
  createdAt: Date;
  updatedAt: Date;
  editedAt?: Date;

  // Virtual/Join fields for UI
  user?: User;
  userName?: string;
  userAvatar?: string;
  userInitials?: string;
  userTrustLevel?: number;
  commentColor?: string;
  children?: Reply[];
}
