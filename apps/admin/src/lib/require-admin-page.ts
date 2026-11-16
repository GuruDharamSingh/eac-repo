import { redirect } from 'next/navigation';
import { getServerSession, isAdmin } from '@elkdonis/auth-server';

/**
 * The gate every admin SERVER page starts with (2026-11-16, atlas recommendations §1).
 *
 * The shell only checks on the client that someone is signed in, and a server page's data is in its payload
 * whatever the shell shows. GoTrue is shared with every public site, so "signed in" means nothing here:
 * only a network admin passes. Client pages are covered by requireAdminApi on the routes they call.
 */
export async function requireAdminPage(): Promise<string> {
  let userId: string | undefined;
  try {
    userId = (await getServerSession())?.user?.id;
  } catch {
    userId = undefined;
  }
  if (!userId || !(await isAdmin(userId))) redirect('/login');
  return userId;
}
