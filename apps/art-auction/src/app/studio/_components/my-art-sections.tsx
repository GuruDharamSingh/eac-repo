import Link from "next/link";
import type { Artwork } from "@elkdonis/commerce/types";
import type { MyBid } from "@elkdonis/commerce/queries";
import { formatMoney } from "@elkdonis/commerce/money";

/** Pieces other stores credit to this person (migration 209). They are not paid for these. */
export function CreditedElsewhere({ artworks }: { artworks: Artwork[] }) {
  if (artworks.length === 0) return null;
  return (
    <section className="mb-12">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-serif text-2xl tracking-tight">
          Credited to you elsewhere
          <span className="ml-2 text-base text-muted-foreground">({artworks.length})</span>
        </h2>
      </div>
      <p className="-mt-2 mb-4 text-sm text-muted-foreground">
        Listed by another store (a donation, or work an organisation holds) with you named as the
        artist. The store keeps the proceeds. Decline a credit from your ArtDirect page.
      </p>
      <ul className="divide-y divide-border rounded-lg border border-border">
        {artworks.map((a) => (
          <li key={a.id} className="flex items-center gap-4 p-4">
            <span className="h-16 w-16 shrink-0 overflow-hidden rounded bg-muted">
              {a.primaryImageUrl && <img src={a.primaryImageUrl} alt={a.primaryImageAlt ?? a.title} className="h-full w-full object-cover" />}
            </span>
            <div className="min-w-0 flex-1">
              <Link href={`/artworks/${a.id}`} className="truncate font-serif text-lg underline-offset-4 hover:underline">{a.title}</Link>
              <p className="mt-1 text-xs text-muted-foreground">{a.status}{a.artistName && a.artistName !== a.creditedArtistName ? ` · sold by ${a.artistName}` : ""}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Lots this person has bid on: leading, outbid, won. */
export function MyBids({ bids }: { bids: MyBid[] }) {
  if (bids.length === 0) return null;
  const open = bids.filter((b) => b.lotStatus === "live" || b.lotStatus === "scheduled");
  const done = bids.filter((b) => !open.includes(b));
  const row = (b: MyBid) => (
    <li key={b.lotId} className="flex items-center gap-4 p-4">
      <span className="h-16 w-16 shrink-0 overflow-hidden rounded bg-muted">
        {b.imageUrl && <img src={b.imageUrl} alt={b.title} className="h-full w-full object-cover" />}
      </span>
      <div className="min-w-0 flex-1">
        <Link href={`/lots/${b.lotId}`} className="truncate font-serif text-lg underline-offset-4 hover:underline">{b.title}</Link>
        <p className="mt-1 text-xs text-muted-foreground">
          {b.seriesTitle ? `${b.seriesTitle} · ` : ""}
          {b.won ? "Won" : b.leading ? "You lead" : b.lotStatus === "live" || b.lotStatus === "scheduled" ? "Outbid" : b.lotStatus}
          {" · "}your maximum {formatMoney(b.myMaxMinor, b.currency as "CAD")}
          {b.currentBidMinor != null ? ` · standing at ${formatMoney(b.currentBidMinor, b.currency as "CAD")}` : ""}
          {" · "}{b.won ? "closed" : "closes"} {new Date(b.endAt).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" })}
        </p>
      </div>
      {b.won && b.orderId && (
        <Link href={`/orders/${b.orderId}`} className="shrink-0 text-sm underline underline-offset-4">Your order →</Link>
      )}
    </li>
  );
  return (
    <section className="mb-12">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-serif text-2xl tracking-tight">
          Your bids
          <span className="ml-2 text-base text-muted-foreground">({bids.length})</span>
        </h2>
      </div>
      {open.length > 0 && <ul className="mb-4 divide-y divide-border rounded-lg border border-border">{open.map(row)}</ul>}
      {done.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm text-muted-foreground">Closed lots ({done.length})</summary>
          <ul className="mt-3 divide-y divide-border rounded-lg border border-border">{done.map(row)}</ul>
        </details>
      )}
    </section>
  );
}
