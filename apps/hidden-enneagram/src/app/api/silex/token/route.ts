import { NextResponse } from "next/server";
import { db } from "@elkdonis/db";
import { orgStorageRoot } from "@elkdonis/services";
import { mintSilexToken, SILEX_TOKEN_TTL_SECONDS } from "@elkdonis/silex-render";
import { getApiEditor } from "@/lib/auth";
import { ORG_SLUG } from "@/lib/session";
import { siteConfig } from "@/config/site";

/**
 * POST /api/silex/token
 *
 * Body: { page?: string }
 * Response: { token, editorUrl, expiresInSeconds }
 *
 * Mints the one-time auth-bridge token that opens the Silex editor on THIS
 * org's project. The editor used to be reachable only from the arts-collective
 * hub, which meant an editor standing on hiddenenneagram.com/introduction had
 * to leave for another site to change the page in front of them. This is the
 * same token, minted here, so the editor opens from where the person is.
 *
 * Redemption stays on arts-collective (the connector calls its
 * /api/silex/auth): the token lives in the shared Redis under the prefix
 * `@elkdonis/silex-render` defines, so a token minted here is readable there.
 *
 * Single-org, so no slug in the body — and the gate is the same owner/guide
 * rule every other editorial route on this site uses.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const viewer = await getApiEditor();
  if (!viewer) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { page?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    // An empty body is fine: no page means open on the project's home page.
  }
  // A page id is slug-shaped (index, introduction, type-1); anything else is
  // dropped rather than forwarded into a URL.
  const page =
    typeof body.page === "string" && /^[a-z0-9-]{1,64}$/.test(body.page)
      ? body.page
      : null;

  const ncUser = process.env.NEXTCLOUD_ADMIN_USER;
  const ncPass = process.env.NEXTCLOUD_ADMIN_PASSWORD;
  if (!process.env.NEXTCLOUD_URL || !ncUser || !ncPass) {
    return NextResponse.json(
      { error: "Nextcloud is not configured on the server" },
      { status: 500 }
    );
  }

  // The recorded folder when there is one, the derived one otherwise — the
  // column had drifted on half the orgs, and this org's project demonstrably
  // lives at the derived path.
  const [org] = await db<{ nextcloud_folder_path: string | null }[]>`
    SELECT nextcloud_folder_path FROM organizations WHERE id = ${siteConfig.orgId}
  `;
  const nextcloudFolderPath =
    org?.nextcloud_folder_path?.trim() || orgStorageRoot(siteConfig.orgId);

  const token = await mintSilexToken({
    userId: viewer.userId,
    orgId: siteConfig.orgId,
    slug: ORG_SLUG,
    ncUser,
    ncPass,
    nextcloudFolderPath,
  });

  const query = new URLSearchParams({ t: token });
  if (page) query.set("page", page);

  return NextResponse.json({
    token,
    editorUrl: `/edit?${query.toString()}`,
    expiresInSeconds: SILEX_TOKEN_TTL_SECONDS,
  });
}
