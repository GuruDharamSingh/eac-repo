import { NextResponse } from "next/server";
import { consumeSilexToken } from "@/lib/silex-tokens";

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
 */
export async function GET(req: Request) {
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
  if (!ncBaseUrl) {
    return NextResponse.json(
      { error: "NEXTCLOUD_URL is not configured on the server" },
      { status: 500 }
    );
  }

  const base = payload.nextcloudFolderPath.replace(/\/+$/, "");
  const projectPath = `${base}/silex/project`;
  const publishedPath = `${base}/silex/published`;

  return NextResponse.json({
    ncUser: payload.ncUser,
    ncPass: payload.ncPass,
    ncBaseUrl,
    projectPath,
    publishedPath,
    slug: payload.slug,
    orgId: payload.orgId,
    userId: payload.userId,
  });
}
