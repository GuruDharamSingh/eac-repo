import Link from "next/link";
import type { Metadata } from "next";
import { listLotsForStore } from "@elkdonis/commerce/queries";
import { formatMoney } from "@elkdonis/commerce/money";
import { requireStudioStore } from "@/lib/marketplace-auth";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { LotActions } from "../_components/lot-actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Auctions · Studio" };

const lotStatusTone: Record<string, BadgeProps["tone"]> = {
  scheduled: "pending",
  live: "success",
  ended: "neutral",
  sold: "neutral",
  cancelled: "neutral",
  passed: "neutral",
};

export default async function StudioAuctionsPage() {
  const { store } = await requireStudioStore();
  const lots = await listLotsForStore(store.id);
  const openCount = lots.filter((l) => l.status === "live" || l.status === "scheduled").length;

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-serif text-2xl tracking-tight">
          Auctions
          <span className="ml-2 text-base text-muted-foreground">({openCount})</span>
        </h2>
      </div>

      {lots.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No auctions yet. Any listed piece can go up — use{" "}
          <span className="font-medium text-foreground">Auction</span> on its row in
          Overview.
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {lots.map((lot) => (
            <li key={lot.id} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <Link
                  href={`/lots/${lot.id}`}
                  className="truncate font-serif text-lg underline-offset-4 hover:underline"
                >
                  {lot.artwork?.title ?? "Untitled lot"}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">
                  {lot.status === "scheduled" ? "Starts" : "Ends"}{" "}
                  {new Date(lot.status === "scheduled" ? lot.startAt : lot.endAt).toLocaleString("en-CA")} ·{" "}
                  {lot.bidCount} {lot.bidCount === 1 ? "bid" : "bids"}
                  {lot.reserveMinor != null ? ` · reserve ${formatMoney(lot.reserveMinor, lot.currency)}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm tabular-nums">
                  {formatMoney(lot.currentBidMinor ?? lot.startingBidMinor, lot.currency)}
                </span>
                <Badge tone={lotStatusTone[lot.status] ?? "neutral"}>{lot.status}</Badge>
                {(lot.status === "live" || lot.status === "scheduled") && (
                  <LotActions lotId={lot.id} bidCount={lot.bidCount} />
                )}
                {lot.status === "sold" && typeof lot.metadata?.orderId === "string" && (
                  <Link href={`/orders/${lot.metadata.orderId}`} className="text-sm underline underline-offset-4">
                    Order
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
