import { NextResponse } from 'next/server';
import { getServerSession, isAdmin as checkIsAdmin } from '@elkdonis/auth-server';
import { hasAnyOrgRole } from '@elkdonis/services';

/**
 * GET /api/me/role
 * Lightweight role probe for client UI gating (e.g. the nav).
 * Returns { isAdmin, isGuide } — isGuide is true when the user holds a
 * 'guide' or 'owner' role in any org. Logged-out users get false/false.
 */
export async function GET() {
  try {
    const session = await getServerSession();
    if (!session.user) {
      return NextResponse.json({ isAdmin: false, isGuide: false });
    }

    const [isAdmin, isGuide] = await Promise.all([
      checkIsAdmin(session.user.id),
      hasAnyOrgRole(session.user.id, ['guide', 'owner']),
    ]);

    return NextResponse.json({ isAdmin, isGuide });
  } catch (error) {
    console.error('[api/me/role] error:', error);
    return NextResponse.json({ isAdmin: false, isGuide: false });
  }
}
