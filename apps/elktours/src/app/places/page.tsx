import type { Metadata } from "next";
import { getViewer } from "@/lib/auth";
import { listPublicPlaces, placeBusinessesFor } from "@/lib/places";
import { reviewSummaries } from "@/lib/reviews";
import type { CataloguePlaceView } from "@/components/places/catalogue-view";
import { PlacesCatalogue } from "@/components/places/places-catalogue";
import { VisitorSuggest } from "@/components/places/visitor-suggest";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Places",
  description: `The places our walks in ${siteConfig.city} stop at: what they are, the tours that visit them, and what visitors say.`,
};

export const dynamic = "force-dynamic";

/** Plain text from sanitised HTML, cut near `max` (for places with no excerpt of their own). */
function line(html: string | null, max = 160): string | null {
  if (!html) return null;
  const t = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
  if (!t) return null;
  return t.length <= max ? t : `${t.slice(0, Math.max(t.lastIndexOf(" ", max), max - 30))}…`;
}

/**
 * The public catalogue of places (2026-11-02; replaces the empty Journal
 * listing, which now redirects here). Reads `listPublicPlaces`: public, not
 * archived, without private notes, stats or provenance; tours are the
 * published, public ones that stop there.
 */
export default async function PlacesPage() {
  const viewer = await getViewer().catch(() => null);
  const places = await listPublicPlaces();
  const [reviews, businesses] = await Promise.all([
    reviewSummaries(places.map((p) => ({ type: "place" as const, id: p.id }))),
    placeBusinessesFor(places.map((p) => p.id)),
  ]);

  const view: CataloguePlaceView[] = places.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    lat: p.lat,
    lng: p.lng,
    imageUrl: p.imageUrl,
    excerpt: p.excerpt ?? line(p.body),
    body: p.body,
    address: p.address,
    tags: p.tags,
    tours: p.tours.map((t) => ({ id: t.slug, slug: t.slug, title: t.title })),
    links: p.links,
    reviews: reviews.get(`place:${p.id}`) ?? null,
    businesses: businesses.get(p.id) ?? [],
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-5 py-12">
      <header className="max-w-2xl">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">{siteConfig.city}</p>
        <h1 className="mt-2 font-serif text-4xl">Places</h1>
        <p className="mt-3 text-muted-foreground">
          The places our walks stop at: what each one is, the tours that visit it, where to read more, and what visitors say.
        </p>
      </header>

      <PlacesCatalogue places={view} canEdit={Boolean(viewer?.canEdit)} />

      <VisitorSuggest places={view} />

      <p className="text-xs text-muted-foreground">
        Maps © OpenStreetMap contributors (OpenFreeMap). Place links come from Wikidata and OpenStreetMap.
      </p>
    </div>
  );
}
