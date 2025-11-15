import { db } from './client';
import { nanoid } from 'nanoid';

/**
 * Event System - Wide Net Activity Logging
 *
 * Vision: Log ALL activity across the network for admin oversight.
 * Forum surfaces content directly from posts/meetings/replies tables.
 * Admin has full veto power via visibility overrides and moderation actions.
 *
 * This is NOT a queue system - it's an audit trail with admin controls.
 */

export type EventAction =
  // Content lifecycle
  | 'post_created' | 'post_published' | 'post_updated' | 'post_deleted'
  | 'meeting_created' | 'meeting_published' | 'meeting_updated' | 'meeting_deleted'
  | 'reply_created' | 'reply_updated' | 'reply_deleted'
  // User actions
  | 'user_joined_org' | 'user_left_org'
  | 'meeting_rsvp' | 'meeting_attended'
  // Interactions
  | 'reaction_added' | 'reaction_removed'
  | 'content_bookmarked' | 'content_unbookmarked'
  | 'thread_watched' | 'thread_unwatched'
  // Media
  | 'media_uploaded' | 'media_attached' | 'media_deleted'
  // Moderation (admin actions)
  | 'content_hidden' | 'content_unhidden'
  | 'content_pinned' | 'content_unpinned'
  | 'content_locked' | 'content_unlocked'
  | 'content_flagged' | 'flag_resolved'
  | 'user_banned' | 'user_unbanned'
  | 'visibility_override';

export type ResourceType =
  | 'post' | 'meeting' | 'reply'
  | 'user' | 'organization'
  | 'media' | 'reaction' | 'bookmark' | 'watch' | 'flag';

export class Events {

  /**
   * Log an event - cast wide net for all network activity
   */
  static async log(
    orgId: string | null, // null for cross-org admin actions
    userId: string,
    action: EventAction,
    resourceType: ResourceType,
    resourceId: string,
    data: any = {}
  ) {
    const event = {
      id: nanoid(),
      org_id: orgId,
      user_id: userId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      data,
      created_at: new Date()
    };

    await db`
      INSERT INTO events ${db(event)}
    `;

    return event;
  }

  /**
   * Get all events for admin dashboard with filtering
   */
  static async getAllEvents(options: {
    limit?: number;
    offset?: number;
    orgId?: string;
    userId?: string;
    action?: EventAction;
    resourceType?: ResourceType;
  } = {}) {
    const { limit = 100, offset = 0, orgId, userId, action, resourceType } = options;

    let query = db`
      SELECT
        e.*,
        o.name as org_name,
        o.slug as org_slug,
        u.display_name as user_name,
        u.email as user_email,
        u.avatar_url as user_avatar
      FROM events e
      LEFT JOIN organizations o ON o.id = e.org_id
      LEFT JOIN users u ON u.id = e.user_id
      WHERE 1=1
    `;

    // Apply filters
    if (orgId) {
      query = db`${query} AND e.org_id = ${orgId}`;
    }
    if (userId) {
      query = db`${query} AND e.user_id = ${userId}`;
    }
    if (action) {
      query = db`${query} AND e.action = ${action}`;
    }
    if (resourceType) {
      query = db`${query} AND e.resource_type = ${resourceType}`;
    }

    query = db`
      ${query}
      ORDER BY e.created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    return query;
  }

  /**
   * Admin: Override content visibility (veto power)
   * Forces content to be org-only even if author set it PUBLIC
   */
  static async overrideVisibility(
    resourceType: 'post' | 'meeting',
    resourceId: string,
    newVisibility: 'PUBLIC' | 'ORGANIZATION' | 'INVITE_ONLY',
    adminId: string,
    reason?: string
  ) {
    const table = resourceType === 'post' ? 'posts' : 'meetings';

    await db`
      UPDATE ${db(table)}
      SET
        visibility = ${newVisibility},
        metadata = jsonb_set(
          COALESCE(metadata, '{}'::jsonb),
          '{admin_override}',
          jsonb_build_object(
            'admin_id', ${adminId},
            'previous_visibility', visibility,
            'reason', ${reason || 'Admin override'},
            'timestamp', NOW()
          )
        )
      WHERE id = ${resourceId}
    `;

    // Log the override
    await this.log(null, adminId, 'visibility_override', resourceType, resourceId, {
      newVisibility,
      reason
    });
  }

  /**
   * Admin: Hide content from forum (doesn't delete, just prevents surfacing)
   */
  static async hideContent(
    resourceType: 'post' | 'meeting',
    resourceId: string,
    adminId: string,
    reason?: string
  ) {
    const table = resourceType === 'post' ? 'posts' : 'meetings';

    await db`
      UPDATE ${db(table)}
      SET
        metadata = jsonb_set(
          COALESCE(metadata, '{}'::jsonb),
          '{hidden}',
          'true'::jsonb
        ),
        metadata = jsonb_set(
          metadata,
          '{hidden_by}',
          ${JSON.stringify({ adminId, reason, timestamp: new Date() })}::jsonb
        )
      WHERE id = ${resourceId}
    `;

    await this.log(null, adminId, 'content_hidden', resourceType, resourceId, { reason });
  }

  /**
   * Admin: Unhide content
   */
  static async unhideContent(
    resourceType: 'post' | 'meeting',
    resourceId: string,
    adminId: string
  ) {
    const table = resourceType === 'post' ? 'posts' : 'meetings';

    await db`
      UPDATE ${db(table)}
      SET
        metadata = metadata - 'hidden' - 'hidden_by'
      WHERE id = ${resourceId}
    `;

    await this.log(null, adminId, 'content_unhidden', resourceType, resourceId, {});
  }

  /**
   * Admin: Pin content to top of forum
   */
  static async pinContent(
    resourceType: 'post' | 'meeting',
    resourceId: string,
    adminId: string
  ) {
    const table = resourceType === 'post' ? 'posts' : 'meetings';

    await db`
      UPDATE ${db(table)}
      SET is_pinned = true
      WHERE id = ${resourceId}
    `;

    await this.log(null, adminId, 'content_pinned', resourceType, resourceId, {});
  }

  /**
   * Admin: Unpin content
   */
  static async unpinContent(
    resourceType: 'post' | 'meeting',
    resourceId: string,
    adminId: string
  ) {
    const table = resourceType === 'post' ? 'posts' : 'meetings';

    await db`
      UPDATE ${db(table)}
      SET is_pinned = false
      WHERE id = ${resourceId}
    `;

    await this.log(null, adminId, 'content_unpinned', resourceType, resourceId, {});
  }

  /**
   * Admin: Lock thread (prevent new replies)
   */
  static async lockContent(
    resourceType: 'post' | 'meeting',
    resourceId: string,
    adminId: string,
    reason?: string
  ) {
    const table = resourceType === 'post' ? 'posts' : 'meetings';

    await db`
      UPDATE ${db(table)}
      SET is_locked = true
      WHERE id = ${resourceId}
    `;

    await this.log(null, adminId, 'content_locked', resourceType, resourceId, { reason });
  }

  /**
   * Admin: Unlock thread
   */
  static async unlockContent(
    resourceType: 'post' | 'meeting',
    resourceId: string,
    adminId: string
  ) {
    const table = resourceType === 'post' ? 'posts' : 'meetings';

    await db`
      UPDATE ${db(table)}
      SET is_locked = false
      WHERE id = ${resourceId}
    `;

    await this.log(null, adminId, 'content_unlocked', resourceType, resourceId, {});
  }

  /**
   * Get events for a specific organization
   */
  static async getOrgEvents(orgId: string, limit = 50) {
    return this.getAllEvents({ orgId, limit });
  }

  /**
   * Get recent content activity for dashboard summary
   */
  static async getRecentActivity(limit = 20) {
    return db`
      SELECT
        e.*,
        o.name as org_name,
        o.slug as org_slug,
        u.display_name as user_name,
        u.avatar_url as user_avatar
      FROM events e
      LEFT JOIN organizations o ON o.id = e.org_id
      LEFT JOIN users u ON u.id = e.user_id
      WHERE e.action IN (
        'post_published', 'meeting_published', 'reply_created',
        'content_hidden', 'visibility_override'
      )
      ORDER BY e.created_at DESC
      LIMIT ${limit}
    `;
  }

  /**
   * Get event stats for admin dashboard
   */
  static async getEventStats(since?: Date) {
    const sinceClause = since ? db`AND created_at >= ${since}` : db``;

    const [stats] = await db`
      SELECT
        COUNT(*) FILTER (WHERE action LIKE 'post_%') as post_events,
        COUNT(*) FILTER (WHERE action LIKE 'meeting_%') as meeting_events,
        COUNT(*) FILTER (WHERE action LIKE 'reply_%') as reply_events,
        COUNT(*) FILTER (WHERE action LIKE 'content_%') as moderation_events,
        COUNT(*) FILTER (WHERE action = 'visibility_override') as visibility_overrides,
        COUNT(DISTINCT user_id) as active_users,
        COUNT(DISTINCT org_id) as active_orgs
      FROM events
      WHERE 1=1 ${sinceClause}
    `;

    return stats;
  }

  /**
   * Check if user is admin (for server-side checks)
   */
  static async isAdmin(userId: string): Promise<boolean> {
    const [user] = await db`
      SELECT is_admin FROM users WHERE id = ${userId}
    `;
    return user?.is_admin === true;
  }
}