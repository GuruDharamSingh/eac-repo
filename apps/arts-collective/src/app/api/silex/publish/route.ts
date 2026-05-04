import { NextResponse } from "next/server";
import { db } from "@elkdonis/db";
import {
  createFolder,
  exists,
  getAdminClient,
} from "@elkdonis/nextcloud";
import { requireUser } from "@/lib/session";
import { isOrgOwner } from "@/lib/org";

const MAX_HTML_BYTES = 2 * 1024 * 1024; // 2MB ceiling

/**
 * Phase 1 publish endpoint.
 *
 * Owner posts the static HTML they exported from Silex (running at
 * http://localhost:6805 in dev). We write it under the admin-owned
 * /Silex/{slug}/index.html on Nextcloud and update the organizations row.
 *
 * Phase 2 will replace the body-upload model with a per-user Nextcloud
 * connector inside Silex. Until then this route is the single seam.
 */
export async function POST(req: Request) {
  const user = await requireUser();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { slug, html } = body as { slug?: unknown; html?: unknown };
  if (typeof slug !== "string" || !slug) {
    return NextResponse.json({ error: "slug is required" }, { status: 400 });
  }
  if (typeof html !== "string" || !html) {
    return NextResponse.json({ error: "html is required" }, { status: 400 });
  }
  if (Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) {
    return NextResponse.json(
      { error: `html exceeds ${MAX_HTML_BYTES} bytes` },
      { status: 413 }
    );
  }

  const orgs = await db<{ id: string }[]>`
    SELECT id FROM organizations WHERE slug = ${slug} LIMIT 1
  `;
  const orgId = orgs[0]?.id;
  if (!orgId) {
    return NextResponse.json({ error: "Org not found" }, { status: 404 });
  }

  const owner = await isOrgOwner(user.id, orgId);
  if (!owner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const folder = `/Silex/${slug}`;
  const path = `${folder}/index.html`;

  let admin;
  try {
    admin = getAdminClient();
  } catch {
    return NextResponse.json(
      {
        error:
          "Nextcloud admin client is not configured. Set NEXTCLOUD_URL, NEXTCLOUD_ADMIN_USER, NEXTCLOUD_ADMIN_PASSWORD.",
      },
      { status: 500 }
    );
  }

  try {
    if (!(await exists(admin, "/Silex"))) {
      await createFolder(admin, "/Silex");
    }
    if (!(await exists(admin, folder))) {
      await createFolder(admin, folder);
    }
    await admin.webdav.putFileContents(path, Buffer.from(html, "utf8"), {
      overwrite: true,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to write to Nextcloud", detail: String(err) },
      { status: 502 }
    );
  }

  await db`
    UPDATE organizations
    SET layout_mode = 'silex',
        silex_published_path = ${path},
        silex_published_at = NOW()
    WHERE id = ${orgId}
  `;

  return NextResponse.json({ ok: true, path });
}
