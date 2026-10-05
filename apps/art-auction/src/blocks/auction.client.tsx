"use client";

import * as React from "react";
import Link from "next/link";
import { formatMoney } from "@elkdonis/commerce/money";
import type { Currency } from "@elkdonis/commerce/types";
import { ago, formatLeft, torontoToMs, TIME_ZONE, useFlash, useLive, useNow } from "./live.client";
import type { LiveParts, WireBid, WireLot, WireStats } from "./auction-types";

// ============================================================================
// The live auction blocks' browser halves.
//
// Each starts from what the page rendered (or the editor's example data) and
// polls /api/auction/live (live.client.tsx). Colours are the marketplace's own
// shadcn tokens, `--live` for "bidding open" and `--primary` for "closing
// soon", so every block follows light and dark.
// ============================================================================

const money = (minor: number | null | undefined, currency: string) => formatMoney(minor, (currency || "CAD") as Currency);

const qs = (parts: string, o: { event?: string; scope?: string; limit?: number; bidsLimit?: number }) => {
  const q = new URLSearchParams({ parts });
  if (o.event) q.set("event", o.event);
  if (o.scope) q.set("scope", o.scope);
  if (o.limit) q.set("limit", String(o.limit));
  if (o.bidsLimit) q.set("bidsLimit", String(o.bidsLimit));
  return q.toString();
};

const SOON_MS = 60 * 60 * 1000;

type Look = { label: string; chip: string; dot: string };

function lookOf(lot: WireLot, now: number): Look {
  const start = Date.parse(lot.startAt);
  const end = Date.parse(lot.endAt);
  if (lot.phase === "closed" || now >= end) {
    return {
      label: lot.soldMinor != null ? "Sold" : "Closed",
      chip: "bg-muted text-muted-foreground",
      dot: "bg-muted-foreground/50",
    };
  }
  if (now < start) return { label: "Opens soon", chip: "bg-accent text-accent-foreground", dot: "bg-accent-foreground/60" };
  if (end - now < SOON_MS) {
    return { label: "Closing soon", chip: "bg-primary text-primary-foreground", dot: "bg-primary animate-pulse" };
  }
  return { label: "Bidding open", chip: "bg-[hsl(var(--live))] text-[hsl(var(--live-foreground))]", dot: "bg-[hsl(var(--live))]" };
}

function LotCard({ lot, now, layout, showImage }: { lot: WireLot; now: number; layout: "card" | "row" | "compact"; showImage: boolean }) {
  const end = Date.parse(lot.endAt);
  const start = Date.parse(lot.startAt);
  const closed = lot.phase === "closed" || now >= end;
  const look = lookOf(lot, now);
  const flash = useFlash(lot.bidCount);
  const left = now < start ? start - now : end - now;
  const price =
    closed && lot.soldMinor != null
      ? { label: "Hammer", value: money(lot.soldMinor, lot.currency) }
      : lot.currentBidMinor != null
        ? { label: "Current bid", value: money(lot.currentBidMinor, lot.currency) }
        : { label: "Opening bid", value: money(lot.startingBidMinor, lot.currency) };
  const flashRing = flash ? "ring-2 ring-[hsl(var(--live))]" : "";

  if (layout !== "card") {
    const compact = layout === "compact";
    return (
      <Link
        href={lot.href}
        className={`m-0 flex items-center gap-3 rounded-md border border-border bg-card p-2.5 text-card-foreground no-underline transition hover:border-primary/50 ${flashRing}`}
      >
        {showImage && !compact ? (
          lot.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={lot.image} alt={lot.imageAlt ?? ""} className="m-0 size-14 shrink-0 rounded object-cover" loading="lazy" />
          ) : (
            <span aria-hidden className="size-14 shrink-0 rounded bg-muted" />
          )
        ) : (
          <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${look.dot}`} />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-serif text-base leading-tight">{lot.title}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {lot.artist ? `${lot.artist} · ` : ""}
            {price.label} {price.value}
            {lot.bidCount ? ` · ${lot.bidCount} bid${lot.bidCount === 1 ? "" : "s"}` : ""}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className={`block text-xs font-medium tabular-nums ${closed ? "text-muted-foreground" : "text-foreground"}`}>
            {closed ? look.label : formatLeft(left)}
          </span>
          <span className="block text-[0.65rem] uppercase tracking-wider text-muted-foreground">{closed ? "" : now < start ? "to open" : "left"}</span>
        </span>
      </Link>
    );
  }

  return (
    <Link
      href={lot.href}
      className={`group m-0 flex flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground no-underline shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${flashRing}`}
    >
      <span className="relative block aspect-[4/5] overflow-hidden bg-muted">
        {showImage && lot.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={lot.image} alt={lot.imageAlt ?? ""} className="m-0 size-full object-cover transition duration-500 group-hover:scale-[1.03]" loading="lazy" />
        ) : null}
        <span className={`absolute left-2.5 top-2.5 rounded-full px-2.5 py-1 text-[0.7rem] font-medium uppercase tracking-wider ${look.chip}`}>
          {look.label}
        </span>
        {!closed ? (
          <span className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2.5 pt-8 text-right font-serif text-lg tabular-nums text-white">
            {formatLeft(left)}
          </span>
        ) : null}
      </span>
      <span className="flex flex-1 flex-col gap-1 p-4">
        {lot.artist ? <span className="text-xs uppercase tracking-wider text-muted-foreground">{lot.artist}</span> : null}
        <span className="font-serif text-lg leading-snug">{lot.title}</span>
        <span className="mt-auto flex items-baseline justify-between gap-2 pt-2">
          <span>
            <span className="block text-[0.65rem] uppercase tracking-wider text-muted-foreground">{price.label}</span>
            <span className="font-serif text-xl tabular-nums">{price.value}</span>
          </span>
          <span className="text-xs text-muted-foreground">
            {lot.bidCount} bid{lot.bidCount === 1 ? "" : "s"}
          </span>
        </span>
      </span>
    </Link>
  );
}

function Heading({ text, sub }: { text?: string; sub?: string }) {
  if (!text && !sub) return null;
  return (
    <div className="mb-5">
      {text ? <h2 className="m-0 font-serif text-2xl">{text}</h2> : null}
      {sub ? <p className="m-0 mt-1 text-sm text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

const Empty = ({ text }: { text: string }) => (
  <p className="m-0 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{text}</p>
);

// ── lots ────────────────────────────────────────────────────────────────────

export function LotsView({
  lots,
  now,
  event,
  scope = "open",
  limit = 8,
  layout = "grid",
  columns = "4",
  showImages = true,
  refresh = 8,
  heading = "",
  intro = "",
  emptyMessage = "Nothing is open for bidding right now.",
}: {
  lots?: WireLot[];
  now?: string;
  event?: string;
  scope?: string;
  limit?: number;
  layout?: string;
  columns?: string;
  showImages?: boolean;
  refresh?: number;
  heading?: string;
  intro?: string;
  emptyMessage?: string;
}) {
  const { data, skew } = useLive({ lots, now }, qs("lots", { event, scope, limit }), refresh);
  const t = useNow(skew);
  const list = data.lots ?? [];
  const cols = columns === "2" ? "sm:grid-cols-2" : columns === "3" ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4";
  return (
    <section>
      <Heading text={heading} sub={intro} />
      {list.length === 0 ? (
        <Empty text={emptyMessage} />
      ) : layout === "grid" ? (
        <div className={`grid gap-5 ${cols}`}>
          {list.map((l) => (
            <LotCard key={l.id} lot={l} now={t} layout="card" showImage={showImages} />
          ))}
        </div>
      ) : (
        <div className="grid gap-2.5">
          {list.map((l) => (
            <LotCard key={l.id} lot={l} now={t} layout={layout === "compact" ? "compact" : "row"} showImage={showImages} />
          ))}
        </div>
      )}
    </section>
  );
}

// ── closing timeline ────────────────────────────────────────────────────────

const when = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const whenDay = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, weekday: "long", month: "long", day: "numeric" });
const hourKey = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" });
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });

export function TimelineView({
  lots,
  now,
  event,
  scope = "open",
  group = "hour",
  limit = 24,
  showImages = true,
  refresh = 8,
  heading = "Closing order",
  intro = "",
  emptyMessage = "No lots are scheduled yet.",
}: {
  lots?: WireLot[];
  now?: string;
  event?: string;
  scope?: string;
  group?: string;
  limit?: number;
  showImages?: boolean;
  refresh?: number;
  heading?: string;
  intro?: string;
  emptyMessage?: string;
}) {
  const { data, skew } = useLive({ lots, now }, qs("lots", { event, scope, limit }), refresh);
  const t = useNow(skew);
  const list = data.lots ?? [];

  const groups: Array<{ key: string; at: number; lots: WireLot[] }> = [];
  for (const lot of list) {
    const at = Date.parse(lot.endAt);
    const key = group === "day" ? dayKey.format(at) : group === "none" ? lot.id : hourKey.format(at);
    const hit = groups.find((g) => g.key === key);
    if (hit) hit.lots.push(lot);
    else groups.push({ key, at, lots: [lot] });
  }

  return (
    <section>
      <Heading text={heading} sub={intro} />
      {groups.length === 0 ? (
        <Empty text={emptyMessage} />
      ) : (
        <ol className="m-0 list-none border-s-2 border-border p-0 ps-0">
          {groups.map((g) => {
            const closed = g.lots.every((l) => l.phase === "closed" || Date.parse(l.endAt) <= t);
            const soon = !closed && g.at - t < SOON_MS;
            return (
              <li key={g.key} className="relative m-0 pb-8 ps-7 last:pb-0">
                <span
                  aria-hidden
                  className={`absolute -start-[0.45rem] top-1 size-3 rounded-full ring-4 ring-background ${
                    closed ? "bg-muted-foreground/40" : soon ? "animate-pulse bg-primary" : "bg-[hsl(var(--live))]"
                  }`}
                />
                <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  <h3 className="m-0 font-serif text-lg">
                    {group === "day" ? whenDay.format(g.at) : when.format(g.at)}
                  </h3>
                  <span className={`text-xs tabular-nums ${closed ? "text-muted-foreground" : soon ? "font-medium text-primary" : "text-muted-foreground"}`}>
                    {closed ? "Closed" : `closes in ${formatLeft(g.at - t)}`}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {g.lots.length} lot{g.lots.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="grid gap-2">
                  {g.lots.map((l) => (
                    <LotCard key={l.id} lot={l} now={t} layout="row" showImage={showImages} />
                  ))}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

// ── bid ticker ──────────────────────────────────────────────────────────────

function BidLine({ bid, now, fresh }: { bid: WireBid; now: number; fresh: boolean }) {
  return (
    <li
      className={`m-0 flex items-baseline gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-700 ${
        fresh ? "bg-[hsl(var(--live))]/15" : ""
      }`}
    >
      <span aria-hidden className={`size-2 shrink-0 translate-y-[-1px] rounded-full ${fresh ? "bg-[hsl(var(--live))]" : "bg-muted-foreground/40"}`} />
      <span className="min-w-0 flex-1">
        <span className="font-medium">{bid.paddle}</span> bid{" "}
        <span className="font-serif tabular-nums">{money(bid.amountMinor, bid.currency)}</span> on{" "}
        <Link href={bid.lotHref} className="underline-offset-2 hover:underline">
          {bid.lotTitle}
        </Link>
      </span>
      <time className="shrink-0 text-xs text-muted-foreground" dateTime={bid.at}>
        {ago(now - Date.parse(bid.at))}
      </time>
    </li>
  );
}

export function TickerView({
  bids,
  now,
  event,
  limit = 8,
  refresh = 6,
  heading = "Live bids",
  emptyMessage = "No bids yet. The first one sets the pace.",
}: {
  bids?: WireBid[];
  now?: string;
  event?: string;
  limit?: number;
  refresh?: number;
  heading?: string;
  emptyMessage?: string;
}) {
  const { data, skew } = useLive({ bids, now }, qs("bids", { event, bidsLimit: limit }), refresh);
  const t = useNow(skew);
  const list = React.useMemo(() => data.bids ?? [], [data.bids]);
  const seen = React.useRef<Set<string> | null>(null);
  const [fresh, setFresh] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    const ids = new Set(list.map((b) => b.id));
    if (seen.current) {
      const added = list.filter((b) => !seen.current!.has(b.id)).map((b) => b.id);
      if (added.length) {
        setFresh(new Set(added));
        const id = window.setTimeout(() => setFresh(new Set()), 3500);
        seen.current = ids;
        return () => window.clearTimeout(id);
      }
    }
    seen.current = ids;
  }, [list]);

  return (
    <section>
      {heading ? (
        <h2 className="m-0 mb-3 flex items-center gap-2 font-serif text-2xl">
          <span aria-hidden className="inline-block size-2.5 animate-pulse rounded-full bg-[hsl(var(--live))]" />
          {heading}
        </h2>
      ) : null}
      {list.length === 0 ? (
        <Empty text={emptyMessage} />
      ) : (
        <ul className="m-0 list-none rounded-lg border border-border bg-card p-1.5">
          {list.map((b) => (
            <BidLine key={b.id} bid={b} now={t} fresh={fresh.has(b.id)} />
          ))}
        </ul>
      )}
    </section>
  );
}

// ── stats ───────────────────────────────────────────────────────────────────

export function StatsView({
  stats,
  now,
  event,
  refresh = 10,
  showLots = true,
  showBids = true,
  showBidders = true,
  showHigh = true,
}: {
  stats?: WireStats;
  now?: string;
  event?: string;
  refresh?: number;
  showLots?: boolean;
  showBids?: boolean;
  showBidders?: boolean;
  showHigh?: boolean;
}) {
  const { data } = useLive({ stats, now }, qs("stats", { event }), refresh);
  const s = data.stats;
  const tiles: Array<[string, string]> = [];
  if (showLots) tiles.push(["Lots open", String(s?.lotsOpen ?? 0)]);
  if (showBids) tiles.push(["Bids placed", String(s?.bids ?? 0)]);
  if (showBidders) tiles.push(["Bidders", String(s?.bidders ?? 0)]);
  if (showHigh) tiles.push(["Highest bid", s?.highBidMinor != null ? money(s.highBidMinor, s.currency) : "—"]);
  if (tiles.length === 0) return null;
  return (
    <dl className="m-0 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
      {tiles.map(([label, value]) => (
        <div key={label} className="bg-card px-5 py-4 text-center">
          <dd className="m-0 font-serif text-3xl tabular-nums">{value}</dd>
          <dt className="mt-1 text-[0.7rem] uppercase tracking-widest text-muted-foreground">{label}</dt>
        </div>
      ))}
    </dl>
  );
}

// ── countdown ───────────────────────────────────────────────────────────────

export function CountdownView({
  stats,
  now,
  event,
  source = "fixed",
  until = "",
  label = "The auction closes in",
  endedText = "The auction has closed",
  refresh = 12,
}: {
  stats?: WireStats;
  now?: string;
  event?: string;
  source?: string;
  until?: string;
  label?: string;
  endedText?: string;
  refresh?: number;
}) {
  const { data, skew } = useLive({ stats, now }, source === "fixed" ? "" : qs("stats", { event }), refresh);
  const t = useNow(skew);
  const target =
    source === "next-close"
      ? data.stats?.nextEndAt ? Date.parse(data.stats.nextEndAt) : null
      : source === "last-close"
        ? data.stats?.lastEndAt ? Date.parse(data.stats.lastEndAt) : null
        : torontoToMs(until);
  const diff = target == null ? null : Math.max(0, target - t);
  const parts = diff == null ? null : [
    ["Days", Math.floor(diff / 86400000)],
    ["Hours", Math.floor((diff % 86400000) / 3600000)],
    ["Minutes", Math.floor((diff % 3600000) / 60000)],
    ["Seconds", Math.floor((diff % 60000) / 1000)],
  ] as const;

  return (
    <div className="m-0 rounded-lg border border-border bg-card p-6 text-center text-card-foreground">
      {diff === 0 ? (
        <p className="m-0 font-serif text-2xl">{endedText}</p>
      ) : (
        <>
          <p className="m-0 text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
          {parts ? (
            <div className="mt-3 flex justify-center gap-3 sm:gap-6" role="timer" aria-live="off">
              {parts.map(([name, value]) => (
                <div key={name} className="min-w-[3.5rem]">
                  <div className="font-serif text-4xl tabular-nums sm:text-5xl">{String(value).padStart(2, "0")}</div>
                  <div className="mt-1 text-[0.65rem] uppercase tracking-widest text-muted-foreground">{name}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="m-0 mt-3 text-sm text-muted-foreground">
              {source === "fixed" ? "Set the closing date and time in the block's settings." : "Nothing is open for bidding."}
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ── hero ────────────────────────────────────────────────────────────────────

export function HeroView({
  lots,
  now,
  event,
  pick = "soonest",
  refresh = 6,
  kicker = "On the block",
  emptyMessage = "The next lots will appear here once bidding opens.",
}: {
  lots?: WireLot[];
  now?: string;
  event?: string;
  pick?: string;
  refresh?: number;
  kicker?: string;
  emptyMessage?: string;
}) {
  const { data, skew } = useLive({ lots, now }, qs("lots", { event, scope: "open", limit: 12 }), refresh);
  const t = useNow(skew);
  const list = data.lots ?? [];
  const lot =
    pick === "most-bid"
      ? [...list].sort((a, b) => b.bidCount - a.bidCount)[0]
      : pick === "highest"
        ? [...list].sort((a, b) => (b.currentBidMinor ?? 0) - (a.currentBidMinor ?? 0))[0]
        : list[0];
  const flash = useFlash(lot?.bidCount);
  if (!lot) return <Empty text={emptyMessage} />;

  const end = Date.parse(lot.endAt);
  const start = Date.parse(lot.startAt);
  const look = lookOf(lot, t);
  const left = t < start ? start - t : end - t;
  const hasBid = lot.currentBidMinor != null;
  return (
    <article className="m-0 grid overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm md:grid-cols-2">
      <Link href={lot.href} className="relative block min-h-[18rem] bg-muted md:min-h-[26rem]">
        {lot.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={lot.image} alt={lot.imageAlt ?? ""} className="absolute inset-0 m-0 size-full object-cover" />
        ) : null}
        <span className={`absolute left-4 top-4 rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wider ${look.chip}`}>{look.label}</span>
      </Link>
      <div className="flex flex-col justify-center gap-4 p-7 sm:p-10">
        <p className="m-0 text-xs uppercase tracking-[0.2em] text-primary">{kicker}</p>
        <div>
          {lot.artist ? <p className="m-0 text-sm text-muted-foreground">{lot.artist}</p> : null}
          <h2 className="m-0 mt-1 font-serif text-3xl leading-tight sm:text-4xl">{lot.title}</h2>
        </div>
        <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
          <div>
            <p className="m-0 text-[0.7rem] uppercase tracking-widest text-muted-foreground">{hasBid ? "Current bid" : "Opening bid"}</p>
            <p className={`m-0 font-serif text-4xl tabular-nums transition-colors ${flash ? "text-[hsl(var(--live))]" : ""}`}>
              {money(hasBid ? lot.currentBidMinor : lot.startingBidMinor, lot.currency)}
            </p>
            <p className="m-0 text-xs text-muted-foreground">
              {lot.bidCount} bid{lot.bidCount === 1 ? "" : "s"}
            </p>
          </div>
          <div>
            <p className="m-0 text-[0.7rem] uppercase tracking-widest text-muted-foreground">{t < start ? "Opens in" : "Closes in"}</p>
            <p className={`m-0 font-serif text-4xl tabular-nums ${end - t < SOON_MS && t >= start ? "text-primary" : ""}`}>{formatLeft(left)}</p>
          </div>
        </div>
        <div>
          <Link
            href={lot.href}
            className="inline-block rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground no-underline transition hover:opacity-90"
          >
            {t < start ? "View the lot" : "Place a bid"}
          </Link>
        </div>
      </div>
    </article>
  );
}
