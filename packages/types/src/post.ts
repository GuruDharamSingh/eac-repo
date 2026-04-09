import type { Organization } from './organization';
import type { UserSummary } from './user';
import type { Topic } from './topic';
import type { Media } from './media';

export type PostStatus = 'draft' | 'published' | 'archived';
export type PostVisibility = 'org' | 'network' | 'public';

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
  
  // Relations
  organization?: Organization;
  author?: UserSummary;
  topics?: Topic[];
  media?: Media[];
  coverImage?: Media;
}
