import { NextRequest, NextResponse } from "next/server";
import { db } from "@elkdonis/db";
import { getServerAuth } from "@elkdonis/auth-server";
import { createAuthCode, externalOrigin, findUser, getClient, interAppSecret, verifyHs256 } from "@/lib/oidc";

export const dynamic = "force-dynamic";

/**
 * GET /api/oidc/authorize — Nextcloud's "Sign in with Elkdonis" starts here.
 * Ported from apps/inner-gathering (see src/lib/oidc.ts for why).
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const clientId = sp.get("client_id");
  const redirectUri = sp.get("redirect_uri");
  const state = sp.get("state");
  const scope = sp.get("scope") || "";
  const nonce = sp.get("nonce") || undefined;
  const codeChallenge = sp.get("code_challenge") || undefined;
  const codeChallengeMethod = sp.get("code_challenge_method") || undefined;
  const loginHint = sp.get("login_hint") || undefined;

  // A short-lived inter-app JWT may arrive by cookie (talk/join on this
  // domain), embedded in `state` (the older talk/join), or as login_hint.
  const cookieJwt = req.cookies.get("eac_user_jwt")?.value;
  let jwtFromState: string | undefined;
  let originalState: string | undefined = state || undefined;
  let redirectUrlFromState: string | undefined;
  if (state) {
    try {
      const data = JSON.parse(Buffer.from(state, "base64url").toString());
      if (data.jwt) {
        jwtFromState = data.jwt;
        redirectUrlFromState = data.redirect_url;
        originalState = undefined;
      }
    } catch {
      // An ordinary OAuth state — passed through unchanged.
    }
  }
  const userJwt = cookieJwt || jwtFromState || loginHint;

  const client = getClient(clientId);
  if (!client) return NextResponse.json({ error: "invalid_client" }, { status: 400 });
  if (sp.get("response_type") !== "code") {
    return NextResponse.json({ error: "unsupported_response_type" }, { status: 400 });
  }
  if (!scope.split(" ").includes("openid")) {
    return NextResponse.json({ error: "invalid_scope" }, { status: 400 });
  }
  if (!redirectUri) {
    return NextResponse.json({ error: "invalid_request", error_description: "redirect_uri is required" }, { status: 400 });
  }
  if (!client.redirectUris.includes(redirectUri)) {
    console.error("[oidc/authorize] redirect_uri not in allowlist:", redirectUri);
    return NextResponse.json({ error: "invalid_redirect_uri" }, { status: 400 });
  }

  let subject: string;
  if (userJwt) {
    try {
      const payload = verifyHs256(userJwt, interAppSecret(), {
        issuer: ["inner-gathering", "innergathering", "arts-collective"],
        audience: "admin-oidc",
      });
      subject = String(payload.userId);
    } catch (err) {
      console.error("[oidc/authorize] inter-app JWT rejected:", (err as Error).message);
      return NextResponse.json({ error: "invalid_login_hint" }, { status: 401 });
    }
  } else {
    const supabase = await getServerAuth();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      // Not signed in here: sign in, then come straight back to this URL.
      const origin = externalOrigin(req);
      const login = new URL("/login", origin);
      login.searchParams.set("next", `${req.nextUrl.pathname}${req.nextUrl.search}`);
      return NextResponse.redirect(login);
    }
    subject = session.user.id;
  }

  const user = await findUser(subject);
  if (!user) return NextResponse.json({ error: "user_not_found" }, { status: 404 });

  // Completing this flow means sociallogin is about to sign the person into
  // (auto-creating if needed) Nextcloud account "elkdonis-<users.id>". This is
  // the one moment we can trust that account exists — the person's own
  // session is creating it — so record it. Never overwrite an existing link
  // (someone linked by hand to a pre-existing Nextcloud username).
  try {
    await db`
      UPDATE users
      SET nextcloud_user_id = COALESCE(nextcloud_user_id, ${"elkdonis-" + user.id}),
          nextcloud_synced = true
      WHERE id = ${user.id} AND nextcloud_synced IS NOT TRUE
    `;
  } catch (err) {
    console.error("[oidc/authorize] failed to record the Nextcloud link:", err);
  }

  const code = await createAuthCode(user.id, client.id, redirectUri, { nonce, codeChallenge, codeChallengeMethod });

  const callback = new URL(redirectUri);
  callback.searchParams.set("code", code);
  if (originalState) callback.searchParams.set("state", originalState);
  if (redirectUrlFromState) callback.searchParams.set("redirect_url", redirectUrlFromState);

  const res = NextResponse.redirect(callback);
  // talk/join reads this to skip re-running sociallogin while a Nextcloud
  // session already exists ("this account is already connected").
  res.cookies.set("eac_nc_session", "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 8,
    path: "/",
  });
  return res;
}
