/**
 * Example API Route: File Upload
 * 
 * Location: apps/forum/src/app/api/nextcloud/upload/route.ts
 * 
 * This shows how to use the @elkdonis/nextcloud package
 * in a Next.js API route to upload files.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createNextcloudClient, getAdminClient } from '@elkdonis/nextcloud';
import { uploadFile } from '@elkdonis/nextcloud/files';
import { db } from '@elkdonis/db';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const orgPath = formData.get('orgPath') as string | null;
    const subfolder = formData.get('subfolder') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // TODO: Get user session (Supabase Auth)
    // const session = await getServerSession();
    // if (!session) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    // For now, use admin client
    const client = getAdminClient();

    // Upload to Nextcloud
    const ncFile = await uploadFile(client, file, {
      orgPath: orgPath || undefined,
      subfolder: subfolder || undefined,
    });

    // Optionally save to database
    // await db`
    //   INSERT INTO media (id, nextcloud_file_id, nextcloud_path, filename, size_bytes, mime_type)
    //   VALUES (${generateId()}, ${ncFile.id}, ${ncFile.path}, ${ncFile.filename}, ${ncFile.size}, ${ncFile.mimeType})
    // `;

    return NextResponse.json({
      success: true,
      file: ncFile,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed', details: String(error) },
      { status: 500 }
    );
  }
}
