import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, isAdmin } from '@elkdonis/auth-server';
import { db } from '@elkdonis/db';

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!(await isAdmin(session.user.id))) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const org = searchParams.get('org') ?? 'all';
  const status = searchParams.get('status') ?? 'all';

  const contacts = org === 'all'
    ? await db`
        SELECT c.*, u.display_name AS user_display_name
        FROM contacts c
        LEFT JOIN users u ON u.id = c.user_id
        ORDER BY c.created_at DESC
      `
    : await db`
        SELECT c.*, u.display_name AS user_display_name
        FROM contacts c
        LEFT JOIN users u ON u.id = c.user_id
        WHERE c.org_id = ${org}
        ORDER BY c.created_at DESC
      `;

  const filtered = status === 'all'
    ? contacts
    : contacts.filter((c) => c.status === status);

  return NextResponse.json({ contacts: filtered });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession();
  if (!session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!(await isAdmin(session.user.id))) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { id, status } = await req.json() as { id: string; status: string };
  const allowed = ['new', 'contacted', 'joined'];
  if (!id || !allowed.includes(status)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  await db`UPDATE contacts SET status = ${status} WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
