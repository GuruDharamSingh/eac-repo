import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { consumeSilexToken } from "@elkdonis/silex-render";

/**
 * GET /api/silex/auth?token=<tokenId>
 *
 * Called BY the Silex storage connector to redeem a one-time auth-bridge
 * token. On success the token is consumed (deleted from Redis) and the
 * connector receives the per-user Nextcloud credentials plus the project
 * and published paths it should read from / write to.
 *
 * Second call with the same token returns 410 Gone.
 *
 * Response shape (on success):
 * {
 *   ncUser: string,
 *   ncPass: string,
 *   ncBaseUrl: string,
 *   projectPath: string,   // <folder>/silex/project
 *   publishedPath: string, // <folder>/silex/published
 *   slug: string,
 *   orgId: string,
 *   userId: string
 * }
 *
 * NOTE: credentials are returned in plaintext JSON — callers MUST reach this
 * endpoint over the server-to-server network only. In dev that is the
 * docker network between the `silex` and `arts-collective` containers; in
 * prod it is either the private docker network or a reverse-proxied
 * internal URL. Never expose this endpoint to end users.
 *
 * That NOTE was the whole protection until 2026-09-17, and this is an ordinary
 * public route: anyone holding a token (which /api/silex/token hands to the
 * browser) could redeem it themselves and read the credentials. The connector
 * now proves itself with SILEX_BRIDGE_SECRET, checked BEFORE the token is
 * consumed so a stranger cannot burn one either. Unset secret = closed.
 */
const BRIDGE_HEADER = "x-silex-bridge-secret";

function isConnector(req: Request): boolean {
  const expected = process.env.SILEX_BRIDGE_SECRET;
  const given = req.headers.get(BRIDGE_HEADER);
  if (!expected || !given) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  if (!isConnector(req)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return NextResponse.json(
      { error: "token query param is required" },
      { status: 400 }
    );
  }

  const payload = await consumeSilexToken(token);
  if (!payload) {
    // Either expired (TTL), never existed, or already consumed.
    return NextResponse.json(
      { error: "Token is invalid or has already been consumed" },
      { status: 410 }
    );
  }

  const ncBaseUrl = process.env.NEXTCLOUD_URL;
  const ncUser = process.env.NEXTCLOUD_ADMIN_USER;
  const ncPass = process.env.NEXTCLOUD_ADMIN_PASSWORD;
  if (!ncBaseUrl || !ncUser || !ncPass) {
    return NextResponse.json(
      { error: "Nextcloud is not configured on the server" },
      { status: 500 }
    );
  }

  const base = payload.nextcloudFolderPath.replace(/\/+$/, "");
  const projectPath = `${base}/silex/project`;
  const publishedPath = `${base}/silex/published`;

  return NextResponse.json({
    ncUser,
    ncPass,
    ncBaseUrl,
    projectPath,
    publishedPath,
    slug: payload.slug,
    orgId: payload.orgId,
    userId: payload.userId,
  });
}
