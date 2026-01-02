import { Buffer } from 'node:buffer';
import { NextRequest, NextResponse } from 'next/server';
import { uploadFile, getUploadPath, getProxyFileUrl } from '@elkdonis/services';
import { db } from '@elkdonis/db';
import { nanoid } from 'nanoid';
import type { MeetingVisibility } from '@elkdonis/types';

const NEXTCLOUD_URL = process.env.NEXTCLOUD_URL || 'http://nextcloud-nginx:80';
const NEXTCLOUD_USER = process.env.NEXTCLOUD_ADMIN_USER || 'elkdonis';
const ORG_ID = 'inner_group';

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

const MEDIA_CONFIG: Array<{
  type: MediaCategory;
  folder: string;
  maxSizeMb: number;
  test: (mime: string) => boolean;
}> = [
  {
    type: 'image',
    folder: 'Media/Images',
    maxSizeMb: 25,
    test: (mime) => mime.startsWith('image/'),
  },
  {
    type: 'audio',
    folder: 'Media/Audio',
    maxSizeMb: 150,
    test: (mime) => mime.startsWith('audio/'),
  },
  {
    type: 'video',
    folder: 'Media/Videos',
    maxSizeMb: 500,
    test: (mime) => mime.startsWith('video/'),
  },
  {
    type: 'document',
    folder: 'Media/Documents',
    maxSizeMb: 50,
    test: (mime) => DOCUMENT_MIME_TYPES.has(mime),
  },
];

export async function POST(request: NextRequest) {
  try {
    // Auth check - derive userId from session, not form data
    const { getServerSession } = await import('@elkdonis/auth-server');
    const session = await getServerSession();
    if (!session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.db_user_id ?? session.user.id;

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const visibility = (formData.get('visibility') as MeetingVisibility) || 'PUBLIC';

    // Validation
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    const mediaConfig = MEDIA_CONFIG.find((config) => config.test(file.type));

    if (!mediaConfig) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type || 'unknown'}` },
        { status: 400 }
      );
    }

    const maxSizeBytes = mediaConfig.maxSizeMb * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return NextResponse.json(
        { error: `File size must be less than ${mediaConfig.maxSizeMb}MB for ${mediaConfig.type} files` },
        { status: 400 }
      );
    }

    // Generate unique filename and paths
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${timestamp}-${sanitizedName}`;
    
    // Determine media type folder
    const mediaTypeFolder = mediaConfig.folder.split('/')[1] as 'Images' | 'Audio' | 'Videos' | 'Documents';
    
    // Use visibility-based path routing
    const relativePath = getUploadPath(ORG_ID, mediaTypeFolder, filename, visibility);

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Nextcloud
    console.log(`Uploading file to: ${relativePath}`);
    const uploadSuccess = await uploadFile(relativePath, buffer, file.type);

    if (!uploadSuccess) {
      console.error(`Nextcloud upload failed for: ${relativePath}`);
      return NextResponse.json(
        { error: 'Failed to upload file to Nextcloud. Please check server logs.' },
        { status: 500 }
      );
    }

    // Generate the proxy URL (handles auth server-side)
    const fileUrl = getProxyFileUrl(relativePath);

    // Save to database
    const mediaId = nanoid();

    try {
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
          ${ORG_ID},
          ${userId},
          ${filename},
          ${relativePath},
          ${fileUrl},
          ${mediaConfig.type},
          ${file.name},
          ${file.size},
          ${file.type}
        )
      `;

      console.log(`Media saved to database: ${mediaId}`);

      return NextResponse.json({
        success: true,
        id: mediaId,
        fileId: filename,
        url: fileUrl,
        path: relativePath,
        filename: file.name,
        mimeType: file.type,
        size: file.size,
        mediaType: mediaConfig.type,
      });
    } catch (dbError) {
      console.error('Database error saving media:', dbError);
      // File is uploaded but DB save failed - log for cleanup
      return NextResponse.json(
        {
          error: 'File uploaded but failed to save metadata. Please contact support.',
          fileUrl,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
