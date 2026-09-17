import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { ProductGrid } from "@elkdonis/commerce/components";
import {
  listArtworks,
  listLiveAuctionArtworks,
  listStores,
  type ListArtworksOptions,
} from "@elkdonis/commerce/queries";
import { BrowseFilters } from "@/components/browse-filters";
import { FeaturedWork } from "@/components/featured-work";
import { ArtistRow } from "@/components/artist-row";
import { siteConfig } from "@/config/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { absolute: `${siteConfig.name} — ${siteConfig.tagline}` },
};

const KIND_TABS = [
  { value: "", label: "All" },
  { value: "original", label: "Originals" },
  { value: "limited_edition", label: "Limited editions" },
  { value: "open_edition", label: "Prints" },
] as const;

const SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "popular", label: "Most viewed" },
] as const;

type SortValue = (typeof SORTS)[number]["value"];

/**
 * The marketplace's front door is the marketplace, laid out as a room.
 *
 * Two facts drove this design over a conventional storefront. The catalogue is
 * small — fifteen works by four artists — and a dense grid of matched tiles
 * makes a small catalogue look like a failing shop. And almost none of it
 * carries a price, because most of it is one-off original work, which is the
 * gallery norm and not a gap to paper over.
 *
 * So the page opens on one piece at size, the way a gallery opens on one wall;
 * then the hang, where each work keeps its own proportions and shares a bottom
 * edge with its neighbours; then the people who made it. A visitor who came to
 * shop rather than to look has the filters directly above the hang, and the
 * sort and "ready to buy" controls turn the room back into a shop in one click.
 */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    kind?: string;
    sort?: string;
    buyable?: string;
    from?: string;
  }>;
}) {
  const sp = await searchParams;
  // Anything off the URL is untrusted; narrow it to values the query
  // understands rather than passing a string into the sort clause.
  const sort: SortValue = SORTS.some((s) => s.value === sp.sort)
    ? (sp.sort as SortValue)
    : "newest";
  const kind = KIND_TABS.some((k) => k.value && k.value === sp.kind)
    ? (sp.kind as ListArtworksOptions["kind"])
    : undefined;
  const buyable = sp.buyable === "1";
  // Once somebody has narrowed the catalogue they are shopping, not browsing:
  // the editorial furniture gets out of the way and the page becomes results.
  const browsing = !kind && !buyable && !sp.q && sort === "newest";

  const [artworks, liveLots, stores] = await Promise.all([
    listArtworks({ limit: 48, q: sp.q || undefined, kind, sort, pricedOnly: buyable }),
    browsing ? listLiveAuctionArtworks({ limit: 4 }) : Promise.resolve([]),
    browsing ? listStores({ limit: 12 }) : Promise.resolve([]),
  ]);

  // A running auction leads over anything else — it is the only thing here on
  // a clock. Otherwise the newest piece with a picture opens the page; one
  // without would leave the largest element on the site empty.
  const featured = browsing
    ? (liveLots.find((a) => a.primaryImageUrl) ?? artworks.find((a) => a.primaryImageUrl) ?? null)
    : null;
  const hang = featured ? artworks.filter((a) => a.id !== featured.id) : artworks;
  const artists = stores.filter((s) => s.ownerKind === "user" && s.displayName);

  return (
    <main>
      {featured && (
        <div className="border-b border-border bg-wall">
          <div className="mx-auto max-w-7xl px-6 py-12 lg:py-16">
            <FeaturedWork artwork={featured} />
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-6">
        {/* The masthead sits under the featured work rather than above it: the
            art introduces the site better than a sentence does.

            It is one line and one sentence on purpose. The first draft added a
            paragraph and two buttons here, which put the catalogue a second
            full screen down — the same "click in before you see anything"
            this page was rebuilt to get rid of, just without the click. The
            two buttons it held are both still on the page: "ready to buy" is a
            filter in the bar below, and the 3D gallery is in the nav and at
            the end of that same bar. */}
        <section className="border-b border-border py-9">
          <h1 className="max-w-4xl font-serif text-3xl leading-[1.15] tracking-tight md:text-[2.75rem]">
            Original art, direct from the artist.
          </h1>
          <p className="mt-3 max-w-3xl text-muted-foreground">
            Paintings, sculpture and editioned prints from across the Elkdonis
            Arts Collective. Buy outright or bid in a timed auction — the money
            goes to the artist, not to a middleman.
          </p>
        </section>

        {liveLots.length > 0 && (
          <section aria-labelledby="live-now" className="border-b border-border py-14">
            <div className="mb-10 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="live-now" className="font-serif text-2xl tracking-tight">
                  <span className="mr-2 inline-block h-2 w-2 rounded-full bg-live align-middle" aria-hidden="true" />
                  Bidding open now
                </h2>
                <p className="mt-1 text-sm text-ink-faint">
                  A bid in the final minutes extends the clock, so nothing is
                  won by sniping.
                </p>
              </div>
              <Link href="/lots" className="text-sm underline-offset-4 hover:underline">
                All auctions →
              </Link>
            </div>
            <ProductGrid items={liveLots} density="tight" label="Auctions open for bidding" />
          </section>
        )}

        {/* The hang */}
        <section aria-labelledby="the-hang" className="py-10">
          <h2 id="the-hang" className="sr-only">
            {browsing ? "Works on show" : "Results"}
          </h2>

          <BrowseFilters
            kinds={KIND_TABS}
            sorts={SORTS}
            activeKind={sp.kind ?? ""}
            activeSort={sort}
            buyable={buyable}
            q={sp.q ?? ""}
          />

          <p className="mb-8 text-sm text-ink-faint" role="status">
            {hang.length} {hang.length === 1 ? "work" : "works"}
            {sp.q ? ` matching “${sp.q}”` : ""}
            {buyable ? ", priced and available now" : ""}
          </p>

          <ProductGrid
            items={hang}
            label={browsing ? "Works on show" : "Results"}
            emptyState={
              <div className="border border-dashed border-border px-6 py-16 text-center">
                {browsing ? (
                  <>
                    <p className="font-serif text-xl">The walls are empty.</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Once artists open a store and publish work, it hangs here.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-serif text-xl">Nothing matches that.</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Try fewer filters, or{" "}
                      <Link href="/" className="underline underline-offset-4">
                        see everything on show
                      </Link>
                      .
                    </p>
                  </>
                )}
              </div>
            }
          />
        </section>

        {artists.length > 0 && (
          <div className="border-t border-border py-14">
            <ArtistRow artists={artists} />
          </div>
        )}
      </div>

      {/* Selling is the marketplace's other half, and it had no presence on
          the front page beyond one word in the nav. Last, though: a visitor is
          here to look first. */}
      <section className="border-t border-border bg-wall">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-16 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <h2 className="font-serif text-2xl tracking-tight">Sell your work here</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Members of the collective open a store in a few minutes, list work
              and run their own auctions. You keep the relationship with the
              collector and you are paid directly — an organisation takes a
              share only where you have agreed to one.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            <Button asChild>
              <Link href="/studio/apply">Open a store</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/artists">See who sells here</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
