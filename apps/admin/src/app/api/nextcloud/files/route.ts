import { NextRequest, NextResponse } from 'next/server';
import { webdavService } from '@/lib/nextcloud';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, path } = body;

    switch (action) {
      case 'list': {
        const files = await webdavService.listDirectory(path);
        return NextResponse.json({ files });
      }

      case 'createFolder': {
        await webdavService.createDirectory(path);
        return NextResponse.json({ success: true });
      }

      case 'delete': {
        await webdavService.delete(path);
        return NextResponse.json({ success: true });
      }

      case 'move': {
        const { fromPath, toPath } = body;
        await webdavService.move(fromPath, toPath);
        return NextResponse.json({ success: true });
      }

      case 'copy': {
        const { fromPath, toPath } = body;
        await webdavService.copy(fromPath, toPath);
        return NextResponse.json({ success: true });
      }

      case 'exists': {
        const exists = await webdavService.exists(path);
        return NextResponse.json({ exists });
      }

      case 'info': {
        const info = await webdavService.getInfo(path);
        return NextResponse.json({ info });
      }

      case 'createOrgFolders': {
        const { orgId } = body;
        await webdavService.createOrgFolders(orgId);
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('Nextcloud files API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}