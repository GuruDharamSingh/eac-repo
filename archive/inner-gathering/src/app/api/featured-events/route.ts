import { NextResponse } from 'next/server';
import { db } from '@elkdonis/db';

const ORG_ID = 'elkdonis';
const THREAD_ORG_ID = 'inner_group';
const INNER_GATHERING_URL = process.env.NEXT_PUBLIC_INNER_GATHERING_URL ?? 'https://meetings.elkdonis-arts.org';

function cleanBaseUrl(url: string) {
  return url.replace(/\/$/, '');
}

function detailPath(kind: string, id: string) {
  if (kind === 'post') return `/posts/${id}`;
  if (kind === 'workshop') return `/workshops/${id}`;
  return `/meetings/${id}`;
}

function mapThread(row: any) {
  const href = `${cleanBaseUrl(INNER_GATHERING_URL)}${detailPath(row.kind, row.id)}`;
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    authorName: row.author_name ?? null,
    avatarUrl: row.avatar_url ?? null,
    dateTime: row.date_time ? new Date(row.date_time).toISOString() : null,
    href,
  };
}

export async function GET() {
  const [config] = await db`
    SELECT value FROM site_config WHERE org_id = ${ORG_ID} AND key = 'featured_events' LIMIT 1
  `;
  const value = config?.value ?? {};
  const threadIds = Array.isArray(value.threadIds)
    ? value.threadIds.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
    : [];

  if (threadIds.length === 0) {
    return NextResponse.json({ events: [] });
  }

  const rows = await db`
    WITH selected AS (
      SELECT value AS id, ord
      FROM jsonb_array_elements_text(${JSON.stringify(threadIds)}::jsonb) WITH ORDINALITY AS ids(value, ord)
    )
    SELECT
      t.id,
      t.kind,
      t.title,
      COALESCE(t.scheduled_at, t.published_at, t.created_at) AS date_time,
      u.display_name AS author_name,
      u.avatar_url,
      selected.ord
    FROM selected
    JOIN threads t ON t.id = selected.id
    LEFT JOIN users u ON t.author_id = u.id
    WHERE t.org_id = ${THREAD_ORG_ID}
      AND t.kind IN ('meeting', 'workshop', 'event', 'post')
      AND t.status IN ('published', 'scheduled')
    ORDER BY selected.ord ASC
  `;

  return NextResponse.json({ events: rows.map(mapThread) });
}