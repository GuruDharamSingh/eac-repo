import { NextRequest, NextResponse } from 'next/server';

const NEXTCLOUD_URL = process.env.NEXTCLOUD_URL || 'http://localhost:8080';
const NEXTCLOUD_USER = process.env.NEXTCLOUD_ADMIN_USER || 'elkdonis';
const NEXTCLOUD_PASS = process.env.NEXTCLOUD_ADMIN_PASSWORD || 'admin';

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
    
    // Construct the Nextcloud WebDAV URL
    const nextcloudUrl = `${NEXTCLOUD_URL}/remote.php/dav/files/${NEXTCLOUD_USER}/${filePath}`;
    
    // Create basic auth header
    const auth = Buffer.from(`${NEXTCLOUD_USER}:${NEXTCLOUD_PASS}`).toString('base64');
    
    // Fetch from Nextcloud with authentication
    const response = await fetch(nextcloudUrl, {
      headers: {
        'Authorization': `Basic ${auth}`,
      },
    });

    if (!response.ok) {
      console.error(`[Media Proxy] Failed to fetch: ${nextcloudUrl} - ${response.status}`);
      return NextResponse.json(
        { error: 'Media not found' },
        { status: 404 }
      );
    }

    // Get the file content
    const blob = await response.blob();
    const buffer = await blob.arrayBuffer();

    // Forward the response with appropriate headers
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream',
        'Content-Length': response.headers.get('Content-Length') || '',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Accept-Ranges': 'bytes',
      },
    });
  } catch (error) {
    console.error('[Media Proxy] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
