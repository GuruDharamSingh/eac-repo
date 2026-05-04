import { NextResponse } from "next/server";
import { db } from "@elkdonis/db";
import {
  createNextcloudClient,
  downloadFile,
  ensureOrgFolder,
  ensureOrgFolderPath,
  type NextcloudClient,
} from "@elkdonis/nextcloud";
import { getServerSession } from "@elkdonis/auth-server";
import { canEditOrgSite } from "@/lib/org";
import { makeSilexPublishedRef } from "@/lib/silex-published";

const PUBLISH_MANIFEST_FILENAME = ".eac-publish.json";

type SilexPublishManifest = {
  version?: unknown;
  entryPath?: unknown;
  publishedAt?: unknown;
  htmlFiles?: unknown;
};

function normalizeNextcloudPath(path: string): string {
  return path.replace(/^\/+/, "");
}

function isSafePublishedEntryPath(path: string): boolean {
  return (
    path.length > 0 &&
    !path.startsWith("/") &&
    !path.split("/").some((part) => part === ".." || part === "") &&
    path.toLowerCase().endsWith(".html")
  );
}

async function readPublishedEntryPath(
  nextcloudClient: NextcloudClient,
  publishedDir: string
): Promise<string | null> {
  try {
    const manifestPath = `${publishedDir}/${PUBLISH_MANIFEST_FILENAME}`;
    const file = await downloadFile(nextcloudClient, manifestPath);
    const manifest = JSON.parse(file.toString("utf8")) as SilexPublishManifest;
    if (typeof manifest.entryPath !== "string") return null;

    const entryPath = normalizeNextcloudPath(manifest.entryPath);
    if (!isSafePublishedEntryPath(entryPath)) return null;

    return normalizeNextcloudPath(`${publishedDir}/${entryPath}`);
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const session = await getServerSession();
  const user = session.user;
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
  if (mode !== "silex" && mode !== "default") {
    return NextResponse.json(
      { error: "mode must be 'silex' or 'default'" },
      { status: 400 }
    );
  }

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

  const dbUserId = user.db_user_id ?? user.id;
  if (!(await canEditOrgSite(dbUserId, org.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (mode === "default") {
    await db`
      UPDATE organizations
      SET layout_mode = 'default'
      WHERE id = ${org.id}
    `;
    return NextResponse.json({ ok: true, mode: "default" });
  }

  if (!user.nextcloud_user_id || !user.nextcloud_app_password) {
    return NextResponse.json(
      { error: "No Nextcloud credentials on this account." },
      { status: 409 }
    );
  }
  const baseUrl = process.env.NEXTCLOUD_URL;
  if (!baseUrl) {
    return NextResponse.json(
      { error: "NEXTCLOUD_URL environment variable is required" },
      { status: 500 }
    );
  }

  const nextcloudClient = createNextcloudClient({
    baseUrl,
    username: user.nextcloud_user_id,
    password: user.nextcloud_app_password,
  });

  let nextcloudFolderPath = org.nextcloud_folder_path?.trim() ?? "";
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
    return NextResponse.json(
      { error: "Could not verify Nextcloud org folder", detail: String(err) },
      { status: 502 }
    );
  }

  const base = nextcloudFolderPath.replace(/\/+$/, "");
  const publishedDir = `${base}/silex/published`;
  const projectPath = `${base}/silex/project/website.json`;
  const entryPath = await readPublishedEntryPath(nextcloudClient, publishedDir);

  if (!entryPath) {
    return NextResponse.json(
      {
        error:
          "No Silex publish manifest found. Publish from Silex first, then activate it here.",
      },
      { status: 404 }
    );
  }

  const publishedRef = makeSilexPublishedRef(user.nextcloud_user_id, entryPath);
  await db`
    UPDATE organizations
    SET layout_mode = 'silex',
        silex_project_path = ${projectPath},
        silex_published_path = ${publishedRef},
        silex_published_at = NOW()
    WHERE id = ${org.id}
  `;

  return NextResponse.json({ ok: true, mode: "silex", path: publishedRef });
}
