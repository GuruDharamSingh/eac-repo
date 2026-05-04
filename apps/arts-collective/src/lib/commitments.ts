import { db } from "@elkdonis/db";

export type Commitment =
  | {
      kind: "membership";
      orgId: string;
      orgName: string;
      orgSlug: string;
      role: string;
      since: string;
    }
  | {
      kind: "rsvp";
      threadId: string;
      threadTitle: string;
      orgSlug: string;
      status: string;
      scheduledAt: string | null;
    }
  | {
      kind: "watch";
      threadId: string;
      threadTitle: string;
      orgSlug: string;
      since: string;
    }
  | {
      kind: "bookmark";
      threadId: string;
      threadTitle: string;
      orgSlug: string;
      since: string;
    };

export async function getCommitmentsForUser(
  userId: string
): Promise<Commitment[]> {
  const out: Commitment[] = [];

  try {
    const memberships = await db<
      {
        org_id: string;
        role: string;
        joined_at: string;
        name: string;
        slug: string;
      }[]
    >`
      SELECT uo.org_id, uo.role, uo.joined_at, o.name, o.slug
      FROM user_organizations uo
      JOIN organizations o ON o.id = uo.org_id
      WHERE uo.user_id = ${userId}
      ORDER BY uo.joined_at DESC
    `;
    for (const m of memberships) {
      out.push({
        kind: "membership",
        orgId: m.org_id,
        orgName: m.name,
        orgSlug: m.slug,
        role: m.role,
        since: m.joined_at,
      });
    }
  } catch {
    // table missing in dev — ignore
  }

  try {
    const rsvps = await db<
      {
        thread_id: string;
        title: string;
        slug: string;
        status: string;
        scheduled_at: string | null;
      }[]
    >`
      SELECT tr.thread_id, t.title, o.slug, tr.status, t.scheduled_at
      FROM thread_rsvps tr
      JOIN threads t ON t.id = tr.thread_id
      JOIN organizations o ON o.id = t.org_id
      WHERE tr.user_id = ${userId} AND tr.status = 'yes'
      ORDER BY COALESCE(t.scheduled_at, t.created_at) DESC
    `;
    for (const r of rsvps) {
      out.push({
        kind: "rsvp",
        threadId: r.thread_id,
        threadTitle: r.title,
        orgSlug: r.slug,
        status: r.status,
        scheduledAt: r.scheduled_at,
      });
    }
  } catch {
    /* empty */
  }

  try {
    const watches = await db<
      { thread_id: string; title: string; slug: string; created_at: string }[]
    >`
      SELECT w.thread_id, t.title, o.slug, w.created_at
      FROM watches w
      JOIN threads t ON t.id = w.thread_id
      JOIN organizations o ON o.id = t.org_id
      WHERE w.user_id = ${userId}
      ORDER BY w.created_at DESC
    `;
    for (const w of watches) {
      out.push({
        kind: "watch",
        threadId: w.thread_id,
        threadTitle: w.title,
        orgSlug: w.slug,
        since: w.created_at,
      });
    }
  } catch {
    /* empty */
  }

  try {
    const bookmarks = await db<
      { thread_id: string; title: string; slug: string; created_at: string }[]
    >`
      SELECT b.thread_id, t.title, o.slug, b.created_at
      FROM bookmarks b
      JOIN threads t ON t.id = b.thread_id
      JOIN organizations o ON o.id = t.org_id
      WHERE b.user_id = ${userId}
      ORDER BY b.created_at DESC
    `;
    for (const b of bookmarks) {
      out.push({
        kind: "bookmark",
        threadId: b.thread_id,
        threadTitle: b.title,
        orgSlug: b.slug,
        since: b.created_at,
      });
    }
  } catch {
    /* empty */
  }

  return out;
}
