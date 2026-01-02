import { NextRequest, NextResponse } from 'next/server';
import { webdavService } from '@/lib/nextcloud';
import { getServerSession, isAdmin } from '@elkdonis/auth-server';

export async function POST(request: NextRequest) {
  try {
    // Auth check - require admin
    const session = await getServerSession();
    if (!session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!(await isAdmin(session.user.id))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
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

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload to Nextcloud
    const success = await webdavService.uploadFile(path, buffer, {
      overwrite: true,
    });

    return NextResponse.json({ success });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Upload failed' },
      { status: 500 }
    );
  }
}