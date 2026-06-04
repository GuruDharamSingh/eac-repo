import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getMarketplaceArtist,
  listArtworks,
} from "@elkdonis/commerce/queries";
import { ArtworkGrid } from "@elkdonis/commerce/components";
import { sanitizeRichText } from "@elkdonis/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const artist = await getMarketplaceArtist(id);
  return { title: artist?.displayName ?? "Artist" };
}

export default async function ArtistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const artist = await getMarketplaceArtist(id);
  if (!artist) notFound();

  const artworks = await listArtworks({
    artistUserId: id,
    status: ["available", "reserved", "sold"],
    limit: 60,
  });

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      {/* Artist header — the editable bio area is a candidate for a GrapesJS
          template in future; rendered here as bio_html for now. */}
      <header className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-center">
        <span className="h-24 w-24 shrink-0 overflow-hidden rounded-full bg-muted">
          {artist.photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={artist.photoUrl}
              alt={artist.displayName ?? "Artist"}
              className="h-full w-full object-cover"
            />
          )}
        </span>
        <div>
          <h1 className="font-serif text-4xl tracking-tight">
            {artist.displayName ?? "Unnamed artist"}
          </h1>
          {artist.city && (
            <p className="mt-1 text-muted-foreground">{artist.city}</p>
          )}
        </div>
      </header>

      {artist.bioHtml && (
        <div
          className="prose prose-sm mb-10 max-w-2xl text-foreground/90"
          dangerouslySetInnerHTML={{ __html: sanitizeRichText(artist.bioHtml) }}
        />
      )}

      <h2 className="mb-6 font-serif text-2xl tracking-tight">
        Works ({artworks.length})
      </h2>
      <ArtworkGrid
        items={artworks}
        columns={4}
        emptyState={
          <p className="text-muted-foreground">
            This artist hasn’t published any work yet.
          </p>
        }
      />
    </main>
  );
}
