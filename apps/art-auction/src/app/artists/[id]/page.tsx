import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getStoreByHandle,
  listStoreFrontArtworks,
  listArtworksForPerson,
} from "@elkdonis/commerce/queries";
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
  const artworks = await listStoreFrontArtworks(store.id, { limit: 60 });
  const presentedCount = artworks.filter((a) => a.presentedByStoreId).length;

  // The store is one front; the person's network profile lives on ArtDirect.
  const profileUrl =
    store.ownerKind === "user" && store.slug && !/^[0-9a-f-]{36}$/i.test(store.slug)
      ? `${siteConfig.network.artdirectUrl}/${store.slug}`
      : null;
  // A person's store shows its own note first, then their network bio, so a
  // bio written on another site (IFAC, ArtDirect) appears without retyping.
  const ownerBioHtml = store.ownerKind === "user" ? profileBioHtml(store.profileBio) : "";

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <header className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-center">
        <span className="h-24 w-24 shrink-0 overflow-hidden rounded-full bg-muted">
          {store.photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={store.photoUrl}
              alt={store.displayName ?? "Artist"}
              className="h-full w-full object-cover"
            />
          )}
        </span>
        <div className="min-w-0">
          <h1 className="font-serif text-4xl tracking-tight">
            {store.displayName ?? (store.ownerKind === "org" ? "Organisation store" : "Unnamed artist")}
          </h1>
          {store.headline && <p className="mt-1 text-muted-foreground">{store.headline}</p>}
          <p className="mt-1 text-sm text-muted-foreground">
            {store.city ? `${store.city} · ` : ""}
            {store.ownerKind === "org" ? "Organisation" : "Artist"}
          </p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {profileUrl && (
              <a href={profileUrl} className="underline underline-offset-4">
                Profile on ArtDirect →
              </a>
            )}
            {store.links.map((l) => (
              <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                {l.label || l.url}
              </a>
            ))}
          </div>
        </div>
      </header>

      {(store.bioHtml || ownerBioHtml) && (
        <div className="mb-10 max-w-2xl space-y-6">
          {store.bioHtml && (
            <div
              className="prose prose-sm text-foreground/90"
              dangerouslySetInnerHTML={{ __html: sanitizeRichText(store.bioHtml) }}
            />
          )}
          {ownerBioHtml && (
            <div
              className="prose prose-sm text-foreground/80"
              dangerouslySetInnerHTML={{ __html: ownerBioHtml }}
            />
          )}
        </div>
      )}

      <h2 className="mb-6 font-serif text-2xl tracking-tight">
        Works ({artworks.length})
        {presentedCount > 0 && (
          <span className="ml-2 text-base font-sans text-muted-foreground">
            · {presentedCount} presented for {presentedCount === 1 ? "an artist" : "artists"} of the {store.ownerKind === "org" ? "organisation" : "store"}
          </span>
        )}
      </h2>
      <ProductGrid
        items={artworks}
        label="Works"
        hrefBuilder={(a) => (a.presentedByStoreId ? `/artworks/${a.id}?via=${a.presentedByStoreId}` : `/artworks/${a.id}`)}
        emptyState={
          <p className="text-muted-foreground">
            Nothing published yet.{" "}
            <Link href="/" className="underline underline-offset-4">
              Browse the marketplace
            </Link>
            .
          </p>
        }
      />
    </main>
  );
}
