import type { Metadata } from "next";
import { ArtworkGrid } from "@elkdonis/commerce/components";
import { listArtworks } from "@elkdonis/commerce/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Artworks" };

const KIND_TABS = [
  { value: "", label: "All" },
  { value: "original", label: "Originals" },
  { value: "limited_edition", label: "Limited editions" },
  { value: "open_edition", label: "Prints" },
] as const;

export default async function ArtworksPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kind?: string }>;
}) {
  const { q, kind } = await searchParams;
  const artworks = await listArtworks({
    limit: 48,
    q: q || undefined,
    kind: (kind as "original" | "limited_edition" | "open_edition") || undefined,
  });

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <header className="mb-8">
        <h1 className="font-serif text-4xl tracking-tight">Artworks</h1>
        <p className="mt-2 text-muted-foreground">
          Original paintings, sculpture, and editioned prints from independent artists.
        </p>
      </header>

      <div className="mb-8 flex flex-wrap items-center gap-4 border-b border-border pb-4">
        <nav className="flex flex-wrap gap-1">
          {KIND_TABS.map((t) => {
            const active = (kind ?? "") === t.value;
            const href = t.value ? `/artworks?kind=${t.value}` : "/artworks";
            return (
              <a
                key={t.value}
                href={href}
                className={
                  "rounded-full px-3 py-1.5 text-sm transition-colors " +
                  (active
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted")
                }
              >
                {t.label}
              </a>
            );
          })}
        </nav>
        <form action="/artworks" className="ml-auto">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search by title or subject"
            className="h-9 w-64 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </form>
      </div>

      <p className="mb-6 text-sm text-muted-foreground">
        {artworks.length} {artworks.length === 1 ? "work" : "works"}
        {q ? ` matching “${q}”` : ""}
      </p>

      <ArtworkGrid
        items={artworks}
        columns={4}
        emptyState={
          <div className="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
            No artworks found. Artists need to opt into the marketplace and
            publish work before it appears here.
          </div>
        }
      />
    </main>
  );
}
