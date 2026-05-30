import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@elkdonis/auth-server';
import { db } from '@elkdonis/db';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Must be the author or an org admin
  const [thread] = await db`
    SELECT author_id FROM threads
    WHERE id = ${id} AND org_id = 'inner_group' AND kind = 'workshop'
    LIMIT 1
  `;
  if (!thread) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [membership] = await db`
    SELECT role FROM user_organizations
    WHERE user_id = ${session.user.id} AND org_id = 'inner_group'
    LIMIT 1
  `;
  const isAuthor = thread.author_id === session.user.id;
  const isAdmin = membership?.role === 'admin';
  if (!isAuthor && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const {
    title,
    description,
    price,
    coverImageUrl,
    nextcloudTalkToken,
    sessions,
    status,
  } = body;

  await db`
    UPDATE threads SET
      title      = COALESCE(${title ?? null}, title),
      body       = COALESCE(${description ?? null}, body),
      status     = COALESCE(${status ?? null}, status),
      updated_at = NOW()
    WHERE id = ${id}
  `;

  try {
    await db`
      INSERT INTO workshop_pages (thread_id, cover_image_url, price_member)
      VALUES (${id}, ${coverImageUrl ?? null}, ${price != null ? String(price) : null})
      ON CONFLICT (thread_id) DO UPDATE
        SET cover_image_url = COALESCE(EXCLUDED.cover_image_url, workshop_pages.cover_image_url),
            price_member    = COALESCE(EXCLUDED.price_member,    workshop_pages.price_member),
            updated_at      = NOW()
    `;
  } catch {
    // workshop_pages may not be migrated yet
  }

  if (sessions !== undefined) {
    try {
      await db`
        UPDATE threads
        SET metadata = ${JSON.stringify({ sessions, nextcloudTalkToken })}::jsonb
        WHERE id = ${id}
      `;
    } catch {
      // metadata column not available
    }
  }

  return NextResponse.json({ workshop: { id } });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const rows = await db`
    SELECT
      t.id, t.title, t.body AS description, t.status,
      t.metadata,
      wp.cover_image_url,
      wp.price_member AS price
    FROM threads t
    LEFT JOIN workshop_pages wp ON wp.thread_id = t.id
    WHERE t.id = ${id} AND t.kind = 'workshop' AND t.org_id = 'inner_group'
    LIMIT 1
  `.catch(() => []);

  if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const row = rows[0];
  const meta = row.metadata ?? {};
  return NextResponse.json({
    workshop: {
      id: row.id,
      title: row.title,
      description: row.description ?? '',
      status: row.status,
      coverImageUrl: row.cover_image_url ?? '',
      price: row.price ?? 0,
      nextcloudTalkToken: meta.nextcloudTalkToken ?? '',
      sessions: meta.sessions ?? [],
    },
  });
}
