import { NextResponse } from 'next/server';
import { getServerSession, isAdmin } from '@elkdonis/auth-server';

/**
 * The gate every admin API route starts with.
 *
 * "Has a session" means nothing in this app: /api/auth/signup is open and
 * GoTrue is shared with every public site, so anyone can hold one. Three
 * routes shipped with only that check (orders, rsvp) or none (work-question)
 * and were found in the 2026-09-17 review.
 *
 * Returns the admin's user id, or the response to send back.
 */
export async function requireAdminApi(): Promise<
  { userId: string; deny?: undefined } | { userId?: undefined; deny: NextResponse }
> {
  let userId: string | undefined;
  try {
    userId = (await getServerSession())?.user?.id;
  } catch {
    userId = undefined;
  }
  if (!userId) {
    return { deny: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  if (!(await isAdmin(userId))) {
    return { deny: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { userId };
}
