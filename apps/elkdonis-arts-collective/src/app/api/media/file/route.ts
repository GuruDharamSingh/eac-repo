import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@elkdonis/nextcloud';

const ALLOWED_ROOT = 'EAC_Network/';

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  avif: 'image/avif',
};

function normalizePath(path: string) {
  return path.replace(/^\/+/, '');
}

function inferContentType(path: string) {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXT[ext] ?? 'application/octet-stream';
}

export async function GET(req: NextRequest) {
  const rawPath = req.nextUrl.searchParams.get('path');
  if (!rawPath) {
    return NextResponse.json({ error: 'Missing path parameter' }, { status: 400 });
  }

  const path = normalizePath(rawPath);
  if (path.includes('..') || path.includes('\\') || !path.startsWith(ALLOWED_ROOT)) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  try {
    const client = getAdminClient();
    const content = await client.webdav.getFileContents(path);
    const buffer = Buffer.from(content as ArrayBuffer);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': inferContentType(path),
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
      },
    });
  } catch (error: any) {
    console.error('Media file fetch failed:', error);
    return NextResponse.json(
      { error: error.message || 'Could not load media file' },
      { status: 500 }
    );
  }
}
