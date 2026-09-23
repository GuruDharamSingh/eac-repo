import type { Organization } from './organization';
import type { UserSummary } from './user';
import type { Topic } from './topic';
import type { Media } from './media';

/**
 * Must match threads_status_check. 'pending' joined it with migration 156:
 * written, waiting on a moderator, and invisible to every read that filters
 * `status = 'published'` — which is all of them. See services/moderation.ts.
 */
export type PostStatus = 'draft' | 'pending' | 'published' | 'archived';
/**
 * Must match threads_visibility_check in the database. These are the literal
 * column values, not friendly names — the previous 'org' | 'network' | 'public'
 * matched nothing the CHECK allows, so any insert using them was rejected.
 */
export type PostVisibility = 'PUBLIC' | 'ORGANIZATION' | 'INVITE_ONLY';

export interface Post {
  id: string;
  orgId: string;
  authorId: string;
  title: string;
  slug: string;
  body?: string;
  excerpt?: string;
  status: PostStatus;
  visibility: PostVisibility;
  nextcloudFileId?: string;
  nextcloudLastSync?: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  publishedAt?: Date;
  updatedAt: Date;
  viewCount: number;
  replyCount: number;
  nextcloudTalkToken?: string;
  documentUrl?: string;

  // Relations
  organization?: Organization;
  author?: UserSummary;
  topics?: Topic[];
  media?: Media[];
  coverImage?: Media;
}
