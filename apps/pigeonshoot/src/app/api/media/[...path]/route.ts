import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@elkdonis/auth-server';

const NEXTCLOUD_URL = process.env.NEXTCLOUD_URL || '';
const NEXTCLOUD_USER = process.env.NEXTCLOUD_ADMIN_USER || '';
const NEXTCLOUD_PASS = process.env.NEXTCLOUD_ADMIN_PASSWORD || '';

function encodeWebdavPath(path: string): string {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

/**
 * Proxy route for serving Nextcloud media files.
 *
 * Handles the WebDAV credentials server-side, so images can be served to any
 * client without the browser ever seeing them.
 *
 * Usage: /api/media/EAC_Network/pigeonshoot/Media/Images/card/1753-abc.jpg
 *
 * The subtree is scoped to this org rather than to EAC_Network/ as a whole
 * (which is what the inner-gathering original this was copied from allows).
 * Pigeonshoot has no business serving another site's files, and every path it
 * writes is under its own prefix.
 */
const ALLOWED_PREFIX = 'EAC_Network/pigeonshoot/';
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
    if (!filePath.startsWith(ALLOWED_PREFIX)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const isPrivate = filePath.includes('/Private/');

    // Private media requires affiliation with the owning org, not merely a
    // session — any signed-in user of any app used to satisfy this.
    if (isPrivate) {
      const { canReadMedia } = await import('@elkdonis/services');
      const session = await getServerSession();
      const viewerId = session.user?.db_user_id ?? session.user?.id ?? null;
      if (!(await canReadMedia(viewerId, filePath))) {
        return NextResponse.json(
          { error: session.user ? 'Not found' : 'Unauthorized' },
          { status: session.user ? 404 : 401 }
        );
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

    // Uploaded files are untrusted: no type sniffing, and only known-passive
    // media renders inline — scriptable types (SVG/HTML/XML) download instead.
    headers.set('X-Content-Type-Options', 'nosniff');
    const mediaType = (response.headers.get('content-type') ?? '').toLowerCase();
    const inlineSafe =
      /^(image\/(jpeg|png|gif|webp|avif|bmp|x-icon)|video\/|audio\/|application\/pdf|font\/)/.test(
        mediaType
      );
    headers.set('Content-Disposition', inlineSafe ? 'inline' : 'attachment');

    return new NextResponse(response.body, { status: response.status, headers });
  } catch (error) {
    console.error('[Media Proxy] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
