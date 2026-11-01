import { db } from "@elkdonis/db";
import { getFeaturedSeries, listSeriesLots, listStores, listStoreFrontArtworks, type AuctionSeries } from "@elkdonis/commerce/queries";
import { canCreateSeries } from "@elkdonis/commerce/server";
import { siteConfig } from "@/config/site";

// ============================================================================
// The landing page's rotating hero (2026-10-28, Intro 10 on
// https://claude.ai/artifact/WS42RxEnjidTqmhqKbumJ5): slide 1 is the current
// published series with one of its lots as the image; the slides after it are
// featured artists with a featured work. Which artists are featured is a
// marketplace setting (`site_config`, org `market`, key `home_hero`), set by
// the site's owners in Admin → Pages; with none set, the artists with the
// newest work on the market fill the slot.
// ============================================================================

export const HERO_KEY = "home_hero";

export interface HeroSeriesSlide {
  kind: "series";
  series: AuctionSeries;
  presenterName: string | null;
  lot: { id: string; title: string; artistName: string | null; imageUrl: string } | null;
  lotCount: number;
  artistCount: number;
}

export interface HeroArtistSlide {
  kind: "artist";
  storeId: string;
  handle: string;
  name: string;
  headline: string | null;
  photoUrl: string | null;
  bioText: string | null;
  work: { id: string; title: string; imageUrl: string; priceLabel: string | null } | null;
  workCount: number;
}

export type HeroSlide = HeroSeriesSlide | HeroArtistSlide;

export interface HeroSettings {
  /** Store ids of the artists to feature, in order. */
  featuredStoreIds: string[];
}

export async function loadHeroSettings(): Promise<HeroSettings> {
  try {
    const [row] = (await db`
      SELECT value FROM site_config WHERE org_id = ${siteConfig.marketplaceOrgId} AND key = ${HERO_KEY}
    `) as unknown as Array<{ value: { featuredStoreIds?: unknown } | null }>;
    const ids = row?.value?.featuredStoreIds;
    return { featuredStoreIds: Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string").slice(0, 6) : [] };
  } catch {
    return { featuredStoreIds: [] };
  }
}

export async function saveHeroSettings(settings: HeroSettings): Promise<void> {
  const clean = { featuredStoreIds: settings.featuredStoreIds.filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 6) };
  await db`
    INSERT INTO site_config (org_id, key, value, updated_at)
    VALUES (${siteConfig.marketplaceOrgId}, ${HERO_KEY}, ${db.json(clean as never)}, now())
    ON CONFLICT (org_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `;
}

/** Who edits the hero's settings: an owner of the marketplace org, or a network admin. */
export async function canEditHome(userId: string | null): Promise<boolean> {
  if (!userId) return false;
  return canCreateSeries(userId, siteConfig.marketplaceOrgId);
}

const strip = (html: string | null | undefined) => (html ? html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "");

async function artistSlide(store: Awaited<ReturnType<typeof listStores>>[number]): Promise<HeroArtistSlide | null> {
  if (store.ownerKind !== "user" || !store.displayName) return null;
  const works = await listStoreFrontArtworks(store.id, { limit: 24 }).catch(() => []);
  const own = works.filter((w) => !w.presentedByStoreId);
  const pick = own.find((w) => w.primaryImageUrl) ?? null;
  const price = pick?.variants?.[0]?.priceMinor;
  const bio = strip(store.bioHtml);
  return {
    kind: "artist",
    storeId: store.id,
    handle: store.slug && !/^[0-9a-f-]{36}$/i.test(store.slug) ? store.slug : store.id,
    name: store.displayName,
    headline: store.headline ?? null,
    photoUrl: store.photoUrl ?? null,
    bioText: bio ? (bio.length > 180 ? bio.slice(0, 177).replace(/\s+\S*$/, "") + "…" : bio) : null,
    work: pick ? { id: pick.id, title: pick.title, imageUrl: pick.primaryImageUrl!, priceLabel: price && price > 0 ? new Intl.NumberFormat("en-CA", { style: "currency", currency: pick.variants?.[0]?.currency ?? "CAD", maximumFractionDigits: 0 }).format(price / 100) : null } : null,
    workCount: own.length,
  };
}

/**
 * The slides. The series slide shows one of the series' lots with an image,
 * chosen afresh on each page load so the hero is not the same lot every visit.
 */
export async function loadHeroSlides(): Promise<HeroSlide[]> {
  const slides: HeroSlide[] = [];
  const [series, settings] = await Promise.all([getFeaturedSeries().catch(() => null), loadHeroSettings()]);

  if (series) {
    const lots = await listSeriesLots(series.id).catch(() => []);
    const withImage = lots.filter((l) => l.imageUrl && (l.status === "scheduled" || l.status === "live"));
    const chosen = withImage.length > 0 ? withImage[Math.floor(Math.random() * withImage.length)]! : null;
    const artists = new Set(lots.map((l) => l.artistName ?? "").filter(Boolean));
    slides.push({
      kind: "series",
      series,
      presenterName: series.presenterName,
      lot: chosen ? { id: chosen.id, title: chosen.title, artistName: chosen.artistName, imageUrl: chosen.imageUrl! } : null,
      lotCount: lots.length,
      artistCount: artists.size,
    });
  }

  const stores = await listStores({ limit: 40 }).catch(() => []);
  const byId = new Map<string, (typeof stores)[number]>(stores.map((s) => [s.id, s] as const));
  const chosenStores = settings.featuredStoreIds.map((id) => byId.get(id)).filter((s): s is NonNullable<typeof s> => Boolean(s));
  const candidates = chosenStores.length > 0 ? chosenStores : stores.filter((s) => s.ownerKind === "user" && s.displayName);
  for (const store of candidates) {
    if (slides.filter((s) => s.kind === "artist").length >= (chosenStores.length > 0 ? 6 : 2)) break;
    const slide = await artistSlide(store);
    if (slide && (slide.work || chosenStores.length > 0)) slides.push(slide);
  }
  return slides;
}
