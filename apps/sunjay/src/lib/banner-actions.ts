"use server";

import { revalidatePath } from "next/cache";
import { withOrg } from "@elkdonis/db";
import { getApiEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";

export interface BannerInput {
  /** `/api/media/...` from the upload, or null to take the picture off. */
  url: string | null;
  alt: string;
  frame: { fx: number; fy: number; zoom: number } | null;
}

/**
 * The landing banner: `site_config.image_spaces.hero`, owners and guides only.
 * The picture must be public: a path with a `Private/` segment would be a
 * broken image for every visitor.
 */
export async function saveBanner(input: BannerInput): Promise<{ ok: boolean; error?: string }> {
  const editor = await getApiEditor();
  if (!editor) return { ok: false, error: "Only owners and guides can change the banner." };

  const url = input.url?.trim() || null;
  if (url && !/^(\/api\/media\/|https:\/\/)/.test(url)) return { ok: false, error: "That picture address cannot be used." };
  if (url && /(^|\/)Private\//.test(url)) return { ok: false, error: "That picture is private, so visitors could not see it." };

  const num = (n: unknown, lo: number, hi: number, fallback: number) =>
    typeof n === "number" && Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
  const frame = input.frame
    ? { fx: num(input.frame.fx, 0, 100, 50), fy: num(input.frame.fy, 0, 100, 50), zoom: num(input.frame.zoom, 1, 4, 1) }
    : null;
  const hero = { path: url ?? "", alt: String(input.alt ?? "").slice(0, 300), frame };

  try {
    await withOrg(siteConfig.orgId, (sql) => sql`
      INSERT INTO site_config (org_id, key, value)
      VALUES (${siteConfig.orgId}, 'image_spaces', ${sql.json({ hero } as never)})
      ON CONFLICT (org_id, key) DO UPDATE SET value = site_config.value || EXCLUDED.value, updated_at = now()
    `);
  } catch (err) {
    console.error("[sunjay] save banner:", err);
    return { ok: false, error: "The banner could not be saved." };
  }
  revalidatePath("/");
  return { ok: true };
}
