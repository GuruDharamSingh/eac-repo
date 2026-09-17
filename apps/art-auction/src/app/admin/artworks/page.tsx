import Link from "next/link";
import type { Metadata } from "next";
import { adminListArtworks } from "@elkdonis/commerce/queries";
import { formatMoney } from "@elkdonis/commerce/money";
import { Badge, type BadgeProps } from "@/components/ui/badge";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Artworks · Admin" };

const ARTWORK_STATUS_TONE: Record<string, BadgeProps["tone"]> = {
  draft: "neutral",
  available: "success",
  reserved: "pending",
  sold: "neutral",
  archived: "neutral",
};

export default async function AdminArtworksPage() {
  const artworks = await adminListArtworks({ limit: 50 });

  return (
    <section>
      <h2 className="mb-4 font-serif text-2xl tracking-tight">
        Artworks
        <span className="ml-2 text-base text-muted-foreground">({artworks.length})</span>
      </h2>
      {artworks.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No artworks yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Piece</th>
                <th className="px-4 py-2 font-medium">Credited to</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 text-right font-medium">Views</th>
                <th className="px-4 py-2 text-right font-medium">Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {artworks.map((a) => (
                <tr key={a.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2">
                    <Link href={`/artworks/${a.id}`} className="flex items-center gap-3">
                      <span className="h-9 w-9 shrink-0 overflow-hidden rounded bg-muted">
                        {a.primaryImageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={a.primaryImageUrl} alt={a.title} className="h-full w-full object-cover" />
                        )}
                      </span>
                      <span className="font-medium underline-offset-4 hover:underline">{a.title}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {a.artistSlug ? (
                      <Link href={`/artists/${a.artistSlug}`} className="underline-offset-4 hover:underline">
                        {a.artistName ?? "—"}
                      </Link>
                    ) : (
                      a.artistName ?? "—"
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <Badge tone={ARTWORK_STATUS_TONE[a.status] ?? "neutral"}>{a.status}</Badge>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{a.viewCount}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {a.priceMinor != null ? formatMoney(a.priceMinor, (a.currency as "CAD") ?? "CAD") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
