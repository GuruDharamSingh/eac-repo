import { NextResponse } from 'next/server';
import { db } from '@elkdonis/db';

// Threads for inner-gathering content live under the `inner_group` org.
const ORG_ID = 'inner_group';

interface FeedRow {
  id: string;
  kind: string;
  title: string;
  excerpt: string | null;
  scheduled_at: string | null;
  recurrence_pattern: string | null;
  recurrence_custom_rule: string | null;
  location: string | null;
  is_online: boolean;
  pinned: boolean;
}

function detailPath(kind: string, id: string) {
  if (kind === 'post') return `/posts/${id}`;
  if (kind === 'workshop') return `/workshops/${id}`;
  return `/meetings/${id}`;
}

function mapItem(row: FeedRow) {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    excerpt: row.excerpt ?? null,
    scheduledAt: row.scheduled_at ? new Date(row.scheduled_at).toISOString() : null,
    recurrencePattern: row.recurrence_pattern ?? null,
    recurrenceCustomRule: row.recurrence_custom_rule ?? null,
    location: row.location ?? null,
    isOnline: !!row.is_online,
    pinned: !!row.pinned,
    href: detailPath(row.kind, row.id),
  };
}

// Mini feed for the public landing page. Surfaces listed recurring meetings;
// when there are two or fewer of them, rounds out the panel with a single
// pinned, non-private post or meeting.
export async function GET() {
  const recurring = (await db`
    SELECT t.id, t.kind, t.title, t.excerpt, t.scheduled_at,
           t.recurrence_pattern, t.recurrence_custom_rule, t.location, t.is_online,
           COALESCE(t.pinned, false) AS pinned
    FROM threads t
    WHERE t.kind = 'meeting'
      AND t.org_id = ${ORG_ID}
      AND t.status = 'published'
      AND t.visibility = 'PUBLIC'
      AND t.recurrence_pattern IS NOT NULL
      AND t.recurrence_pattern <> 'NONE'
    ORDER BY t.scheduled_at ASC NULLS LAST
    LIMIT 3
  `) as FeedRow[];

  const items = recurring.map(mapItem);

  if (recurring.length <= 2) {
    const exclude = new Set(recurring.map((r) => r.id));
    const pinned = (await db`
      SELECT t.id, t.kind, t.title, t.excerpt, t.scheduled_at,
             t.recurrence_pattern, t.recurrence_custom_rule, t.location, t.is_online,
             true AS pinned
      FROM threads t
      WHERE t.kind IN ('meeting', 'post')
        AND t.org_id = ${ORG_ID}
        AND t.status = 'published'
        AND t.visibility = 'PUBLIC'
        AND COALESCE(t.pinned, false) = true
      ORDER BY t.scheduled_at DESC NULLS LAST, t.created_at DESC
      LIMIT 4
    `) as FeedRow[];

    const extra = pinned.find((p) => !exclude.has(p.id));
    if (extra) items.push(mapItem(extra));
  }

  return NextResponse.json({ items });
}
