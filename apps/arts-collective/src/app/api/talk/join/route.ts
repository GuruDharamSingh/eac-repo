import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";
import { getServerSession } from "@elkdonis/auth-server";
import { db } from "@elkdonis/db";

/**
 * Talk Room Join Redirect (mirrors apps/inner-gathering/api/talk/join)
 *
 * Strategy: ensure the user has a Nextcloud browser session before opening
 * the Talk room, so they appear as themselves rather than a guest.
 *
 *   1. Not logged in, or logged in but not synced — guest join, no login wall.
 *   2. If they completed OAuth in the last 2 minutes (cookie), direct redirect.
 *   3. Otherwise route through Nextcloud's /login with redirect_url:
 *      a live NC session redirects straight to the Talk room, while a fresh
 *      one is auto-forwarded (sociallogin auto_login=1) to our OIDC authorize
 *      endpoint, which reads the short-lived eac_user_jwt cookie and signs
 *      them in without a password prompt. Hitting the sociallogin endpoint
 *      directly errors ("account already connected") when a session exists.
 *
 * Usage: /api/talk/join?token=ROOM_TOKEN
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const skipOAuth = req.nextUrl.searchParams.get("skip_oauth") === "true";

  if (!token) {
    return NextResponse.json({ error: "Missing room token" }, { status: 400 });
  }

  const nextcloudUrl =
    process.env.NEXTCLOUD_PUBLIC_URL ||
    process.env.NEXT_PUBLIC_NEXTCLOUD_URL ||
    "http://localhost:8080";
  const talkPath = `/call/${token}`;
  const talkUrl = `${nextcloudUrl.replace(/\/$/, "")}${talkPath}`;

  const session = await getServerSession();
  if (!session.user) {
    // Not logged into the app at all — still let them into the room as a guest.
    return NextResponse.redirect(talkUrl);
  }

  const [user] = await db<
    {
      id: string;
      email: string;
      display_name: string | null;
      nextcloud_synced: boolean | null;
      nextcloud_user_id: string | null;
    }[]
  >`
    SELECT id, email, display_name, nextcloud_synced, nextcloud_user_id
    FROM users
    WHERE id = ${session.user.id}
    LIMIT 1
  `;

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // No Nextcloud account yet — same guest fallback. Once they sync, the SSO
  // flow below takes over and joins them as their real account instead.
  if (!user.nextcloud_synced || !user.nextcloud_user_id) {
    return NextResponse.redirect(talkUrl);
  }

  const oauthTimestamp = req.cookies.get("eac_nc_oauth_ts")?.value;
  const now = Date.now();
  const twoMinutesAgo = now - 2 * 60 * 1000;
  const hasRecentOAuth =
    oauthTimestamp && parseInt(oauthTimestamp, 10) > twoMinutesAgo;

  if (hasRecentOAuth || skipOAuth) {
    return NextResponse.redirect(talkUrl);
  }

  const jwtSecret = process.env.INTER_APP_JWT_SECRET;
  if (!jwtSecret) {
    console.warn(
      "[talk/join] INTER_APP_JWT_SECRET not set — direct redirect (will be guest)"
    );
    return NextResponse.redirect(talkUrl);
  }

  const secret = new TextEncoder().encode(jwtSecret);
  const userToken = await new SignJWT({
    userId: user.id,
    email: user.email,
    displayName: user.display_name,
    nextcloudUserId: user.nextcloud_user_id,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .setIssuer("arts-collective")
    .setAudience("admin-oidc")
    .sign(secret);

  const socialLoginUrl = new URL("/login", nextcloudUrl);
  socialLoginUrl.searchParams.set("redirect_url", talkPath);

  const response = NextResponse.redirect(socialLoginUrl);
  response.cookies.set("eac_user_jwt", userToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 300,
    path: "/",
  });
  response.cookies.set("eac_nc_oauth_ts", now.toString(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 120,
    path: "/",
  });
  return response;
}
