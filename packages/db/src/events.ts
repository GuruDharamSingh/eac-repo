import { db } from './client';
import { nanoid } from 'nanoid';

/**
 * Event System with Forum Aggregation
 * - Logs all activity for audit trail
 * - Handles forum queue and approval workflow
 * - Simplified with single-schema design
 */
export class Events {

  /**
   * Log an event when something happens in any org
   */
  static async log(
    orgId: string, 
    userId: string, 
    action: string, 
    resourceType: string,
    resourceId: string,
    data: any = {}
  ) {
    const event = {
      id: nanoid(),
      orgId,
      userId,
      action,
      resourceType,
      resourceId,
      data,
      createdAt: new Date()
    };

    await db`
      INSERT INTO events ${db(event)}
    `;

    return event;
  }

  /**
   * Submit a post to the forum queue
   * Called when user publishes a post with share_to_forum = true
   */
  static async submitToForumQueue(postId: string, orgId: string) {
    // Check if org allows auto-sharing
    const [org] = await db`
      SELECT auto_share_to_forum
      FROM organizations
      WHERE id = ${orgId}
    `;

    if (!org?.autoShareToForum) {
      return null;
    }

    // Check if already in queue
    const [existing] = await db`
      SELECT id FROM forum_queue
      WHERE post_id = ${postId}
    `;

    if (existing) {
      return existing;
    }

    // Add to queue
    const queueItem = {
      id: nanoid(),
      orgId,
      postId,
      status: 'pending',
      submittedAt: new Date()
    };

    await db`
      INSERT INTO forum_queue ${db(queueItem)}
    `;

    return queueItem;
  }

  /**
   * Get pending forum queue items for admin approval
   */
  static async getForumQueue() {
    return db`
      SELECT
        fq.*,
        p.title,
        p.excerpt,
        p.created_at as post_created_at,
        o.name as org_name,
        o.slug as org_slug,
        u.display_name as author_name
      FROM forum_queue fq
      JOIN posts p ON p.id = fq.post_id
      JOIN organizations o ON o.id = fq.org_id
      JOIN users u ON u.id = p.author_id
      WHERE fq.status = 'pending'
      ORDER BY fq.submitted_at DESC
    `;
  }

  /**
   * Admin approves content for forum
   * This COPIES the post to forum_posts for performance and history
   */
  static async approveForForum(queueId: string, adminId: string) {
    // Get the queue item
    const [item] = await db`
      SELECT * FROM forum_queue
      WHERE id = ${queueId} AND status = 'pending'
    `;

    if (!item) {
      throw new Error('Queue item not found or already processed');
    }

    // Get the actual post
    const [post] = await db`
      SELECT p.*, u.display_name as author_name
      FROM posts p
      JOIN users u ON u.id = p.author_id
      WHERE p.id = ${item.postId}
    `;

    if (!post) {
      // Post was deleted, clean up queue
      await db`DELETE FROM forum_queue WHERE id = ${queueId}`;
      throw new Error('Original post not found');
    }

    // Use transaction to ensure consistency
    await db.begin(async (tx) => {
      // Copy content to forum
      const forumPost = {
        id: nanoid(),
        orgId: item.orgId,
        originalPostId: post.id,
        title: post.title,
        body: post.body,
        excerpt: post.excerpt,
        authorId: post.authorId,
        authorName: post.authorName || 'Anonymous',
        tags: post.tags || [],
        metadata: post.metadata || {},
        approvedBy: adminId,
        approvedAt: new Date(),
        originalCreatedAt: post.createdAt,
        viewCount: 0,
        replyCount: 0
      };

      await tx`
        INSERT INTO forum_posts ${tx(forumPost)}
      `;

      // Update queue status
      await tx`
        UPDATE forum_queue
        SET 
          status = 'approved',
          reviewed_at = NOW(),
          reviewed_by = ${adminId}
        WHERE id = ${queueId}
      `;

      // Log the approval
      await tx`
        INSERT INTO events (id, org_id, user_id, action, resource_type, resource_id, data)
        VALUES (
          ${nanoid()},
          'admin',
          ${adminId},
          'forum_approved',
          'forum_post',
          ${forumPost.id},
          ${JSON.stringify({ queueId, originalPostId: post.id, orgId: item.orgId })}
        )
      `;
    });

    return true;
  }

  /**
   * Admin rejects a forum submission
   */
  static async rejectForumSubmission(queueId: string, adminId: string, note?: string) {
    const [item] = await db`
      SELECT * FROM forum_queue
      WHERE id = ${queueId} AND status = 'pending'
    `;

    if (!item) {
      throw new Error('Queue item not found or already processed');
    }

    await db`
      UPDATE forum_queue
      SET 
        status = 'rejected',
        reviewed_at = NOW(),
        reviewed_by = ${adminId},
        review_note = ${note || null}
      WHERE id = ${queueId}
    `;

    // Log the rejection
    await this.log('admin', adminId, 'forum_rejected', 'forum_queue', queueId, {
      postId: item.postId,
      orgId: item.orgId,
      note
    });

    return true;
  }

  /**
   * Get forum posts (fast query from copied content)
   */
  static async getForumPosts(limit = 50, offset = 0) {
    return db`
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
  }

  /**
   * Get a single forum post with replies
   */
  static async getForumPost(postId: string) {
    const [post] = await db`
      SELECT
        fp.*,
        o.name as org_name,
        o.slug as org_slug
      FROM forum_posts fp
      JOIN organizations o ON o.id = fp.org_id
      WHERE fp.id = ${postId}
    `;

    if (!post) return null;

    // Get replies
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

    return {
      ...post,
      replies
    };
  }

  /**
   * Get all events for admin dashboard
   */
  static async getAllEvents(limit = 100, offset = 0) {
    return db`
      SELECT
        e.*,
        o.name as org_name,
        u.display_name as user_name
      FROM events e
      LEFT JOIN organizations o ON o.id = e.org_id
      LEFT JOIN users u ON u.id = e.user_id
      ORDER BY e.created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;
  }

  /**
   * Get events for a specific organization
   */
  static async getOrgEvents(orgId: string, limit = 50) {
    return db`
      SELECT
        e.*,
        u.display_name as user_name
      FROM events e
      LEFT JOIN users u ON u.id = e.user_id
      WHERE e.org_id = ${orgId}
      ORDER BY e.created_at DESC
      LIMIT ${limit}
    `;
  }
}