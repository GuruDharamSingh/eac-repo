import Link from "next/link";
import type { Metadata } from "next";
import { adminListArtworks } from "@elkdonis/commerce/queries";
import { formatMoney } from "@elkdonis/commerce/money";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireKeeper } from "@/lib/marketplace-auth";
import { adminHideArtworkAction, adminShowArtworkAction } from "../actions";

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
  // Gate in the page as well as the layout: Next renders the two in parallel, and
  // the layout's redirect did not stop this page's data from streaming to a
  // signed-out visitor (verified on the live sites, 2026-11-06).
  await requireKeeper();
  const artworks = await adminListArtworks({ limit: 300 });

  return (
    <section>
      <h2 className="mb-4 font-serif text-2xl tracking-tight">
        Artworks
        <span className="ml-2 text-base text-muted-foreground">({artworks.length})</span>
      </h2>
      <p className="-mt-2 mb-4 text-sm text-muted-foreground">
        Hide takes a piece off the public site (browse, artist page, direct link) without deleting it; Show puts it back
        as it was. The artist cannot republish a hidden piece. A piece with an open order cannot be hidden until the order
        closes. To hide everything from one seller, hide the store under Stores.
      </p>
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
                <th className="px-4 py-2 text-right font-medium"></th>
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
                    {a.storeName && <span className="mt-0.5 block pl-12 text-xs text-muted-foreground">{a.storeName}</span>}
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
                    {a.hiddenByAdmin ? (
                      <Badge tone="destructive">hidden</Badge>
                    ) : (
                      <Badge tone={ARTWORK_STATUS_TONE[a.status] ?? "neutral"}>{a.status}</Badge>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{a.viewCount}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {a.priceMinor != null ? formatMoney(a.priceMinor, (a.currency as "CAD") ?? "CAD") : "—"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {a.hiddenByAdmin ? (
                      <form action={adminShowArtworkAction.bind(null, a.id)}>
                        <Button type="submit" variant="outline" size="sm">Show</Button>
                      </form>
                    ) : a.status === "available" || a.status === "sold" ? (
                      <form action={adminHideArtworkAction.bind(null, a.id)}>
                        <Button type="submit" variant="outline" size="sm">Hide</Button>
                      </form>
                    ) : null}
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
