import Link from "next/link";
import type { Metadata } from "next";
import { listMarketplaceArtists } from "@elkdonis/commerce/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Artists" };

export default async function ArtistsPage() {
  const artists = await listMarketplaceArtists({ limit: 100 });

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <header className="mb-8">
        <h1 className="font-serif text-4xl tracking-tight">Artists</h1>
        <p className="mt-2 text-muted-foreground">
          Independent artists selling original work through the marketplace.
        </p>
      </header>

      {artists.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
          No artists have joined the marketplace yet.
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {artists.map((a) => (
            <li key={a.userId}>
              <Link
                href={`/artists/${a.userId}`}
                className="group flex items-center gap-4"
              >
                <span className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-muted">
                  {a.photoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.photoUrl}
                      alt={a.displayName ?? "Artist"}
                      className="h-full w-full object-cover"
                    />
                  )}
                </span>
                <span className="flex flex-col">
                  <span className="font-serif text-lg underline-offset-4 group-hover:underline">
                    {a.displayName ?? "Unnamed artist"}
                  </span>
                  {a.city && (
                    <span className="text-sm text-muted-foreground">{a.city}</span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
