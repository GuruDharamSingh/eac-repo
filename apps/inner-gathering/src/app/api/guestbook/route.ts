import { NextRequest, NextResponse } from 'next/server';
import { db } from '@elkdonis/db';
import { getServerSession } from '@elkdonis/auth-server';

const ORG_ID = 'inner_group';

export async function GET() {
  try {
    const rows = await db`
      SELECT id, display_name, message, created_at
      FROM guestbook_entries
      WHERE org_id = ${ORG_ID}
      ORDER BY created_at DESC
      LIMIT 50
    `;
    return NextResponse.json({ entries: rows });
  } catch (err) {
    console.error('[guestbook GET]', err);
    return NextResponse.json({ error: 'Failed to load' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    const { message } = await req.json();

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message required' }, { status: 400 });
    }

    const displayName =
      session?.user?.user_metadata?.display_name ??
      session?.user?.email?.split('@')[0] ??
      'A member';

    const [row] = await db`
      INSERT INTO guestbook_entries (org_id, user_id, display_name, message)
      VALUES (
        ${ORG_ID},
        ${session?.user?.id ?? null},
        ${displayName},
        ${message.trim()}
      )
      RETURNING id, display_name, message, created_at
    `;

    return NextResponse.json({ entry: row });
  } catch (err) {
    console.error('[guestbook POST]', err);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
