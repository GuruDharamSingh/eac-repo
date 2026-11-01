import Link from "next/link";
import type { SeriesLot } from "@elkdonis/commerce/queries";

function money(n: number | null, c: string): string {
  return n == null ? "—" : new Intl.NumberFormat("en-CA", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(n / 100);
}

/** The series' lots as cards: number, picture, title, artist, estimate, current bid, close time. */
export function SeriesLotGrid({ lots }: { lots: SeriesLot[] }) {
  return (
    <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {lots.map((l) => {
        const closed = !["scheduled", "live"].includes(l.status);
        return (
          <li key={l.id} className="overflow-hidden rounded-lg border border-border">
            <Link href={`/lots/${l.id}`} className="block">
              <div className="aspect-[4/3] bg-muted">
                {l.imageUrl && <img src={l.imageUrl} alt={l.title} className="h-full w-full object-cover" />}
              </div>
              <div className="p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Lot {l.lotNumber ?? "—"}{closed ? ` · ${l.status}` : ""}
                </p>
                <p className="mt-1 font-serif text-lg leading-tight">{l.title}</p>
                {l.artistName && <p className="text-sm text-muted-foreground">{l.artistName}</p>}
                <p className="mt-2 text-xs text-muted-foreground">
                  Estimate {money(l.estimateLowMinor, l.currency)} – {money(l.estimateHighMinor, l.currency)}
                </p>
                <p className="mt-2 text-sm">
                  {l.currentBidMinor != null ? (
                    <>
                      <strong>{money(l.currentBidMinor, l.currency)}</strong>
                      <span className="ml-1 text-muted-foreground">({l.bidCount} {l.bidCount === 1 ? "bid" : "bids"})</span>
                    </>
                  ) : (
                    <>Starting at <strong>{money(l.startingBidMinor, l.currency)}</strong></>
                  )}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {closed ? "Closed" : "Closes"} {new Date(l.endAt).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" })}
                </p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
