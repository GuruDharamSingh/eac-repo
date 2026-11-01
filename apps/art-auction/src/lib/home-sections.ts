import { db } from "@elkdonis/db";
import { listArtworks } from "@elkdonis/commerce/queries";
import { siteConfig } from "@/config/site";
import { DEFAULT_CROP, LOFT_RATIOS, type LoftCrop, type LoftRatio, type LoftSpot } from "./loft-crop";

export { DEFAULT_CROP, LOFT_RATIOS };
export type { LoftCrop, LoftRatio, LoftSpot };

// ============================================================================
// The two sections around the landing hero (2026-10-29, Welcome 4 on
// https://claude.ai/artifact/WS42RxEnjidTqmhqKbumJ5): the welcome letter above
// it and the loft scene below it. Both are marketplace settings in
// `site_config` (org `market`), edited on the page by the site's owners.
// ============================================================================

export const WELCOME_KEY = "home_welcome";
export const LOFT_KEY = "home_loft";

export interface WelcomeContent {
  heading: string;
  subline: string;
  body: string;
  linkLabel: string;
  linkHref: string;
}

export const DEFAULT_WELCOME: WelcomeContent = {
  heading: "Welcome.",
  subline: "Collect Art · market.arts-collective.com",
  body:
    "Collect Art is the new home of the IFAC auction. International Fine Art Collectors presents auction series; " +
    "Arts Collective Network hosts them; and the market around it carries original work from artists across the collective.",
  linkLabel: "Read more about the site",
  linkHref: "/about",
};

const text = (v: unknown, max: number, fallback: string) =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : fallback;

/** Only a path on this site or an https link: the label is drawn as a link anyone clicks. */
const href = (v: unknown, fallback: string) =>
  typeof v === "string" && /^(\/[^\s]*|https:\/\/[^\s]+)$/.test(v.trim()) ? v.trim().slice(0, 300) : fallback;

export function cleanWelcome(v: unknown): WelcomeContent {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return {
    heading: text(o.heading, 60, DEFAULT_WELCOME.heading),
    subline: text(o.subline, 120, ""),
    body: text(o.body, 1200, DEFAULT_WELCOME.body),
    linkLabel: text(o.linkLabel, 80, DEFAULT_WELCOME.linkLabel),
    linkHref: href(o.linkHref, DEFAULT_WELCOME.linkHref),
  };
}

async function loadValue(key: string): Promise<unknown> {
  try {
    const [row] = (await db`
      SELECT value FROM site_config WHERE org_id = ${siteConfig.marketplaceOrgId} AND key = ${key}
    `) as unknown as Array<{ value: unknown }>;
    return row?.value ?? null;
  } catch {
    return null;
  }
}

async function saveValue(key: string, value: unknown): Promise<void> {
  await db`
    INSERT INTO site_config (org_id, key, value, updated_at)
    VALUES (${siteConfig.marketplaceOrgId}, ${key}, ${db.json(value as never)}, now())
    ON CONFLICT (org_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `;
}

export async function loadWelcome(): Promise<WelcomeContent> {
  const v = await loadValue(WELCOME_KEY);
  return v ? cleanWelcome(v) : DEFAULT_WELCOME;
}

export async function saveWelcome(content: WelcomeContent): Promise<void> {
  await saveValue(WELCOME_KEY, cleanWelcome(content));
}

// ── The loft ────────────────────────────────────────────────────────────────

/** A work as the home loft hangs it. */
export interface LoftWork {
  id: string;
  title: string;
  artistName: string | null;
  imageUrl: string;
  heightCm: number | null;
  widthCm: number | null;
}

/** A hung work with its framing. */
export type LoftHung = LoftWork & { ratio: LoftRatio; crop: LoftCrop };

export interface HomeLoft {
  /** The works already on the wall, in wall order (up to two). */
  hung: LoftHung[];
  /** What a visitor may hang in the free spot. */
  pool: LoftWork[];
}

const isUuid = (x: unknown): x is string => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x);
const num = (v: unknown, lo: number, hi: number, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;

export function cleanSpot(v: unknown): LoftSpot | null {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  if (!isUuid(o.id)) return null;
  const ratio = LOFT_RATIOS.some((r) => r.value === o.ratio) ? (o.ratio as LoftRatio) : "auto";
  const c = (o.crop && typeof o.crop === "object" ? o.crop : {}) as Record<string, unknown>;
  return {
    id: o.id,
    ratio,
    crop: { x: num(c.x, 0, 100, 50), y: num(c.y, 0, 100, 50), zoom: num(c.zoom, 1, 3, 1) },
  };
}

/** The saved spots. A setting written before framing existed (`hungIds`) still reads. */
export async function loadLoftSettings(): Promise<{ spots: LoftSpot[] }> {
  const v = (await loadValue(LOFT_KEY)) as { spots?: unknown; hungIds?: unknown } | null;
  if (Array.isArray(v?.spots)) {
    return { spots: v!.spots.map(cleanSpot).filter((s): s is LoftSpot => Boolean(s)).slice(0, 2) };
  }
  const ids = Array.isArray(v?.hungIds) ? v!.hungIds.filter(isUuid).slice(0, 2) : [];
  return { spots: ids.map((id) => ({ id, ratio: "auto" as const, crop: DEFAULT_CROP })) };
}

export async function saveLoftSettings(spots: unknown[]): Promise<void> {
  await saveValue(LOFT_KEY, { spots: spots.map(cleanSpot).filter(Boolean).slice(0, 2) });
}

/**
 * The loft's hang. The owners' two chosen works lead; with none chosen, the
 * two newest pictured works on the market take the wall, as shot. The pool is
 * every pictured work on the market, so the free spot can take any of them.
 */
export async function loadHomeLoft(): Promise<HomeLoft> {
  const [settings, artworks] = await Promise.all([loadLoftSettings(), listArtworks({ limit: 48 }).catch(() => [])]);
  const pool: LoftWork[] = artworks
    .filter((a) => a.primaryImageUrl)
    .map((a) => ({
      id: a.id,
      title: a.title,
      artistName: a.artistName ?? null,
      imageUrl: a.primaryImageUrl!,
      heightCm: a.heightCm ?? null,
      widthCm: a.widthCm ?? null,
    }));
  const byId = new Map(pool.map((w) => [w.id, w] as const));
  const chosen = settings.spots
    .map((s) => {
      const w = byId.get(s.id);
      return w ? { ...w, ratio: s.ratio, crop: s.crop } : null;
    })
    .filter((w): w is LoftHung => Boolean(w));
  const hung = chosen.length > 0 ? chosen : pool.slice(0, 2).map((w) => ({ ...w, ratio: "auto" as const, crop: DEFAULT_CROP }));
  return { hung, pool };
}
