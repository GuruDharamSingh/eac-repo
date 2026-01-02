import { NextResponse } from 'next/server';
import { webdavService } from '@/lib/nextcloud';
import { db } from '@elkdonis/db';
import { getServerSession, isAdmin } from '@elkdonis/auth-server';

export async function POST() {
  try {
    // Auth check - require admin
    const session = await getServerSession();
    if (!session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!(await isAdmin(session.user.id))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get all organizations from database
    const organizations = await db`SELECT id, name FROM organizations`;

    // Create root folder
    await webdavService.createDirectory('EAC-Network');

    // Create folder structure for each organization
    for (const org of organizations) {
      await webdavService.createOrgFolders(org.id);

      // Update organization record with Nextcloud folder path
      await db`
        UPDATE organizations
        SET nextcloud_folder_path = ${`EAC-Network/${org.id}`}
        WHERE id = ${org.id}
      `;
    }

    return NextResponse.json({
      success: true,
      message: `Created folders for ${organizations.length} organizations`,
    });
  } catch (error: any) {
    console.error('Error setting up folders:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create folders' },
      { status: 500 }
    );
  }
}