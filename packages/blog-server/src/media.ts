'use server';

import { Buffer } from 'node:buffer';
import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { db } from '@elkdonis/db';
import type { MeetingVisibility } from '@elkdonis/types';
import type { BlogConfig } from './auth';

// Nextcloud utilities (copied from services to avoid env initialization issues)
const NEXTCLOUD_URL = process.env.NEXTCLOUD_URL || 'http://localhost:8080';
const NEXTCLOUD_USER = process.env.NEXTCLOUD_ADMIN_USER || 'elkdonis';
const NEXTCLOUD_PASS = process.env.NEXTCLOUD_ADMIN_PASSWORD || 'admin';

const auth = Buffer.from(`${NEXTCLOUD_USER}:${NEXTCLOUD_PASS}`).toString('base64');

function getFileUrl(path: string): string {
  return `${NEXTCLOUD_URL}/remote.php/dav/files/${NEXTCLOUD_USER}/${path}`;
}

function getProxyFileUrl(path: string): string {
  return `/api/media/${path}`;
}

function getUploadPath(
  orgId: string,
  mediaType: 'Images' | 'Audio' | 'Videos' | 'Documents',
  filename: string,
  visibility: 'PUBLIC' | 'ORGANIZATION' | 'INVITE_ONLY' = 'PUBLIC'
): string {
  const folder = visibility === 'PUBLIC' ? 'Media' : 'Private/Media';
  return `EAC-Network/${orgId}/${folder}/${mediaType}/${filename}`;
}

async function uploadFile(
  path: string,
  file: Buffer | Blob,
  contentType = 'application/octet-stream'
): Promise<boolean> {
  try {
    const url = getFileUrl(path);
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': contentType,
      },
      body: file,
    });
    return response.ok;
  } catch (error) {
    console.error('[BlogServer] Error uploading file:', error);
    return false;
  }
}

type MediaCategory = 'image' | 'audio' | 'video' | 'document';

const DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'application/zip',
]);

const MEDIA_RULES: Array<{
  type: MediaCategory;
  folder: 'Images' | 'Audio' | 'Videos' | 'Documents';
  maxSizeMb: number;
  test: (mime: string) => boolean;
}> = [
  {
    type: 'image',
    folder: 'Images',
    maxSizeMb: 25,
    test: (mime) => mime.startsWith('image/'),
  },
  {
    type: 'audio',
    folder: 'Audio',
    maxSizeMb: 150,
    test: (mime) => mime.startsWith('audio/'),
  },
  {
    type: 'video',
    folder: 'Videos',
    maxSizeMb: 500,
    test: (mime) => mime.startsWith('video/'),
  },
  {
    type: 'document',
    folder: 'Documents',
    maxSizeMb: 50,
    test: (mime) => DOCUMENT_MIME_TYPES.has(mime),
  },
];

export function createMediaGetHandler() {
  return async function GET(
    request: NextRequest,
    { params }: { params: { path: string[] } }
  ) {
    try {
      // Auth check - require logged in user to access media
      const { getServerSession } = await import('@elkdonis/auth-server');
      const session = await getServerSession();
      if (!session.user) {
        return new NextResponse('Unauthorized', { status: 401 });
      }

      const path = params.path.join('/');
      const url = getFileUrl(path);

      const response = await fetch(url, {
        headers: {
          Authorization: `Basic ${auth}`,
        },
      });

      if (!response.ok) {
        return new NextResponse('File not found', { status: 404 });
      }

      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      const buffer = await response.arrayBuffer();

      return new NextResponse(buffer, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    } catch (error) {
      console.error('[BlogServer] Error fetching file:', error);
      return new NextResponse('Internal Server Error', { status: 500 });
    }
  };
}

export function createMediaUploadHandler(config: BlogConfig) {
  return async function POST(request: NextRequest) {
    try {
      // Auth check - derive userId from session, not form data
      const { getServerSession } = await import('@elkdonis/auth-server');
      const session = await getServerSession();
      if (!session.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const userId = session.user.db_user_id ?? session.user.id;

      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const orgId = (formData.get('orgId') as string | null) || config.orgId;
      const visibility = (formData.get('visibility') as MeetingVisibility) || 'PUBLIC';

      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      }

      const rule = MEDIA_RULES.find((candidate) => candidate.test(file.type));

      if (!rule) {
        return NextResponse.json(
          { error: `Unsupported file type: ${file.type || 'unknown'}` },
          { status: 400 }
        );
      }

      const maxBytes = rule.maxSizeMb * 1024 * 1024;
      if (file.size > maxBytes) {
        return NextResponse.json(
          {
            error: `File too large. ${rule.type} files must be under ${rule.maxSizeMb}MB`,
          },
          { status: 400 }
        );
      }

      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const filename = `${timestamp}-${sanitizedName}`;

      const relativePath = getUploadPath(orgId, rule.folder, filename, visibility);

      const buffer = Buffer.from(await file.arrayBuffer());
      const uploadSuccess = await uploadFile(relativePath, buffer, file.type || undefined);

      if (!uploadSuccess) {
        return NextResponse.json({ error: 'Upload to storage failed' }, { status: 500 });
      }

      const mediaId = nanoid();
      const fileUrl = getProxyFileUrl(relativePath);

      await db`
        INSERT INTO media (
          id,
          org_id,
          uploaded_by,
          nextcloud_file_id,
          nextcloud_path,
          url,
          type,
          filename,
          size_bytes,
          mime_type
        ) VALUES (
          ${mediaId},
          ${orgId},
          ${userId},
          ${filename},
          ${relativePath},
          ${fileUrl},
          ${rule.type},
          ${file.name},
          ${file.size},
          ${file.type}
        )
      `;

      return NextResponse.json({
        success: true,
        id: mediaId,
        fileId: filename,
        path: relativePath,
        url: fileUrl,
        filename: file.name,
        mimeType: file.type,
        size: file.size,
        mediaType: rule.type,
      });
    } catch (error) {
      console.error('[BlogServer] Upload error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}
