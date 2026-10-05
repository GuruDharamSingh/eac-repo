import { NextResponse, type NextRequest } from "next/server";
import { completeConnectionAuth, connectionIdFromState } from "@elkdonis/services";
import { getCurrentUser } from "@/lib/session";
import { networkOrigin, safeReturn, withOutcome } from "@/lib/connections";

/**
 * GET /api/connections/callback — Google's redirect after consent.
 *
 * This exact URL is what each person registers as the "Authorised redirect
 * URI" on their own Google OAuth client. The nonce in `state` was stored by
 * /api/connections/start for the same signed-in user; completeConnectionAuth
 * checks it, trades the code for tokens and reads the channel back.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const origin = networkOrigin();
  const q = request.nextUrl.searchParams;
  const state = q.get("state");
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(
      withOutcome(`${origin}/hub`, connectionIdFromState(state), "Signed out during the Google step. Sign in and connect again.")
    );
  }
  const r = await completeConnectionAuth(user.id, { state, code: q.get("code"), error: q.get("error") });
  const back = safeReturn(r.returnTo) ?? `${origin}/hub?surface=profile:connections`;
  return NextResponse.redirect(withOutcome(back, connectionIdFromState(state), r.ok === false ? r.error : null));
}
