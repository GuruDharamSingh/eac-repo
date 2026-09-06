import { NextResponse } from "next/server";
import { db } from "@elkdonis/db";
import { listFiles } from "@elkdonis/services";
import { getApiEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";

/**
 * The org's media library — what's already in EAC_Network/<org>/Media.
 *
 * Two sources, merged:
 *  - the `media` table, which /api/upload writes and which carries the
 *    original filename, type and size; and
 *  - a live listing of the Nextcloud folder, so files dropped straight into
 *    Nextcloud (outside this app) still show up.
 *
 * Nextcloud is the source of truth for what exists; the database adds the
 * nice metadata. If Nextcloud is unreachable the database listing alone is
 * still returned rather than failing the picker.
 */

export interface LibraryItem {
  url: string;
  filename: string;
  type: string;
  source: "upload" | "nextcloud";
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg)$/i;

export async function GET() {
  // Editors only: the library is an authoring tool, and listing it reveals
  // filenames of unpublished material.
  const editor = await getApiEditor();
  if (!editor) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const items = new Map<string, LibraryItem>();

  try {
    const rows = await db<{ url: string; filename: string; type: string }[]>`
      SELECT url, filename, type
      FROM media
      WHERE org_id = ${siteConfig.orgId} AND type = 'image'
      ORDER BY created_at DESC
      LIMIT 200
    `;
    for (const row of rows) {
      if (row.url) {
        items.set(row.url, {
          url: row.url,
          filename: row.filename,
          type: row.type,
          source: "upload",
        });
      }
    }
  } catch (err) {
    console.error("[amrit-canada] media library (db):", err);
  }

  try {
    const folder = `EAC_Network/${siteConfig.orgId}/Media/Images`;
    const files = await listFiles(folder);
    for (const file of files) {
      const name: string | undefined =
        typeof file === "string" ? file : (file?.name ?? file?.basename ?? file?.filename);
      if (!name || !IMAGE_EXT.test(name)) continue;

      const url = `/api/media/${folder}/${name}`;
      if (!items.has(url)) {
        items.set(url, { url, filename: name, type: "image", source: "nextcloud" });
      }
    }
  } catch (err) {
    // Degrade to the database listing rather than breaking the picker.
    console.error("[amrit-canada] media library (nextcloud):", err);
  }

  return NextResponse.json({ items: [...items.values()] });
}
