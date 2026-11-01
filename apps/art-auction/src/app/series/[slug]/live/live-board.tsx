"use client";

import * as React from "react";
import Link from "next/link";
import type { SeriesLot } from "@elkdonis/commerce/queries";

type Feed = {
  now: string;
  phase: string;
  liveAt: string | null;
  closeMode: "single" | "staggered";
  lots: SeriesLot[];
  bids: Array<{ lotId: string; lotNumber: number | null; title: string; amountMinor: number; currency: string; paddle: string; placedAt: string }>;
};

function money(n: number | null, c: string): string {
  return n == null ? "—" : new Intl.NumberFormat("en-CA", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(n / 100);
}

function Countdown({ to, now }: { to: string; now: number }) {
  const ms = Math.max(0, new Date(to).getTime() - now);
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return <span className="tabular-nums">{h > 0 ? `${h}:` : ""}{pad(m)}:{pad(sec)}</span>;
}

export function LiveBoard({ slug }: { slug: string }) {
  const [feed, setFeed] = React.useState<Feed | null>(null);
  const [skew, setSkew] = React.useState(0);
  const [now, setNow] = React.useState(Date.now());
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const r = await fetch(`/api/series/${slug}/live`, { cache: "no-store" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const f = (await r.json()) as Feed;
        if (!live) return;
        setFeed(f);
        setSkew(new Date(f.now).getTime() - Date.now());
        setError(null);
      } catch (e) {
        if (live) setError(e instanceof Error ? e.message : "Could not load the board.");
      }
    };
    void load();
    const poll = setInterval(load, 4000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      live = false;
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [slug]);

  if (!feed) return <p className="mt-8 text-sm text-muted-foreground">{error ?? "Loading…"}</p>;
  const serverNow = now + skew;
  const open = feed.lots.filter((l) => ["scheduled", "live"].includes(l.status) && new Date(l.endAt).getTime() > serverNow);
  const closed = feed.lots.filter((l) => !open.includes(l));
  const current = open[0] ?? null;
  const next = open.slice(1, 4);

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]">
      <section>
        {current ? (
          <div className="grid gap-6 rounded-lg border border-border p-6 md:grid-cols-[18rem_1fr]">
            <div className="aspect-[4/5] overflow-hidden rounded-md bg-muted">
              {current.imageUrl && <img src={current.imageUrl} alt={current.title} className="h-full w-full object-cover" />}
            </div>
            <div className="flex flex-col">
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Lot {current.lotNumber ?? "—"} · closing next</p>
              <h2 className="mt-1 font-serif text-3xl leading-tight">{current.title}</h2>
              {current.artistName && <p className="text-muted-foreground">{current.artistName}</p>}
              <p className="mt-2 text-xs text-muted-foreground">
                Estimate {money(current.estimateLowMinor, current.currency)} – {money(current.estimateHighMinor, current.currency)}
                {current.reserveMinor != null && (current.currentBidMinor ?? 0) >= current.reserveMinor ? " · reserve met" : current.reserveMinor != null ? " · reserve not met" : ""}
              </p>
              <div className="mt-6 flex flex-wrap items-end gap-8">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{current.currentBidMinor != null ? "Current bid" : "Starting bid"}</p>
                  <p className="font-serif text-5xl tabular-nums">{money(current.currentBidMinor ?? current.startingBidMinor, current.currency)}</p>
                  <p className="text-sm text-muted-foreground">{current.bidCount} {current.bidCount === 1 ? "bid" : "bids"}{current.leaderPaddle ? ` · ${current.leaderPaddle} leads` : ""}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Closes in</p>
                  <p className="font-serif text-5xl"><Countdown to={current.endAt} now={serverNow} /></p>
                </div>
              </div>
              <p className="mt-auto pt-6">
                <Link href={`/lots/${current.id}`} className="inline-flex h-11 items-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground">
                  Bid on this lot
                </Link>
              </p>
            </div>
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
            {feed.phase === "closed" || closed.length === feed.lots.length ? "Every lot has closed." : "Waiting for the close to begin."}
          </p>
        )}

        {next.length > 0 && (
          <div className="mt-8">
            <h3 className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Coming up</h3>
            <ul className="mt-3 grid gap-3 sm:grid-cols-3">
              {next.map((l) => (
                <li key={l.id} className="rounded-md border border-border p-3 text-sm">
                  <p className="text-xs text-muted-foreground">Lot {l.lotNumber ?? "—"} · closes in <Countdown to={l.endAt} now={serverNow} /></p>
                  <p className="font-medium">{l.title}</p>
                  <p className="text-muted-foreground">{money(l.currentBidMinor ?? l.startingBidMinor, l.currency)}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {closed.length > 0 && (
          <details className="mt-8">
            <summary className="cursor-pointer text-sm font-medium">Closed ({closed.length})</summary>
            <ul className="mt-3 divide-y divide-border text-sm">
              {closed.map((l) => (
                <li key={l.id} className="flex items-center justify-between py-2">
                  <span>Lot {l.lotNumber ?? "—"} · {l.title}</span>
                  <span className="tabular-nums">{l.status === "sold" ? money(l.currentBidMinor, l.currency) : l.status}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <aside className="rounded-lg border border-border p-4">
        <h3 className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Bids</h3>
        {feed.bids.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No bids yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border text-sm">
            {feed.bids.map((b, i) => (
              <li key={i} className="flex items-baseline justify-between gap-2 py-1.5">
                <span className="truncate">
                  <span className="text-muted-foreground">Lot {b.lotNumber ?? "—"}</span> {b.paddle}
                </span>
                <span className="tabular-nums font-medium">{money(b.amountMinor, b.currency)}</span>
              </li>
            ))}
          </ul>
        )}
        {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
      </aside>
    </div>
  );
}
