import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@elkdonis/auth-server';

const NEXTCLOUD_URL = process.env.NEXTCLOUD_URL || 'http://localhost:8080';
const NEXTCLOUD_USER = process.env.NEXTCLOUD_ADMIN_USER || 'elkdonis';
const NEXTCLOUD_PASS = process.env.NEXTCLOUD_ADMIN_PASSWORD || 'admin';

function encodeWebdavPath(path: string): string {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

/**
 * Proxy route for serving Nextcloud media files
 * Handles authentication server-side so videos/images/audio can be served to any client
 *
 * Usage: /api/media/EAC-Network/inner_group/Media/Videos/video.mp4
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    const filePath = path.join('/');

    // Basic validation/sandboxing: avoid path traversal and restrict to app-controlled subtree.
    if (!filePath || filePath.includes('..') || filePath.includes('\\')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }
    if (!filePath.startsWith('EAC-Network/')) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const isPrivate = filePath.includes('/Private/');

    // Only require EAC session for Private media.
    if (isPrivate) {
      const session = await getServerSession();
      if (!session.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }
    
    // Construct the Nextcloud WebDAV URL
    const nextcloudUrl = `${NEXTCLOUD_URL}/remote.php/dav/files/${encodeURIComponent(NEXTCLOUD_USER)}/${encodeWebdavPath(filePath)}`;
    
    // Create basic auth header
    const auth = Buffer.from(`${NEXTCLOUD_USER}:${NEXTCLOUD_PASS}`).toString('base64');

    const range = request.headers.get('range') || undefined;
    
    // Fetch from Nextcloud with authentication
    const response = await fetch(nextcloudUrl, {
      headers: {
        'Authorization': `Basic ${auth}`,
        ...(range ? { Range: range } : {}),
      },
    });

    if (!response.ok) {
      console.error(`[Media Proxy] Failed to fetch: ${nextcloudUrl} - ${response.status}`);
      return NextResponse.json(
        { error: 'Media not found' },
        { status: 404 }
      );
    }

    const headers = new Headers();
    const passthroughHeaders = [
      'content-type',
      'content-length',
      'content-range',
      'accept-ranges',
      'etag',
      'last-modified',
    ];
    for (const key of passthroughHeaders) {
      const value = response.headers.get(key);
      if (value) headers.set(key, value);
    }
    headers.set(
      'Cache-Control',
      isPrivate ? 'private, no-store' : 'public, max-age=31536000, immutable'
    );

    return new NextResponse(response.body, { status: response.status, headers });
  } catch (error) {
    console.error('[Media Proxy] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
