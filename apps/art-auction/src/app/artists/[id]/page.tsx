import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getStoreByHandle,
  listStoreFrontArtworks,
} from "@elkdonis/commerce/queries";
import { ArtworkGrid } from "@elkdonis/commerce/components";
import { sanitizeRichText } from "@elkdonis/utils";
import { siteConfig } from "@/config/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const artist = await getStoreByHandle(id);
  return { title: artist?.displayName ?? "Artist" };
}

export default async function ArtistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const store = await getStoreByHandle(id);
  if (!store || store.status !== "active") notFound();

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

      {store.bioHtml && (
        <div
          className="prose prose-sm mb-10 max-w-2xl text-foreground/90"
          dangerouslySetInnerHTML={{ __html: sanitizeRichText(store.bioHtml) }}
        />
      )}

      <h2 className="mb-6 font-serif text-2xl tracking-tight">
        Works ({artworks.length})
        {presentedCount > 0 && (
          <span className="ml-2 text-base font-sans text-muted-foreground">
            · {presentedCount} presented for {presentedCount === 1 ? "an artist" : "artists"} of the {store.ownerKind === "org" ? "organisation" : "store"}
          </span>
        )}
      </h2>
      <ArtworkGrid
        items={artworks}
        columns={4}
        hrefBuilder={(a) => (a.presentedByStoreId ? `/artworks/${a.id}?via=${a.presentedByStoreId}` : `/artworks/${a.id}`)}
        emptyState={
          <p className="text-muted-foreground">
            Nothing published yet.{" "}
            <Link href="/artworks" className="underline underline-offset-4">
              Browse the marketplace
            </Link>
            .
          </p>
        }
      />
    </main>
  );
}
