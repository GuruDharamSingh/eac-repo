import { getForumFeed, getThread, getReplies, deleteThread as dbDeleteThread, type ForumThread, type ForumFeedOptions, type Reply } from '@elkdonis/db';

export type { ForumThread, ForumFeedOptions, Reply };

export type SortOption = 'active' | 'newest' | 'oldest' | 'reactions';

export interface FeedResult {
  threads: ForumThread[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Fetch forum feed with optional filters
 */
export async function fetchForumFeed(options: ForumFeedOptions = {}): Promise<FeedResult> {
  return getForumFeed(options);
}

/**
 * Fetch a single thread by slug
 */
export async function fetchThread(slug: string, userId?: string) {
  return getThread(slug, userId);
}

/**
 * Fetch replies for a thread
 */
export async function fetchReplies(threadId: string, threadType: 'post' | 'meeting' | 'workshop', sort: 'oldest' | 'newest' | 'reactions' = 'oldest'): Promise<Reply[]> {
  return getReplies(threadId, threadType, sort);
}

/**
 * Delete a thread by ID
 */
export async function deleteThread(threadId: string): Promise<void> {
  await dbDeleteThread(threadId);
}

