import { redirect } from "next/navigation";
import { getServerSession } from "@elkdonis/auth-server";

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
  if (!user) {
    redirect(redirectTo);
  }
  return user;
}
