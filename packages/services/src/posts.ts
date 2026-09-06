import { db } from '@elkdonis/db';
import { nanoid } from 'nanoid';
import type { Post, PostStatus, PostVisibility } from '@elkdonis/types';
import { deriveExcerpt } from '@elkdonis/utils';
import { ensureUniqueThreadSlug } from './thread-slug';

interface CreatePostData {
  title: string;
  slug?: string;
  orgId: string;
  authorId: string;
  body?: string;
  excerpt?: string;
  status?: PostStatus;
  visibility?: PostVisibility;
  nextcloudFileId?: string;
  nextcloudLastSync?: string;
  metadata?: Record<string, unknown>;
}

interface UpdatePostData extends Partial<CreatePostData> {}

/**
 * Create a post (a thread with kind='post').
 *
 * This is the single write path every app should use. It previously could not
 * succeed at all: it omitted `id` (NOT NULL, no default) and defaulted
 * visibility to 'org', which threads_visibility_check rejects. Nothing called
 * it, so nothing surfaced the breakage.
 *
 * Three things it now gets right that the app-local copies do not:
 *   - allocates a collision-free slug, so a repeated title is not a 500
 *   - stamps published_at only when actually publishing, so saving a draft
 *     does not backdate it and flipping to draft does not invent one
 *   - derives an excerpt when the author left it blank
 */
export async function createPost(data: CreatePostData): Promise<Post> {
  const status: PostStatus = data.status || 'published';
  const visibility: PostVisibility = data.visibility || 'PUBLIC';

  const slug = data.slug
    ? await ensureUniqueThreadSlug(data.orgId, data.slug)
    : await ensureUniqueThreadSlug(data.orgId, data.title);

  const excerpt = data.excerpt || deriveExcerpt(data.body);
  const metadata = data.metadata ?? {};

  const [post] = await db`
    INSERT INTO threads (
      id,
      kind,
      title,
      slug,
      org_id,
      author_id,
      body,
      excerpt,
      status,
      visibility,
      nextcloud_file_id,
      nextcloud_last_sync,
      metadata,
      published_at
    ) VALUES (
      ${nanoid()},
      'post',
      ${data.title},
      ${slug},
      ${data.orgId},
      ${data.authorId},
      ${data.body || null},
      ${excerpt},
      ${status},
      ${visibility},
      ${data.nextcloudFileId || null},
      ${data.nextcloudLastSync || null},
      ${db.json(metadata as any)},
      ${status === 'published' ? db`NOW()` : null}
    )
    RETURNING *
  `;

  return mapPostFromDb(post);
}

/**
 * Get posts by organization
 */
export async function getPostsByOrg(
  orgId: string,
  limit = 50
): Promise<Post[]> {
  const posts = await db`
    SELECT t.*, u.display_name as author_name, u.email as author_email
    FROM threads t
    LEFT JOIN users u ON t.author_id = u.id
    WHERE t.kind = 'post'
      AND t.org_id = ${orgId}
      AND t.status = 'published'
    ORDER BY t.published_at DESC NULLS LAST, t.created_at DESC
    LIMIT ${limit}
  `;

  return posts.map(mapPostFromDb);
}

/**
 * Get recent posts
 */
export async function getRecentPosts(
  orgId?: string,
  limit = 20
): Promise<Post[]> {
  const posts = await (orgId
    ? db`
        SELECT t.*, u.display_name as author_name, u.email as author_email
        FROM threads t
        LEFT JOIN users u ON t.author_id = u.id
        WHERE t.kind = 'post'
          AND t.org_id = ${orgId}
          AND t.status = 'published'
        ORDER BY t.published_at DESC NULLS LAST, t.created_at DESC
        LIMIT ${limit}
      `
    : db`
        SELECT t.*, u.display_name as author_name, u.email as author_email
        FROM threads t
        LEFT JOIN users u ON t.author_id = u.id
        WHERE t.kind = 'post'
          AND t.status = 'published'
        ORDER BY t.published_at DESC NULLS LAST, t.created_at DESC
        LIMIT ${limit}
      `);

  return posts.map(mapPostFromDb);
}

/**
 * Get post by slug
 */
export async function getPostBySlug(
  slug: string,
  orgId?: string
): Promise<Post | null> {
  const posts = await (orgId
    ? db`
        SELECT t.*, u.display_name as author_name, u.email as author_email
        FROM threads t
        LEFT JOIN users u ON t.author_id = u.id
        WHERE t.kind = 'post'
          AND t.slug = ${slug}
          AND t.org_id = ${orgId}
          AND t.status = 'published'
      `
    : db`
        SELECT t.*, u.display_name as author_name, u.email as author_email
        FROM threads t
        LEFT JOIN users u ON t.author_id = u.id
        WHERE t.kind = 'post'
          AND t.slug = ${slug}
          AND t.status = 'published'
      `);

  const [post] = posts;
  return post ? mapPostFromDb(post) : null;
}

/**
 * Update a post
 */
/**
 * Update a post.
 *
 * Takes orgId as well as id, and scopes the UPDATE by both. The previous
 * version matched on `id` alone, which meant any caller holding an id could
 * write across tenant boundaries — the one place in this file where a mistake
 * was a data-isolation problem rather than a broken insert.
 *
 * `published_at` follows the semantics amrit-canada and hidden-enneagram
 * arrived at independently, which are the correct ones:
 *   - publishing for the first time stamps it
 *   - re-publishing keeps the ORIGINAL date (COALESCE), so editing a live post
 *     doesn't move it to the top of the feed
 *   - unpublishing preserves the date rather than destroying it, so putting a
 *     post back to draft and publishing again doesn't lose when it first ran
 */
export async function updatePost(
  id: string,
  orgId: string,
  data: UpdatePostData
): Promise<Post> {
  const updates: Record<string, unknown> = {};

  if (data.title !== undefined) updates.title = data.title;
  if (data.body !== undefined) updates.body = data.body;
  if (data.visibility !== undefined) updates.visibility = data.visibility;
  if (data.nextcloudFileId !== undefined) updates.nextcloud_file_id = data.nextcloudFileId;
  if (data.nextcloudLastSync !== undefined) updates.nextcloud_last_sync = data.nextcloudLastSync;
  if (data.metadata !== undefined) updates.metadata = db.json(data.metadata as any);

  // A changed slug still has to be unique within the org; excludeId keeps the
  // post from colliding with itself and bumping to -2 on every save.
  if (data.slug !== undefined) {
    updates.slug = await ensureUniqueThreadSlug(orgId, data.slug, id);
  }

  // Re-derive the excerpt when the body changed and the author didn't supply one.
  if (data.excerpt !== undefined) {
    updates.excerpt = data.excerpt;
  } else if (data.body !== undefined) {
    updates.excerpt = deriveExcerpt(data.body);
  }

  const status = data.status;
  if (status !== undefined) updates.status = status;

  const [post] = await db`
    UPDATE threads
    SET ${db(updates)},
        published_at = CASE
          WHEN ${status ?? null}::text IS NULL THEN published_at
          WHEN ${status ?? null}::text = 'published' THEN COALESCE(published_at, NOW())
          ELSE published_at
        END,
        updated_at = NOW()
    WHERE kind = 'post' AND id = ${id} AND org_id = ${orgId}
    RETURNING *
  `;

  if (!post) {
    throw new Error(`Post ${id} not found in org ${orgId}`);
  }

  return mapPostFromDb(post);
}

/**
 * Delete a post (soft delete)
 */
export async function deletePost(id: string, orgId: string): Promise<void> {
  // Org-scoped for the same reason as updatePost: an id alone must not be
  // enough to archive another tenant's post. Archive rather than DELETE so
  // replies and RSVPs keep their foreign keys.
  await db`
    UPDATE threads
    SET status = 'archived', updated_at = NOW()
    WHERE kind = 'post' AND id = ${id} AND org_id = ${orgId}
  `;
}

function mapPostFromDb(row: any): Post {
  return {
    id: row.id,
    orgId: row.org_id,
    authorId: row.author_id,
    title: row.title,
    slug: row.slug,
    body: row.body || undefined,
    excerpt: row.excerpt || undefined,
    status: row.status,
    visibility: row.visibility,
    nextcloudFileId: row.nextcloud_file_id || undefined,
    nextcloudLastSync: row.nextcloud_last_sync || undefined,
    metadata: row.metadata || undefined,
    createdAt: row.created_at,
    publishedAt: row.published_at || undefined,
    updatedAt: row.updated_at,
    viewCount: row.view_count || 0,
    replyCount: row.reply_count || 0,
    organization: undefined,
    author: row.author_name
      ? {
          id: row.author_id,
          displayName: row.author_name,
          email: row.author_email || undefined,
        }
      : undefined,
    topics: undefined,
  } as Post;
}
