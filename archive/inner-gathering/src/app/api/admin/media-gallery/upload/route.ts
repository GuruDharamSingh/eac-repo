import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@elkdonis/auth-server';
import { db } from '@elkdonis/db';
import { getAdminClient } from '@elkdonis/nextcloud';

const ALLOWED_ROOT = 'EAC_Network';
const ADMIN_EMAILS = (process.env.EAC_ADMIN_EMAILS ?? process.env.ADMIN_EMAIL ?? '')
  .split(',')
  .map((e) => e.trim())
  .filter(Boolean);

const MAX_SIZE = 60 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif']);
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);

const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
};

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

function sanitizeFileName(name: string) {
  const base = name.trim().replace(/[\r\n\\/]+/g, '_');
  return base.replace(/[^A-Za-z0-9._-]/g, '_');
}

function validateFileType(file: File) {
  const safeName = sanitizeFileName(file.name);
  const ext = safeName.split('.').pop()?.toLowerCase() ?? '';
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return { ok: false as const, reason: 'extension' };
  }

  const mime = (file.type || '').toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(mime)) {
    return { ok: false as const, reason: 'mime' };
  }

  return { ok: true as const, safeName, ext, mime };
}

function detectImageMimeFromSignature(content: Buffer): string | null {
  if (content.length >= 3 && content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff) {
    return 'image/jpeg';
  }

  if (
    content.length >= 8 &&
    content[0] === 0x89 &&
    content[1] === 0x50 &&
    content[2] === 0x4e &&
    content[3] === 0x47 &&
    content[4] === 0x0d &&
    content[5] === 0x0a &&
    content[6] === 0x1a &&
    content[7] === 0x0a
  ) {
    return 'image/png';
  }

  if (
    content.length >= 6 &&
    content[0] === 0x47 &&
    content[1] === 0x49 &&
    content[2] === 0x46 &&
    content[3] === 0x38 &&
    (content[4] === 0x37 || content[4] === 0x39) &&
    content[5] === 0x61
  ) {
    return 'image/gif';
  }

  if (
    content.length >= 12 &&
    content[0] === 0x52 &&
    content[1] === 0x49 &&
    content[2] === 0x46 &&
    content[3] === 0x46 &&
    content[8] === 0x57 &&
    content[9] === 0x45 &&
    content[10] === 0x42 &&
    content[11] === 0x50
  ) {
    return 'image/webp';
  }

  if (content.length >= 16 && content.toString('ascii', 4, 8) === 'ftyp') {
    const brand = content.toString('ascii', 8, 12);
    if (brand === 'avif' || brand === 'avis') {
      return 'image/avif';
    }
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const user = await assertAdmin();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const path = String(formData.get('path') ?? '').trim();

    if (!file || !path) {
      return NextResponse.json({ error: 'file and path are required' }, { status: 400 });
    }

    if (!isAllowedPath(path)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large (max 60MB)' }, { status: 413 });
    }

    const fileTypeValidation = validateFileType(file);
    if (!fileTypeValidation.ok) {
      return NextResponse.json(
        {
          error: 'Unsupported file type. Allowed: .jpg, .jpeg, .png, .webp, .gif, .avif',
        },
        { status: 415 }
      );
    }

    const client = getAdminClient();
    const content = Buffer.from(await file.arrayBuffer());
    const detectedMime = detectImageMimeFromSignature(content);
    const expectedMime = EXT_TO_MIME[fileTypeValidation.ext];

    if (!detectedMime || detectedMime !== expectedMime || detectedMime !== fileTypeValidation.mime) {
      return NextResponse.json(
        {
          error: 'File signature does not match declared file type.',
        },
        { status: 415 }
      );
    }

    const targetPath = `${path.replace(/\/+$/, '')}/${fileTypeValidation.safeName}`;

    await client.webdav.putFileContents(targetPath, content, { overwrite: true });

    return NextResponse.json({
      success: true,
      file: {
        filename: targetPath,
        basename: file.name,
        size: file.size,
      },
    });
  } catch (error: any) {
    console.error('Media upload API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to upload media file' },
      { status: 500 }
    );
  }
}