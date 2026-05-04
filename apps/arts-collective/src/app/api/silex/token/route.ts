import { NextResponse } from "next/server";
import { db } from "@elkdonis/db";
import { getServerSession } from "@elkdonis/auth-server";
import {
  createNextcloudClient,
  ensureOrgFolder,
  ensureOrgFolderPath,
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

  if (!user.nextcloud_user_id || !user.nextcloud_app_password) {
    return NextResponse.json(
      {
        error:
          "No Nextcloud credentials on this account. Complete Nextcloud provisioning before entering Silex mode.",
      },
      { status: 409 }
    );
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
    username: user.nextcloud_user_id,
    password: user.nextcloud_app_password,
  });

  try {
    if (nextcloudFolderPath) {
      nextcloudFolderPath = await ensureOrgFolderPath(
        nextcloudClient,
        nextcloudFolderPath
      );
    } else {
      nextcloudFolderPath = await ensureOrgFolder(nextcloudClient, org.id);
      await db`
        UPDATE organizations
        SET nextcloud_folder_path = ${nextcloudFolderPath}
        WHERE id = ${org.id}
      `;
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        error: "Could not create user-owned Nextcloud org folder",
        detail,
      },
      { status: 502 }
    );
  }

  const token = await mintSilexToken({
    userId: dbUserId,
    orgId: org.id,
    slug,
    ncUser: user.nextcloud_user_id,
    ncPass: user.nextcloud_app_password,
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
