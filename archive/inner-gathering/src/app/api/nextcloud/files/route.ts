import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@elkdonis/nextcloud';
import { getServerSession } from '@elkdonis/auth-server';

/**
 * Nextcloud Files API for inner-gathering users.
 * Supports list, createFolder, delete, download actions.
 * Uses admin credentials to access EAC_Network org folders.
 */

// Allowed root paths users can browse
const ALLOWED_ROOTS = ['EAC_Network/inner_group'];

function isAllowedPath(path: string): boolean {
  // Reject path traversal attempts
  if (path.includes('..') || path.includes('\\')) return false;
  const normalized = path.replace(/^\/+/, '');
  return ALLOWED_ROOTS.some((root) => normalized.startsWith(root));
}

export async function POST(request: NextRequest) {
  try {
    // Auth check - require logged-in user
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await request.json();
    const { action, path } = body;

    // Validate path is within allowed roots
    if (path && !isAllowedPath(path)) {
      return NextResponse.json(
        { error: 'Access denied: path outside allowed folders' },
        { status: 403 }
      );
    }

    const client = getAdminClient();

    switch (action) {
      case 'list': {
        const items = (await client.webdav.getDirectoryContents(path || '/')) as any[];
        const files = items.map((item: any) => ({
          filename: item.filename,
          basename: item.basename,
          lastmod: item.lastmod,
          size: item.size || 0,
          type: item.type === 'directory' ? 'directory' : 'file',
          etag: item.etag || '',
          mime: item.mime,
        }));
        return NextResponse.json({ files });
      }

      case 'createFolder': {
        await client.webdav.createDirectory(path);
        return NextResponse.json({ success: true });
      }

      case 'delete': {
        await client.webdav.deleteFile(path);
        return NextResponse.json({ success: true });
      }

      case 'download': {
        const content = await client.webdav.getFileContents(path);
        const buffer = Buffer.from(content as ArrayBuffer);
        const filename = path.split('/').pop() || 'download';
        return new NextResponse(buffer, {
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Length': buffer.length.toString(),
          },
        });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Nextcloud files API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
