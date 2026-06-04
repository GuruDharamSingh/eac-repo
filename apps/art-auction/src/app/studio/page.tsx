import Link from "next/link";
import type { Metadata } from "next";
import { listMyArtworks } from "@elkdonis/commerce/queries";
import { requireApprovedArtist } from "@/lib/marketplace-auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Studio" };

const statusStyles: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  available: "bg-emerald-100 text-emerald-800",
  reserved: "bg-amber-100 text-amber-800",
  sold: "bg-stone-200 text-stone-700",
  archived: "bg-stone-100 text-stone-500",
};

export default async function StudioPage() {
  const { artist } = await requireApprovedArtist();
  const artworks = await listMyArtworks(artist.userId);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl tracking-tight">Studio</h1>
          <p className="mt-1 text-muted-foreground">
            Welcome back, {artist.displayName ?? "artist"}.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/studio/profile"
            className="inline-flex items-center rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
          >
            Edit profile
          </Link>
          <Link
            href="/studio/artworks/new"
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            New artwork
          </Link>
        </div>
      </header>

      {artworks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
          You haven’t added any artworks yet.{" "}
          <Link href="/studio/artworks/new" className="underline">
            Create your first piece
          </Link>
          .
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {artworks.map((a) => (
            <li key={a.id} className="flex items-center gap-4 p-4">
              <span className="h-16 w-16 shrink-0 overflow-hidden rounded bg-muted">
                {a.primaryImageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.primaryImageUrl}
                    alt={a.primaryImageAlt ?? a.title}
                    className="h-full w-full object-cover"
                  />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-serif text-lg">{a.title}</p>
                <span
                  className={`mt-1 inline-block rounded px-2 py-0.5 text-xs font-medium ${
                    statusStyles[a.status] ?? "bg-muted text-muted-foreground"
                  }`}
                >
                  {a.status}
                </span>
              </div>
              <Link
                href={`/studio/artworks/${a.id}/edit`}
                className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
              >
                Edit
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
