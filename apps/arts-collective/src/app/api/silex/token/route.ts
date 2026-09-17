import { NextResponse } from "next/server";
import { db } from "@elkdonis/db";
import { getServerSession } from "@elkdonis/auth-server";
import {
  getAdminClient,
  getOrgFolderPath,
  provisionOrgOnNextcloud,
} from "@elkdonis/nextcloud";
import { canEditOrgSite } from "@/lib/org";
import { mintSilexToken, SILEX_TOKEN_TTL_SECONDS } from "@elkdonis/silex-render";

/**
 * POST /api/silex/token
 *
 * Body: { slug: string, mode?: "full" | "simple" }
 * Response: { token, editorUrl, expiresInSeconds }
 *
 * Mints a one-time auth-bridge token for the Silex editor, scoped to one org's
 * folder.
 *
 * ── Access is a ROLE, not a credential (2026-09-07) ─────────────────────────
 *
 * This route used to require the caller's own Nextcloud credentials, and
 * lazily provision them when absent. That model could not work:
 *
 *   * `generateAppPassword()` returns the account password it was given, so a
 *     stored credential is not an app password at all.
 *   * The one credential in the database returns 401.
 *   * Admin-API user creation is refused by Nextcloud 33's password-
 *     confirmation middleware, so the lazy path 403s and falls through to a
 *     409 — which is what every user got.
 *
 * Net effect: 1 of 35 people had a stored credential, it did not work, and the
 * editor was unusable by everyone.
 *
 * So authorisation is now `canEditOrgSite` — owner or guide of THIS org — and
 * the editor connects to Nextcloud as the service account, which is the same
 * account every media proxy and `/api/silex/layout` already use. Who may edit
 * is a question about the org, and answering it with "do you happen to hold a
 * working WebDAV password" was never the same question.
 *
 * Containment is by path, not by credential: the token carries one folder, and
 * `/api/silex/auth` derives exactly two paths from it —
 * `<folder>/silex/project` and `<folder>/silex/published`. The connector reads
 * and writes those and never browses a root, so a guide of one org cannot
 * reach another's files even though the underlying account could.
 *
 * Also gone: `grantOrgAccess(... ncUserId ...)`, which added the caller to the
 * `EAC_Network` group. That group backs a groupfolder granting
 * read/write/share/delete across EVERY org's files, so opening the editor was
 * quietly handing out network-wide storage access.
 */
export async function POST(req: Request) {
  const session = await getServerSession();
  const user = session.user;
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUserId = user.db_user_id ?? user.id;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { slug, mode } = (body as { slug?: unknown; mode?: unknown }) ?? {};
  if (typeof slug !== "string" || !slug) {
    return NextResponse.json({ error: "slug is required" }, { status: 400 });
  }

  const editorMode = mode === "simple" ? "simple" : "full";

  const orgs = await db<{ id: string; nextcloud_folder_path: string | null }[]>`
    SELECT id, nextcloud_folder_path
    FROM organizations
    WHERE slug = ${slug}
    LIMIT 1
  `;
  const org = orgs[0];
  if (!org) {
    return NextResponse.json({ error: "Org not found" }, { status: 404 });
  }

  // Owner or guide of this org. The whole gate.
  if (!(await canEditOrgSite(dbUserId, org.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (
    !process.env.NEXTCLOUD_URL ||
    !process.env.NEXTCLOUD_ADMIN_USER ||
    !process.env.NEXTCLOUD_ADMIN_PASSWORD
  ) {
    return NextResponse.json(
      { error: "Nextcloud is not configured on the server" },
      { status: 500 }
    );
  }

  // The service account's own view of the org folder. `getOrgFolderPath`
  // rather than a hardcoded `EAC_Network/${id}` literal: that literal appears
  // 127 times across the repo and is why orgs on a divergent path have media
  // no proxy can serve.
  let nextcloudFolderPath = org.nextcloud_folder_path?.trim() || "";

  // Legacy escape hatch, unchanged: an org whose recorded path is not under
  // the network root (hidden-enneagram's `eac/…`, seeded under a personal
  // account before the groupfolder existed) keeps that path until it is
  // migrated. The service account can read it, so the editor still works.
  const isLegacyPath =
    nextcloudFolderPath !== "" && !/^EAC[_-]Network\//.test(nextcloudFolderPath);

  if (!isLegacyPath) {
    try {
      const admin = getAdminClient();
      const { orgFolderPath } = await provisionOrgOnNextcloud(admin, org.id);
      nextcloudFolderPath = orgFolderPath || getOrgFolderPath(org.id);

      if (org.nextcloud_folder_path !== nextcloudFolderPath) {
        // Keep the column honest — it is the only record of where an org's
        // files actually live, and it had drifted on 8 of 15 orgs.
        await db`
          UPDATE organizations
          SET nextcloud_folder_path = ${nextcloudFolderPath}
          WHERE id = ${org.id}
        `;
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { error: "Could not provision the org's Nextcloud folder", detail },
        { status: 502 }
      );
    }
  }

  const token = await mintSilexToken({
    userId: dbUserId,
    orgId: org.id,
    slug,
    nextcloudFolderPath,
  });

  return NextResponse.json({
    token,
    editorUrl: `/edit/${slug}?t=${token}${
      editorMode === "simple" ? "&mode=simple" : ""
    }`,
    expiresInSeconds: SILEX_TOKEN_TTL_SECONDS,
  });
}
