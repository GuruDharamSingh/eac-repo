import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getStoreByHandle,
  listStoreFrontArtworks,
  listArtworksForPerson,
  listLotsForStore,
  listStoresForUser,
} from "@elkdonis/commerce/queries";
import { formatMoney } from "@elkdonis/commerce/money";
import { searchContent } from "@elkdonis/content/server";
import { contentHost } from "@/lib/content-host";
import { getCurrentUserId } from "@/lib/marketplace-auth";
import { db } from "@elkdonis/db";
import { ProductGrid } from "@elkdonis/commerce/components";
import { sanitizeRichText } from "@elkdonis/utils";
import { siteConfig } from "@/config/site";
import { profileBioHtml } from "@/lib/profile-bio";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const artist = await getStoreByHandle(id);
  if (artist) return { title: artist.displayName ?? "Artist" };
  const person = await findPerson(id);
  return { title: person?.name ?? "Artist" };
}

/** A network person by @username (users.slug) or id, for artists without a store. */
async function findPerson(handle: string): Promise<{ id: string; name: string; slug: string | null; avatarUrl: string | null } | null> {
  const isUuid = /^[0-9a-f-]{36}$/i.test(handle);
  const [r] = (await db`
    SELECT id, COALESCE(display_name, 'Artist') AS name, slug, avatar_url FROM users
    WHERE ${isUuid ? db`id = ${handle}` : db`slug = ${handle}`}
    LIMIT 1
  `) as unknown as Array<{ id: string; name: string; slug: string | null; avatar_url: string | null }>;
  return r ? { id: r.id, name: r.name, slug: r.slug, avatarUrl: r.avatar_url } : null;
}

/**
 * An artist with no store of their own: the work they made or are credited on
 * in this marketplace (series desks list it in the presenting org's store,
 * 2026-10-28). Not found when there is none.
 */
async function PersonArtistPage({ handle }: { handle: string }) {
  const person = await findPerson(handle);
  if (!person) notFound();
  const all = await listArtworksForPerson(person.id, { status: ["available", "reserved", "sold"], limit: 60 });
  const artworks = all.filter((a) => a.orgId === siteConfig.marketplaceOrgId);
  if (artworks.length === 0) notFound();
  const profileUrl = person.slug ? `${siteConfig.network.artdirectUrl}/${person.slug}` : null;
  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <header className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-center">
        <span className="h-24 w-24 shrink-0 overflow-hidden rounded-full bg-muted">
          {person.avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={person.avatarUrl} alt={person.name} className="h-full w-full object-cover" />
          )}
        </span>
        <div className="min-w-0">
          <h1 className="font-serif text-4xl tracking-tight">{person.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Artist</p>
          {profileUrl && (
            <p className="mt-3 text-sm">
              <a href={profileUrl} className="underline underline-offset-4">Profile on ArtDirect →</a>
            </p>
          )}
        </div>
      </header>
      <h2 className="mb-6 font-serif text-2xl tracking-tight">Works ({artworks.length})</h2>
      <ProductGrid items={artworks} label="Works" hrefBuilder={(a) => `/artworks/${a.id}`} />
    </main>
  );
}

export default async function ArtistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const store = await getStoreByHandle(id);
  if (!store || store.status !== "active") return <PersonArtistPage handle={id} />;

  // The front: what this store sells plus what it presents for other stores
  // (migration 112). Presented pieces link with `?via=` so a purchase from
  // this window is logged through it.
  const viewerId = await getCurrentUserId();
  const [artworks, lots, mine, writing] = await Promise.all([
    listStoreFrontArtworks(store.id, { limit: 60 }),
    listLotsForStore(store.id).catch(() => []),
    viewerId ? listStoresForUser(viewerId).catch(() => []) : Promise.resolve([]),
    // A person's store shows their own published, public writing (content library, scope person; 2026-11-26).
    store.ownerKind === "user" && store.ownerUserId
      ? searchContent(null, { scope: { kind: "person", userId: store.ownerUserId }, types: ["writing"], limit: 4 }, contentHost)
          .then((r) => r.items)
          .catch(() => [])
      : Promise.resolve([]),
  ]);
  const presentedCount = artworks.filter((a) => a.presentedByStoreId).length;
  const openLots = lots.filter((l) => l.status === "live" || l.status === "scheduled");
  const isOwner = mine.some((s) => s.id === store.id);
  const net = siteConfig.network;

  // The store is one front; the person's network profile lives on ArtDirect.
  const profileUrl =
    store.ownerKind === "user" && store.slug && !/^[0-9a-f-]{36}$/i.test(store.slug)
      ? `${net.artdirectUrl}/${store.slug}`
      : null;
  // A person's store shows its own note first, then their network bio, so a
  // bio written on another site (IFAC, ArtDirect) appears without retyping.
  const ownerBioHtml = store.ownerKind === "user" ? profileBioHtml(store.profileBio) : "";
  const name = store.displayName ?? (store.ownerKind === "org" ? "Organisation store" : "Unnamed artist");
  const sections = [
    { id: "works", label: `Works · ${artworks.length}` },
    openLots.length > 0 && { id: "auction", label: `In auction · ${openLots.length}` },
    writing.length > 0 && { id: "writing", label: "Writing" },
    store.links.length > 0 && { id: "links", label: "Inspiring" },
    { id: "about", label: "About" },
  ].filter(Boolean) as Array<{ id: string; label: string }>;
  const eyebrow = "text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground";
  // The store's own colour (migration 296), else the market's ink; its cover, else its photo.
  const accent = typeof store.theme?.accent === "string" && /^#[0-9a-f]{6}$/i.test(store.theme.accent) ? (store.theme.accent as string) : null;
  const heroPicture = store.coverUrl ?? store.photoUrl ?? null;
  const sectionHead = "flex flex-wrap items-baseline justify-between gap-3 border-b-2 pb-2.5";
  const addBtn = "inline-flex min-h-9 items-center rounded-md border border-dashed border-foreground/40 px-3 text-sm hover:border-solid";

  return (
    <div style={{ ["--store-accent" as string]: accent ?? "hsl(var(--border))" }} className="[&_.border-b-2]:border-[color:var(--store-accent)]">
      {isOwner && (
        <div role="region" aria-label="Your store" className="bg-foreground text-background">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-2 text-sm">
            <span>Your store · visitors see this page without this bar</span>
            <span className="flex flex-wrap gap-2">
              <a href="/center?open=artwork" className="inline-flex min-h-9 items-center rounded-md border border-background/50 px-3">+ Add artwork</a>
              <a href={`${net.artsCollectiveUrl}/studio?kind=post`} className="inline-flex min-h-9 items-center rounded-md border border-background/50 px-3">+ Add article</a>
              <a href="/center?open=store" className="inline-flex min-h-9 items-center rounded-md bg-background px-3 text-foreground">Edit in Center</a>
            </span>
          </div>
        </div>
      )}

      <section aria-label="Store" className="relative overflow-hidden bg-muted" style={accent ? { background: accent } : undefined}>
        {heroPicture && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={heroPicture} alt="" className="absolute inset-0 h-full w-full object-cover opacity-90" />
        )}
        <div className="relative bg-gradient-to-b from-transparent via-black/30 to-black/75">
          <div className="mx-auto flex min-h-[320px] max-w-7xl flex-wrap items-end justify-between gap-5 px-6 pb-9 pt-28 text-white">
            <div className="flex max-w-3xl flex-col gap-2">
              <span className="text-xs uppercase tracking-[0.16em] text-white/80">
                {store.ownerKind === "org" ? "Organisation store" : "Store"} on Collect Art{store.city ? ` · ${store.city}` : ""}
              </span>
              <h1 className="font-serif text-5xl leading-none tracking-tight md:text-6xl">{name}</h1>
              {store.headline && <p className="font-serif text-lg">{store.headline}</p>}
            </div>
            {profileUrl && (
              <a href={profileUrl} className="inline-flex min-h-11 items-center rounded-md bg-white/95 px-4 text-sm font-medium text-foreground">
                Artist page on ArtDirect
              </a>
            )}
          </div>
        </div>
      </section>

      <nav aria-label="Store sections" className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap gap-7 px-6">
          {sections.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="inline-flex min-h-12 items-center text-sm text-muted-foreground hover:text-foreground">
              {s.label}
            </a>
          ))}
        </div>
      </nav>

      <main className="mx-auto flex max-w-7xl flex-col gap-14 px-6 py-10">
        <section id="works" className="flex scroll-mt-16 flex-col gap-5">
          <div className={sectionHead}>
            <h2 className="font-serif text-3xl tracking-tight">Works</h2>
            <span className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {artworks.length} for sale
                {presentedCount > 0 ? ` · ${presentedCount} presented for ${presentedCount === 1 ? "an artist" : "artists"}` : ""}
              </span>
              {isOwner && <a href="/center?open=artwork" className={addBtn}>+ Add artwork</a>}
            </span>
          </div>
          <ProductGrid
            items={artworks}
            label="Works"
            hrefBuilder={(a) => (a.presentedByStoreId ? `/artworks/${a.id}?via=${a.presentedByStoreId}` : `/artworks/${a.id}`)}
            emptyState={
              <p className="text-muted-foreground">
                Nothing published yet.{" "}
                <Link href="/" className="underline underline-offset-4">Browse the marketplace</Link>.
              </p>
            }
          />
        </section>

        {openLots.length > 0 && (
          <section id="auction" className="flex scroll-mt-16 flex-col gap-5">
            <div className={sectionHead}><h2 className="font-serif text-3xl tracking-tight">In auction</h2></div>
            <div className="grid gap-4 md:grid-cols-2">
              {openLots.map((l) => (
                <Link key={l.id} href={`/lots/${l.id}`} className="flex overflow-hidden rounded-xl border border-border bg-card hover:shadow-sm">
                  <span className="w-40 shrink-0 bg-muted">
                    {l.artwork?.primaryImageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={l.artwork.primaryImageUrl} alt="" className="h-full w-full object-cover" />
                    )}
                  </span>
                  <span className="flex flex-col gap-1 p-4">
                    <span className={eyebrow}>{l.status === "live" ? "Bidding open" : "Opens soon"}</span>
                    <b className="font-serif text-xl font-medium">{l.artwork?.title ?? "Lot"}</b>
                    <span className="text-sm text-muted-foreground">
                      {l.currentBidMinor != null ? `Current bid ${formatMoney(l.currentBidMinor, l.currency)}` : `Starts at ${formatMoney(l.startingBidMinor, l.currency)}`}
                      {" · "}{l.status === "live" ? "ends" : "opens"} {new Date(l.status === "live" ? l.endAt : l.startAt).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {(writing.length > 0 || isOwner) && store.ownerKind === "user" && (
          <section id="writing" className="flex scroll-mt-16 flex-col gap-5">
            <div className={sectionHead}>
              <h2 className="font-serif text-3xl tracking-tight">Writing</h2>
              {isOwner && <a href={`${net.artsCollectiveUrl}/studio?kind=post`} className={addBtn}>+ Add article</a>}
            </div>
            {writing.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing published yet. Visitors see this section once you publish a piece of writing.</p>
            ) : (
              <div className="grid gap-5 md:grid-cols-2">
                {writing.map((w) => (
                  <a key={w.key} href={w.links?.public ?? "#"} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-5 hover:shadow-sm">
                    <span className={eyebrow}>
                      {(w.date ?? w.createdAt) ? new Date((w.date ?? w.createdAt) as string).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" }) : "Writing"}
                    </span>
                    <b className="font-serif text-xl font-medium">{w.title}</b>
                    {w.excerpt && <p className="line-clamp-3 text-sm text-foreground/80">{w.excerpt}</p>}
                    <span className="text-sm underline underline-offset-4">Read</span>
                  </a>
                ))}
              </div>
            )}
          </section>
        )}

        {store.links.length > 0 && (
          <section id="links" className="flex scroll-mt-16 flex-col gap-5">
            <div className={sectionHead}>
              <h2 className="font-serif text-3xl tracking-tight">Inspiring</h2>
              <span className="text-sm text-muted-foreground">People, places and pages behind the work</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {store.links.map((l) => (
                <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="rounded-xl border border-border bg-card p-4 text-sm hover:shadow-sm">
                  <b className="font-medium">{l.label || l.url}</b>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">{l.url.replace(/^https?:\/\//, "")}</span>
                </a>
              ))}
            </div>
          </section>
        )}

        <section id="about" className="flex scroll-mt-16 flex-wrap gap-10">
          <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-4">
            <h2 className="font-serif text-3xl tracking-tight">About the store</h2>
            {store.bioHtml ? (
              <div className="prose prose-sm max-w-none text-foreground/90" dangerouslySetInnerHTML={{ __html: sanitizeRichText(store.bioHtml) }} />
            ) : (
              <p className="text-sm text-muted-foreground">No store note yet.</p>
            )}
          </div>
          <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-3 rounded-xl border border-border bg-card p-5">
            <span className={eyebrow}>{store.ownerKind === "org" ? "The organisation" : "The artist"}</span>
            <div className="flex items-center gap-3">
              <span className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-muted">
                {store.photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={store.photoUrl} alt="" className="h-full w-full object-cover" />
                )}
              </span>
              <span className="flex flex-col">
                <b className="font-serif text-xl font-medium">{name}</b>
                {store.headline && <span className="text-sm text-muted-foreground">{store.headline}</span>}
              </span>
            </div>
            {ownerBioHtml && <div className="prose prose-sm max-w-none text-foreground/80" dangerouslySetInnerHTML={{ __html: ownerBioHtml }} />}
            {profileUrl && (
              <a href={profileUrl} className="inline-flex min-h-10 w-fit items-center rounded-md border border-border px-3 text-sm">Artist page on ArtDirect</a>
            )}
          </aside>
        </section>

        <p className="border-t border-border pt-4 text-xs text-muted-foreground">
          Sold by {name} on Collect Art, the market of the Elkdonis Arts Collective, a not-for-profit.
        </p>
      </main>
    </div>
  );
}
