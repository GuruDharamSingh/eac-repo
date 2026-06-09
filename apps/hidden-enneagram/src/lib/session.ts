import { redirect } from "next/navigation";
import { getServerSession } from "@elkdonis/auth-server";
import { db } from "@elkdonis/db";

export const ORG_SLUG = "hidden-enneagram";

export type SessionUser = {
  id: string;
  authUserId: string;
  email: string;
};

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getServerSession();
  if (!session.user) return null;
  return {
    id: session.user.db_user_id ?? session.user.id,
    authUserId: session.user.auth_user_id,
    email: session.user.email,
  };
}

export async function requireUser(redirectTo: string = "/login"): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(redirectTo);
  return user;
}

/** True if the user owns the hidden-enneagram org (matches either id mapping). */
export async function isOrgOwner(user: SessionUser): Promise<boolean> {
  try {
    const rows = await db<{ role: string }[]>`
      SELECT uo.role
      FROM user_organizations uo
      WHERE uo.org_id = ${ORG_SLUG}
        AND uo.role = 'owner'
        AND (uo.user_id = ${user.id} OR uo.user_id = ${user.authUserId})
      LIMIT 1
    `;
    return rows.length > 0;
  } catch {
    return false;
  }
}
