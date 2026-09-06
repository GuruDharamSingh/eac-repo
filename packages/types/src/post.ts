import type { Organization } from './organization';
import type { UserSummary } from './user';
import type { Topic } from './topic';
import type { Media } from './media';

export type PostStatus = 'draft' | 'published' | 'archived';
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
