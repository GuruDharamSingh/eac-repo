import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@elkdonis/auth-server';
import { db } from '@elkdonis/db';

const THREAD_ORG_ID = 'inner_group';
const ADMIN_EMAILS = (process.env.EAC_ADMIN_EMAILS ?? process.env.ADMIN_EMAIL ?? '')
  .split(',').map((email) => email.trim()).filter(Boolean);

async function assertAdmin() {
  const session = await getServerSession();
  if (!session.user) return null;
  if (ADMIN_EMAILS.includes(session.user.email)) return session.user;
  const [user] = await db`SELECT is_admin FROM users WHERE id = ${session.user.id} LIMIT 1`;
  if (user?.is_admin) return session.user;
  return null;
}

function mapThread(row: any) {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    authorName: row.author_name ?? null,
    avatarUrl: row.avatar_url ?? null,
    dateTime: row.date_time ? new Date(row.date_time).toISOString() : null,
  };
}

export async function GET(req: NextRequest) {
  const user = await assertAdmin();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const query = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  const search = `%${query}%`;

  const rows = await db`
    SELECT
      t.id,
      t.kind,
      t.title,
      COALESCE(t.scheduled_at, t.published_at, t.created_at) AS date_time,
      u.display_name AS author_name,
      u.avatar_url
    FROM threads t
    LEFT JOIN users u ON t.author_id = u.id
    WHERE t.org_id = ${THREAD_ORG_ID}
      AND t.kind IN ('meeting', 'workshop', 'event', 'post')
      AND t.status IN ('published', 'scheduled')
      AND (
        ${query} = ''
        OR t.title ILIKE ${search}
        OR t.body ILIKE ${search}
        OR u.display_name ILIKE ${search}
      )
    ORDER BY COALESCE(t.scheduled_at, t.published_at, t.created_at) DESC
    LIMIT 100
  `;

  return NextResponse.json({ threads: rows.map(mapThread) });
}