import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@elkdonis/nextcloud';
import { getServerSession } from '@elkdonis/auth-server';

/**
 * Nextcloud file upload API for inner-gathering users.
 * Accepts multipart form data with a file and destination path.
 */

const ALLOWED_ROOTS = ['EAC_Network/inner_group'];

function isAllowedPath(path: string): boolean {
  // Reject path traversal attempts
  if (path.includes('..') || path.includes('\\')) return false;
  const normalized = path.replace(/^\/+/, '');
  return ALLOWED_ROOTS.some((root) => normalized.startsWith(root));
}

// Max 500MB per upload
const MAX_SIZE = 500 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    // Auth check - require logged-in user
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const path = formData.get('path') as string;

    if (!file || !path) {
      return NextResponse.json(
        { error: 'File and path are required' },
        { status: 400 }
      );
    }

    if (!isAllowedPath(path)) {
      return NextResponse.json(
        { error: 'Access denied: path outside allowed folders' },
        { status: 403 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `File too large. Max size: ${MAX_SIZE / 1024 / 1024}MB` },
        { status: 413 }
      );
    }

    const client = getAdminClient();
    const buffer = Buffer.from(await file.arrayBuffer());

    await client.webdav.putFileContents(path, buffer, {
      overwrite: true,
    });

    return NextResponse.json({
      success: true,
      filename: file.name,
      size: file.size,
      path,
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Upload failed' },
      { status: 500 }
    );
  }
}
