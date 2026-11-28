import "server-only";
import { db } from "@elkdonis/db";
import { FALLBACK_LOOK, readOfferLook } from "@/lib/offer-site";
import { DEFAULT_TEMPLATE, FEATURED_KEY, TEMPLATE_KEY_PREFIX, cleanTemplate, parseFeatured } from "@/lib/offer-load/keys";
import { kindOf, readArtworks, readFallbackFeatured, readFeaturedThread, storedTemplateOf } from "@/lib/offer-load/read";
import type { CurrentWorkData } from "@/lib/offer-card-types";
import type { OfferKind } from "@elkdonis/cms-ui/offer-surface";

/**
 * Reads what the "Current Work Page" card shows. Reads only, and the same order as loadOfferPage:
 * the key in site_config `offer:featured` when it still resolves under the public test, else the
 * automatic pick; the template is the one stored with the piece, else the kind's default.
 * Callers have already checked that the viewer may edit this org.
 */
export async function loadCurrentWork(
  org: { id: string; slug: string; name: string },
  siteUrl: string,
  drawsInstead: string
): Promise<CurrentWorkData> {
  const lookRow = await readOfferLook(org.id);
  const look = lookRow?.look ?? FALLBACK_LOOK;

  let configRows: Array<{ key: string; value: unknown }> = [];
  try {
    configRows = await db<Array<{ key: string; value: unknown }>>`
      SELECT key, value FROM site_config WHERE org_id = ${org.id} AND key LIKE 'offer:%'`;
  } catch (err) {
    console.error("[offer-card] site_config:", err);
  }
  const config = new Map(configRows.map((r) => [r.key, r.value]));

  const wanted = parseFeatured(config.get(FEATURED_KEY));
  let key: string | null = null;
  let kind: OfferKind | null = null;
  let title = "";
  let cover: string | null = null;
  let chosen = false;
  let stored: unknown;

  if (wanted?.startsWith("thread:")) {
    const r = await readFeaturedThread(org.id, wanted.slice(7));
    if (r) {
      key = wanted; kind = kindOf(r.kind); title = r.title; cover = r.cover; chosen = true; stored = storedTemplateOf(r);
    }
  } else if (wanted?.startsWith("artwork:")) {
    const a = await readArtworks(org.id, 1, wanted.slice(8));
    const row = a.rows[0];
    if (row) {
      key = wanted; kind = "artwork"; title = row.title; cover = row.cover ?? a.images.get(row.id)?.[0] ?? null; chosen = true;
    }
  }
  if (!key) {
    const r = await readFallbackFeatured(org.id);
    if (r) {
      key = `thread:${r.id}`; kind = kindOf(r.kind); title = r.title; cover = r.cover; stored = storedTemplateOf(r);
    }
  }
  if (key && stored === undefined) {
    const v = config.get(`${TEMPLATE_KEY_PREFIX}${key}`);
    stored = v && typeof v === "object" ? (v as Record<string, unknown>).template : undefined;
  }

  return {
    orgSlug: org.slug,
    orgName: org.name,
    siteUrl,
    enabled: lookRow?.enabled === true,
    look: { font: look.font, icons: look.icons, mark: look.mark, tint: look.tint, sheet: look.sheet === "level" ? "level" : "natural" },
    drawsInstead,
    featured:
      key && kind
        ? { key, kind, title, cover, chosen, template: cleanTemplate(stored, kind) ?? DEFAULT_TEMPLATE[kind] }
        : null,
  };
}
