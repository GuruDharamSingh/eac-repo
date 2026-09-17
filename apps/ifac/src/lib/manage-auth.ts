import "server-only";
import { redirect } from "next/navigation";
import { getServerSession, type Session } from "@elkdonis/auth-server";
import { canManageIfac } from "@/lib/data";

/**
 * The gate for /manage.
 *
 * Deliberately `canManageIfac` rather than lib/auth's `requireOrgEditor`: this
 * console is also the tool the network's own admin and the configured owner
 * email reach for when nobody holds a role row yet — the IFAC allowlist trap,
 * where removing the email fallback before seeding owners locks everyone out.
 * requireOrgEditor knows only about `user_organizations`.
 */
export interface ManageViewer {
  /** Database user id — what user_organizations.user_id holds. */
  userId: string;
  email: string;
}

function toViewer(session: Session): ManageViewer {
  const user = session.user!;
  return { userId: user.db_user_id ?? user.id, email: user.email };
}

/** Page gate: redirects rather than throwing. */
export async function requireIfacManager(returnTo = "/manage"): Promise<ManageViewer> {
  const session = await getServerSession();
  if (!(await canManageIfac(session))) {
    // Signed in but not an editor is a wrong turn, not an attack — home, not a 403.
    redirect(session.user ? "/" : `/login?next=${encodeURIComponent(returnTo)}`);
  }
  return toViewer(session);
}

/** Route-handler form: null instead of a redirect. */
export async function getIfacManager(): Promise<ManageViewer | null> {
  const session = await getServerSession();
  if (!(await canManageIfac(session))) return null;
  return toViewer(session);
}
