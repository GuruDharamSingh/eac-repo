import { db } from '@elkdonis/db';

// ============================================================================
// What is waiting for a person.
//
// Three counts the profile face states and nothing else in the hub does:
// unread direct messages, unread forum notifications, and gatherings in this
// org they have said they are coming to.
//
// Generalised from the counts buried inside IFAC's `getProfileSummary`, which
// computed two of the three and was the only place in the repo that did. The
// org id is an argument here, and `upcoming` is org-scoped on purpose while
// the other two are not: messages and notifications follow the person across
// the network, but "what you are attending" on an org's hub means that org's
// calendar.
//
// NONE of these is rendered as a link. No host serves an inbox route yet, and
// a number that is true is worth more than a button that goes nowhere.
// ============================================================================

export interface ViewerAlerts {
  unreadMessages: number;
  notifications: number;
  upcoming: number;
}

/**
 * Never throws: a hub tile is not worth a 500. A failed read reports zeroes,
 * which is the same thing the page shows for someone with nothing waiting.
 */
export async function getViewerAlerts(
  userId: string,
  orgId: string
): Promise<ViewerAlerts> {
  try {
    const [row] = await db<
      Array<{ unread: number; notifications: number; upcoming: number }>
    >`
      SELECT
        (SELECT COUNT(*)::int
           FROM message m
           JOIN conversation_participant cp
             ON cp.conversation_id = m.conversation_id
          WHERE cp.user_id = ${userId}
            AND m.sender_id <> ${userId}
            AND (cp.last_read_at IS NULL OR m.created_at > cp.last_read_at)
        ) AS unread,
        (SELECT COUNT(*)::int
           FROM notifications n
          WHERE n.user_id = ${userId} AND n.read_at IS NULL
        ) AS notifications,
        (SELECT COUNT(*)::int
           FROM thread_rsvps r
           JOIN threads t ON t.id = r.thread_id
          WHERE r.user_id = ${userId}
            AND r.status = 'yes'
            AND t.org_id = ${orgId}
            AND t.scheduled_at >= NOW()
        ) AS upcoming
    `;
    return {
      unreadMessages: row?.unread ?? 0,
      notifications: row?.notifications ?? 0,
      upcoming: row?.upcoming ?? 0,
    };
  } catch (error) {
    console.error(`[viewer-alerts] ${userId}/${orgId}:`, error);
    return { unreadMessages: 0, notifications: 0, upcoming: 0 };
  }
}
