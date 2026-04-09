import { db } from './client';
import { nanoid } from 'nanoid';

/**
 * Forum Sync - Helper functions for the built-in forum
 * Simplified to work with our single-schema design
 */

export class ForumSync {

  /**
   * Get paginated forum posts for the forum app
   */
  static async getForumData(page = 1, limit = 20) {
    const offset = (page - 1) * limit;

    const posts = await db`
      SELECT
        fp.*,
        o.name as org_name,
        o.slug as org_slug,
        o.settings as org_settings
      FROM forum_posts fp
      JOIN organizations o ON o.id = fp.org_id
      ORDER BY fp.approved_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const [{ count }] = await db`
      SELECT COUNT(*)::int as count FROM forum_posts
    `;

    return {
      posts,
      pagination: {
        page,
        limit,
        total: count,
        pages: Math.ceil(count / limit),
        hasNext: page < Math.ceil(count / limit),
        hasPrev: page > 1
      }
    };
  }

  /**
   * Get a single forum post with all details and replies
   */
  static async getForumPost(postId: string) {
    const [post] = await db`
      SELECT
        fp.*,
        o.name as org_name,
        o.slug as org_slug,
        o.settings as org_settings
      FROM forum_posts fp
      JOIN organizations o ON o.id = fp.org_id
      WHERE fp.id = ${postId}
    `;

    if (!post) return null;

    // Get all replies in a threaded structure
    const replies = await db`
      SELECT
        fr.*,
        u.display_name as author_name,
        u.avatar_url as author_avatar
      FROM forum_replies fr
      JOIN users u ON u.id = fr.user_id
      WHERE fr.post_id = ${postId}
      ORDER BY fr.created_at ASC
    `;

    // Increment view count
    await db`
      UPDATE forum_posts
      SET view_count = view_count + 1
      WHERE id = ${postId}
    `;

    return {
      ...post,
      replies
    };
  }

  /**
   * Add a reply to a forum post
   */
  static async addReply(
    postId: string,
    userId: string,
    content: string,
    parentReplyId?: string
  ) {
    const replyId = nanoid();

    await db`
      INSERT INTO forum_replies (
        id, post_id, user_id, content, parent_reply_id, created_at
      ) VALUES (
        ${replyId},
        ${postId},
        ${userId},
        ${content},
        ${parentReplyId || null},
        NOW()
      )
    `;

    // Update reply count
    await db`
      UPDATE forum_posts
      SET reply_count = reply_count + 1
      WHERE id = ${postId}
    `;

    return replyId;
  }

  /**
   * Update a reply
   */
  static async updateReply(
    replyId: string,
    userId: string,
    content: string
  ) {
    const [reply] = await db`
      UPDATE forum_replies
      SET content = ${content}, updated_at = NOW()
      WHERE id = ${replyId} AND user_id = ${userId}
      RETURNING *
    `;

    return reply;
  }

  /**
   * Delete a reply (soft delete by clearing content)
   */
  static async deleteReply(replyId: string, userId: string) {
    const [reply] = await db`
      SELECT * FROM forum_replies
      WHERE id = ${replyId}
    `;

    if (!reply) return false;

    // Check if user owns the reply or is admin
    const [user] = await db`
      SELECT is_admin FROM users WHERE id = ${userId}
    `;

    if (reply.userId !== userId && !user?.isAdmin) {
      throw new Error('Not authorized to delete this reply');
    }

    await db`
      UPDATE forum_replies
      SET content = '[deleted]', updated_at = NOW()
      WHERE id = ${replyId}
    `;

    // Decrement reply count
    await db`
      UPDATE forum_posts
      SET reply_count = reply_count - 1
      WHERE id = ${reply.postId}
    `;

    return true;
  }

  /**
   * Get forum stats for dashboard
   */
  static async getForumStats() {
    const [stats] = await db`
      SELECT
        (SELECT COUNT(*) FROM forum_posts) as total_posts,
        (SELECT COUNT(*) FROM forum_replies) as total_replies,
        (SELECT SUM(view_count) FROM forum_posts) as total_views,
        (SELECT COUNT(DISTINCT author_id) FROM forum_posts) as unique_authors
    `;

    return stats;
  }

  /**
   * Search forum posts
   */
  static async searchPosts(query: string, limit = 20) {
    return db`
      SELECT
        fp.*,
        o.name as org_name,
        o.slug as org_slug,
        ts_rank(
          to_tsvector('english', fp.title || ' ' || COALESCE(fp.body, '')),
          plainto_tsquery('english', ${query})
        ) as rank
      FROM forum_posts fp
      JOIN organizations o ON o.id = fp.org_id
      WHERE
        to_tsvector('english', fp.title || ' ' || COALESCE(fp.body, ''))
        @@ plainto_tsquery('english', ${query})
      ORDER BY rank DESC, fp.approved_at DESC
      LIMIT ${limit}
    `;
  }
}