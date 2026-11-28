import { getServerSession } from "@elkdonis/auth-server";

/** The signed-in person for the dock (verified session only), or null. Same id rule as src/lib/viewer.ts. */
export async function getDockUser(): Promise<{ id: string; email: string } | null> {
  try {
    const session = await getServerSession();
    if (!session.user) return null;
    return { id: session.user.db_user_id ?? session.user.id, email: session.user.email };
  } catch {
    return null;
  }
}
