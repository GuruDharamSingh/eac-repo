import { NextResponse } from 'next/server';
import { getServerSession } from '@elkdonis/auth-server';
import { db } from '@elkdonis/db';

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

    const [user] = await db`
      SELECT is_admin FROM users WHERE id = ${session.user.id}
    `;
    const roles = await db`
      SELECT role FROM user_organizations WHERE user_id = ${session.user.id}
    `;

    const roleSet = new Set(roles.map((r: { role: string }) => r.role));
    const isAdmin = user?.is_admin === true;
    const isGuide = roleSet.has('guide') || roleSet.has('owner');

    return NextResponse.json({ isAdmin, isGuide });
  } catch (error) {
    console.error('[api/me/role] error:', error);
    return NextResponse.json({ isAdmin: false, isGuide: false });
  }
}
