import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@elkdonis/auth-server';
import { db } from '@elkdonis/db';

const ORG_ID = 'elkdonis';
const ADMIN_EMAILS = (process.env.EAC_ADMIN_EMAILS ?? process.env.ADMIN_EMAIL ?? '')
  .split(',').map((e) => e.trim()).filter(Boolean);

async function assertAdmin() {
  const session = await getServerSession();
  if (!session.user) return null;
  if (ADMIN_EMAILS.includes(session.user.email)) return session.user;
  // Also allow global superadmin
  const [u] = await db`SELECT is_admin FROM users WHERE id = ${session.user.id} LIMIT 1`;
  if (u?.is_admin) return session.user;
  return null;
}

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key');

  // Public read for specific keys used by homepage sections.
  const PUBLIC_KEYS = ['fundraising', 'featured_artist', 'initiative', 'featured_events', 'image_spaces'];
  if (key && PUBLIC_KEYS.includes(key)) {
    const [row] = await db`
      SELECT value FROM site_config WHERE org_id = ${ORG_ID} AND key = ${key} LIMIT 1
    `;
    return NextResponse.json({ key, value: row?.value ?? null });
  }

  // Admin: return all keys
  const user = await assertAdmin();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await db`SELECT key, value, updated_at FROM site_config WHERE org_id = ${ORG_ID} ORDER BY key`;
  return NextResponse.json({ config: rows });
}

export async function PATCH(req: NextRequest) {
  const user = await assertAdmin();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { key, value } = await req.json();
  if (!key || typeof key !== 'string') {
    return NextResponse.json({ error: 'key required' }, { status: 400 });
  }

  const [row] = await db`
    INSERT INTO site_config (org_id, key, value, updated_at)
    VALUES (${ORG_ID}, ${key}, ${db.json(value)}, NOW())
    ON CONFLICT (org_id, key) DO UPDATE
      SET value = EXCLUDED.value, updated_at = NOW()
    RETURNING key, value, updated_at
  `;

  return NextResponse.json({ key: row.key, value: row.value, updatedAt: row.updated_at });
}
