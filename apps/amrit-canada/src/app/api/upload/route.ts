import { Buffer } from 'node:buffer';
import { NextRequest, NextResponse } from 'next/server';
import { uploadFile, getUploadPath, getProxyFileUrl } from '@elkdonis/services';
import { db } from '@elkdonis/db';
import { nanoid } from 'nanoid';
import { getServerSession } from '@elkdonis/auth-server';
import { siteConfig } from '@/config/site';
import type { MeetingVisibility } from '@elkdonis/types';

const ORG_ID = siteConfig.orgId;

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
    const session = await getServerSession();
    if (!session?.user || !siteConfig.ownerEmails.includes(session.user.email)) {
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
    const uploadSuccess = await uploadFile(relativePath, buffer, file.type);

    if (!uploadSuccess) {
      return NextResponse.json(
        { error: 'Failed to upload file to Nextcloud' },
        { status: 500 }
      );
    }

    // Generate the proxy URL
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
      return NextResponse.json(
        { error: 'File uploaded but failed to save metadata' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
