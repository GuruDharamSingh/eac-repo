import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@elkdonis/auth-server';
import { db } from '@elkdonis/db';
import { getAdminClient } from '@elkdonis/nextcloud';

const ALLOWED_ROOT = 'EAC-Network';
const ADMIN_EMAILS = (process.env.EAC_ADMIN_EMAILS ?? process.env.ADMIN_EMAIL ?? '')
  .split(',')
  .map((e) => e.trim())
  .filter(Boolean);

async function assertAdmin() {
  const session = await getServerSession();
  if (!session.user) return null;
  if (ADMIN_EMAILS.includes(session.user.email)) return session.user;
  const [u] = await db`SELECT is_admin FROM users WHERE id = ${session.user.id} LIMIT 1`;
  if (u?.is_admin) return session.user;
  return null;
}

function isAllowedPath(path: string) {
  if (path.includes('..') || path.includes('\\')) return false;
  const normalized = path.replace(/^\/+/, '');
  return normalized === ALLOWED_ROOT || normalized.startsWith(`${ALLOWED_ROOT}/`);
}

export async function POST(req: NextRequest) {
  try {
    const user = await assertAdmin();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const path = typeof body.path === 'string' && body.path.trim() ? body.path.trim() : ALLOWED_ROOT;

    if (!isAllowedPath(path)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    const client = getAdminClient();
    const items = (await client.webdav.getDirectoryContents(path)) as any[];

    const files = items.map((item: any) => ({
      filename: item.filename,
      basename: item.basename,
      lastmod: item.lastmod,
      size: item.size || 0,
      type: item.type === 'directory' ? 'directory' : 'file',
      etag: item.etag || '',
      mime: item.mime,
    }));

    return NextResponse.json({ files, path });
  } catch (error: any) {
    console.error('Media gallery API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load media gallery' },
      { status: 500 }
    );
  }
}
