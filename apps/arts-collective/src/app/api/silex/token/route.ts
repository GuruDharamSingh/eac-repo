import { NextResponse } from "next/server";
import { db } from "@elkdonis/db";
import { getServerSession } from "@elkdonis/auth-server";
import {
  createNextcloudClient,
  ensureOrgFolderPath,
  getAdminClient,
  grantOrgAccess,
  provisionOrgOnNextcloud,
  resolveReceivedOrgPath,
} from "@elkdonis/nextcloud";
import { canEditOrgSite } from "@/lib/org";
import {
  mintSilexToken,
  SILEX_TOKEN_TTL_SECONDS,
} from "@/lib/silex-tokens";

/**
 * POST /api/silex/token
 *
 * Body: { slug: string, mode?: "full" | "simple" }
 *
 * Mints a one-time Silex auth-bridge token scoped to the authenticated
 * per-user Nextcloud credentials for a per-org owner/admin.
 *
 * Response: { token, editorUrl, expiresInSeconds }
 *
 * The returned editorUrl points at the owner-gated `/edit/{slug}` launch route,
 * which redirects to the dedicated Silex editor origin. Clients should treat
 * the token as opaque; only the Silex connector should redeem it, exactly once,
 * via GET /api/silex/auth.
 */
export async function POST(req: Request) {
  const session = await getServerSession();
  const user = session.user;
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUserId = user.db_user_id ?? user.id;

  // OAuth signups skip the email/password auto-provisioning path, so users
  // can land here without Nextcloud credentials. Provision lazily (idempotent)
  // instead of dead-ending with a 409.
  let ncUserId = user.nextcloud_user_id;
  let ncAppPassword = user.nextcloud_app_password;
  if (!ncUserId || !ncAppPassword) {
    try {
      const { handleUserProvisioning } = await import("@elkdonis/services");
      const result = await handleUserProvisioning(
        dbUserId,
        user.email!,
        user.email?.split("@")[0] || "User",
        { groups: [process.env.NEXTCLOUD_DEFAULT_GROUP || "EAC_Network"] }
      );
      if (result.success && result.nextcloudUserId && result.appPassword) {
        ncUserId = result.nextcloudUserId;
        ncAppPassword = result.appPassword;
      }
    } catch (err) {
      console.error("lazy nextcloud provisioning failed:", err);
    }
  }
  if (!ncUserId || !ncAppPassword) {
    return NextResponse.json(
      {
        error:
          "Could not provision Nextcloud credentials for this account. Try again or contact an admin.",
      },
      { status: 409 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { slug, mode } = (body as { slug?: unknown; mode?: unknown }) ?? {};
  if (typeof slug !== "string" || !slug) {
    return NextResponse.json(
      { error: "slug is required" },
      { status: 400 }
    );
  }

  const editorMode = mode === "simple" ? "simple" : "full";

  const orgs = await db<
    { id: string; nextcloud_folder_path: string | null }[]
  >`
    SELECT id, nextcloud_folder_path
    FROM organizations
    WHERE slug = ${slug}
    LIMIT 1
  `;
  const org = orgs[0];
  if (!org) {
    return NextResponse.json({ error: "Org not found" }, { status: 404 });
  }

  const canEdit = await canEditOrgSite(dbUserId, org.id);
  if (!canEdit) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let nextcloudFolderPath = org.nextcloud_folder_path?.trim() ?? "";
  const nextcloudBaseUrl = process.env.NEXTCLOUD_URL;
  if (!nextcloudBaseUrl) {
    return NextResponse.json(
      { error: "NEXTCLOUD_URL environment variable is required" },
      { status: 500 }
    );
  }

  const nextcloudClient = createNextcloudClient({
    baseUrl: nextcloudBaseUrl,
    username: ncUserId,
    password: ncAppPassword,
  });

  // Service-account model (default): the org folder lives under the service
  // account at EAC_Network/{orgId} and is shared read/write to the editor.
  // The token carries the RECIPIENT-relative path of that share, since Silex
  // connects with the user's own credentials.
  //
  // Legacy escape hatch: orgs whose folder path points elsewhere (e.g.
  // hidden-enneagram's `eac/...` seeded under a personal account) keep the
  // old behavior — the folder is ensured under the user's own account —
  // until they're migrated by scripts/backfill-org-nextcloud.mjs.
  const isLegacyUserOwned =
    nextcloudFolderPath !== "" &&
    !/^EAC[_-]Network\//.test(nextcloudFolderPath);

  try {
    if (isLegacyUserOwned) {
      nextcloudFolderPath = await ensureOrgFolderPath(
        nextcloudClient,
        nextcloudFolderPath
      );
    } else {
      const admin = getAdminClient();
      const { orgFolderPath } = await provisionOrgOnNextcloud(admin, org.id);
      if (org.nextcloud_folder_path !== orgFolderPath) {
        await db`
          UPDATE organizations
          SET nextcloud_folder_path = ${orgFolderPath}
          WHERE id = ${org.id}
        `;
      }

      await grantOrgAccess(admin, org.id, ncUserId, "owner");

      const receivedPath = await resolveReceivedOrgPath(
        admin,
        nextcloudClient,
        org.id,
        ncUserId
      );
      nextcloudFolderPath = (receivedPath ?? `/${org.id}`).replace(/^\/+/, "");
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        error: "Could not provision the org's Nextcloud folder",
        detail,
      },
      { status: 502 }
    );
  }

  const token = await mintSilexToken({
    userId: dbUserId,
    orgId: org.id,
    slug,
    ncUser: ncUserId,
    ncPass: ncAppPassword,
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
