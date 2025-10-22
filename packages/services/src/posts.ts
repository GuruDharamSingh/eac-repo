import { db } from '@elkdonis/db';
import type { Post, PostStatus, PostVisibility } from '@elkdonis/types';
import { slugify } from '@elkdonis/utils';

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
 * Create a new post
 */
export async function createPost(data: CreatePostData): Promise<Post> {
  const slug = data.slug || slugify(data.title);
  const metadata = data.metadata ?? {};

  const [post] = await db`
    INSERT INTO posts (
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
      metadata
    ) VALUES (
      ${data.title},
      ${slug},
      ${data.orgId},
      ${data.authorId},
      ${data.body || null},
      ${data.excerpt || null},
      ${data.status || 'published'},
      ${data.visibility || 'org'},
      ${data.nextcloudFileId || null},
      ${data.nextcloudLastSync || null},
      ${db.json(metadata as any)}
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
    SELECT p.*, u.display_name as author_name, u.email as author_email
    FROM posts p
    LEFT JOIN users u ON p.author_id = u.id
    WHERE p.org_id = ${orgId}
      AND p.status = 'published'
    ORDER BY p.published_at DESC NULLS LAST, p.created_at DESC
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
        SELECT p.*, u.display_name as author_name, u.email as author_email
        FROM posts p
        LEFT JOIN users u ON p.author_id = u.id
        WHERE p.org_id = ${orgId}
          AND p.status = 'published'
        ORDER BY p.published_at DESC NULLS LAST, p.created_at DESC
        LIMIT ${limit}
      `
    : db`
        SELECT p.*, u.display_name as author_name, u.email as author_email
        FROM posts p
        LEFT JOIN users u ON p.author_id = u.id
        WHERE p.status = 'published'
        ORDER BY p.published_at DESC NULLS LAST, p.created_at DESC
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
        SELECT p.*, u.display_name as author_name, u.email as author_email
        FROM posts p
        LEFT JOIN users u ON p.author_id = u.id
        WHERE p.slug = ${slug}
          AND p.org_id = ${orgId}
          AND p.status = 'published'
      `
    : db`
        SELECT p.*, u.display_name as author_name, u.email as author_email
        FROM posts p
        LEFT JOIN users u ON p.author_id = u.id
        WHERE p.slug = ${slug}
          AND p.status = 'published'
      `);

  const [post] = posts;
  return post ? mapPostFromDb(post) : null;
}

/**
 * Update a post
 */
export async function updatePost(
  id: string,
  data: UpdatePostData
): Promise<Post> {
  const updates: Record<string, unknown> = {};

  if (data.title !== undefined) updates.title = data.title;
  if (data.slug !== undefined) updates.slug = data.slug;
  if (data.body !== undefined) updates.body = data.body;
  if (data.excerpt !== undefined) updates.excerpt = data.excerpt;
  if (data.status !== undefined) updates.status = data.status;
  if (data.visibility !== undefined) updates.visibility = data.visibility;
  if (data.nextcloudFileId !== undefined) updates.nextcloud_file_id = data.nextcloudFileId;
  if (data.nextcloudLastSync !== undefined) updates.nextcloud_last_sync = data.nextcloudLastSync;
  if (data.metadata !== undefined) updates.metadata = db.json(data.metadata as any);

  const [post] = await db`
    UPDATE posts
    SET ${db(updates)}, updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;

  return mapPostFromDb(post);
}

/**
 * Delete a post (soft delete)
 */
export async function deletePost(id: string): Promise<void> {
  await db`
    UPDATE posts
    SET status = 'archived', updated_at = NOW()
    WHERE id = ${id}
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
