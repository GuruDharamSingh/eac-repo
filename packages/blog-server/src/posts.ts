import { db, Events } from '@elkdonis/db';
import type { Post, PostStatus } from '@elkdonis/types';
import { createPost } from '@elkdonis/services';

export interface UploadedMedia {
  id: string;
  fileId: string;
  path: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  type: 'image' | 'video' | 'audio' | 'document';
}

export interface BlogPostSubmission {
  title: string;
  body: string;
  excerpt?: string;
  /** Defaults to 'published'. Blog apps had no way to save a draft before. */
  status?: PostStatus;
  link?: string;
  tags: string[];
  createForumThread: boolean;
  forumThreadTitle?: string;
  metadata?: Record<string, unknown>;
  media?: UploadedMedia[];
}

interface CreateBlogPostParams extends BlogPostSubmission {
  orgId: string;
  authorId: string;
}

export async function getPublishedPosts(orgId: string, limit = 20): Promise<Post[]> {
  const rows = await db`
    SELECT
      p.*,
      u.display_name AS author_name,
      u.email AS author_email,
      media_list.media_items
    FROM threads p
    LEFT JOIN users u ON u.id = p.author_id
    LEFT JOIN LATERAL (
      SELECT COALESCE(
        json_agg(
          json_build_object(
            'id', m.id,
            'orgId', m.org_id,
            'uploadedBy', m.uploaded_by,
            'attachedToType', m.attached_to_type,
            'attachedToId', m.attached_to_id,
            'nextcloudFileId', m.nextcloud_file_id,
            'nextcloudPath', m.nextcloud_path,
            'url', m.url,
            'type', m.type,
            'filename', m.filename,
            'sizeBytes', m.size_bytes,
            'mimeType', m.mime_type,
            'caption', m.caption,
            'altText', m.alt_text,
            'createdAt', m.created_at
          )
          ORDER BY m.created_at DESC
        ),
        '[]'::json
      ) AS media_items
      FROM media m
      WHERE m.attached_to_type = 'thread'
        AND m.attached_to_id = p.id
    ) media_list ON TRUE
    WHERE p.kind = 'post'
      AND p.org_id = ${orgId}
      AND p.status = 'published'
    ORDER BY p.published_at DESC NULLS LAST, p.created_at DESC
    LIMIT ${limit}
  `;

  return rows.map(mapPostFromDb);
}

export async function getPostBySlug(orgId: string, slug: string): Promise<Post | null> {
  const rows = await db`
    SELECT
      p.*,
      u.display_name AS author_name,
      u.email AS author_email,
      media_list.media_items
    FROM threads p
    LEFT JOIN users u ON u.id = p.author_id
    LEFT JOIN LATERAL (
      SELECT COALESCE(
        json_agg(
          json_build_object(
            'id', m.id,
            'orgId', m.org_id,
            'uploadedBy', m.uploaded_by,
            'attachedToType', m.attached_to_type,
            'attachedToId', m.attached_to_id,
            'nextcloudFileId', m.nextcloud_file_id,
            'nextcloudPath', m.nextcloud_path,
            'url', m.url,
            'type', m.type,
            'filename', m.filename,
            'sizeBytes', m.size_bytes,
            'mimeType', m.mime_type,
            'caption', m.caption,
            'altText', m.alt_text,
            'createdAt', m.created_at
          )
          ORDER BY m.created_at DESC
        ),
        '[]'::json
      ) AS media_items
      FROM media m
      WHERE m.attached_to_type = 'thread'
        AND m.attached_to_id = p.id
    ) media_list ON TRUE
    WHERE p.kind = 'post'
      AND p.org_id = ${orgId}
      AND p.slug = ${slug}
      AND p.status = 'published'
    LIMIT 1
  `;

  if (!rows.length) return null;
  return mapPostFromDb(rows[0]);
}

/**
 * Create a blog post.
 *
 * The thread insert now goes through @elkdonis/services createPost rather than
 * a second hand-rolled INSERT. What stays here is genuinely blog-specific: the
 * metadata shape, media attachment, and the activity event.
 *
 * Delegating fixes three things the local insert got wrong:
 *   - the slug was slugify(title) with no uniqueness check, so a repeated
 *     title violated UNIQUE (org_id, slug) and surfaced to the author as a 500
 *   - status was hardcoded 'published', so blog authors could not save a draft
 *   - published_at was stamped unconditionally
 */
export async function createBlogPost(params: CreateBlogPostParams): Promise<Post> {
  const status: PostStatus = params.status ?? 'published';

  const metadata = {
    ...(params.metadata || {}),
    link: params.link || null,
    tags: params.tags,
    createForumThread: params.createForumThread,
    forumThreadTitle: params.forumThreadTitle || null,
  };

  const post = await createPost({
    title: params.title,
    orgId: params.orgId,
    authorId: params.authorId,
    body: params.body,
    excerpt: params.excerpt,
    status,
    // Blog posts are public by definition; these blogs have no members-only view.
    visibility: 'PUBLIC',
    metadata,
  });

  if (params.media?.length) {
    await attachMediaToPost(params.media, params.orgId, post.id, params.authorId);
  }

  // Only an actual publish is a publish. Logging a draft as 'post_published'
  // would put unpublished work into the network activity feed.
  if (status === 'published') {
    await Events.log(
      params.orgId,
      params.authorId,
      'post_published',
      'post',
      post.id,
      { title: params.title, excerpt: post.excerpt ?? '' }
    );
  }

  return post;
}

async function attachMediaToPost(
  media: UploadedMedia[],
  orgId: string,
  postId: string,
  authorId: string
) {
  for (const item of media) {
    await db`
      UPDATE media
      SET
        attached_to_type = 'thread',
        attached_to_id = ${postId},
        uploaded_by = ${authorId}
      WHERE id = ${item.id}
        AND org_id = ${orgId}
    `;
  }
}

function mapPostFromDb(row: any): Post {
  const mediaItems = Array.isArray(row.media_items)
    ? row.media_items
    : row.media_items
    ? JSON.parse(row.media_items)
    : [];

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
    author: row.author_name
      ? {
          id: row.author_id,
          displayName: row.author_name,
          email: row.author_email || undefined,
        }
      : undefined,
    media: mediaItems.map((item: any) => ({
      id: item.id,
      orgId: item.orgId,
      uploadedBy: item.uploadedBy,
      attachedToType: item.attachedToType || undefined,
      attachedToId: item.attachedToId || undefined,
      nextcloudFileId: item.nextcloudFileId,
      nextcloudPath: item.nextcloudPath,
      url: item.url,
      type: item.type || undefined,
      filename: item.filename || undefined,
      sizeBytes: item.sizeBytes || undefined,
      mimeType: item.mimeType || undefined,
      caption: item.caption || undefined,
      altText: item.altText || undefined,
      createdAt: item.createdAt ? new Date(item.createdAt) : row.created_at,
    })),
  } as Post;
}

