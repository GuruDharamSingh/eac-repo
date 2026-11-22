import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getServerSession, isAdmin } from "@elkdonis/auth-server";

// ============================================================================
// Who may open /development: network (platform) admins only.
//
// The platform's one superadmin check is `isAdmin(userId)` in
// @elkdonis/auth-server (users.is_admin, the flag apps/admin is exclusive to;
// art-auction and arts-collective's hub reuse it as "platform admin"). It runs
// on the server for every page render and, if this app ever grows server
// actions or route handlers, in each of them via `getNetworkAdmin()`. Never in
// a client component, never from a cookie claim alone.
//
// Signed out  -> the network login, coming back here.
// Signed in, not an admin -> 404 (the app does not admit it exists).
// ============================================================================

const NETWORK = (process.env.NEXT_PUBLIC_ARTS_COLLECTIVE_URL ?? "https://arts-collective.com").replace(/\/$/, "");
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "/development";

export interface NetworkAdmin {
  userId: string;
  email: string;
}

/** The signed-in network admin, or null. Never throws or redirects: use it in route handlers and actions. */
export async function getNetworkAdmin(): Promise<NetworkAdmin | null> {
  try {
    const session = await getServerSession();
    if (!session.user) return null;
    const userId = session.user.db_user_id ?? session.user.id;
    if (!(await isAdmin(userId))) return null;
    return { userId, email: session.user.email };
  } catch {
    return null;
  }
}

async function isSignedIn(): Promise<boolean> {
  try {
    return Boolean((await getServerSession()).user);
  } catch {
    return false;
  }
}

/** Gate for a page: call first in every page and in the layout. `returnTo` is app-relative, e.g. "/ideas". */
export async function requireNetworkAdmin(returnTo = "/"): Promise<NetworkAdmin> {
  const admin = await getNetworkAdmin();
  if (admin) return admin;
  if (!(await isSignedIn())) {
    // The proxy records the real path; the layout cannot see it, so it would otherwise pass "/".
    const asked = (await headers()).get("x-dev-path");
    const path = asked && asked.startsWith("/") && !asked.startsWith("//") ? asked : returnTo;
    const back = `${BASE}${path === "/" ? "" : path}` || "/";
    redirect(`${NETWORK}/login?next=${encodeURIComponent(back)}`);
  }
  notFound();
}
