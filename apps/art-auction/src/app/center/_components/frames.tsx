"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Toaster, toast } from "sonner";
import {
  SurfaceFrame,
  SurfaceSkeleton,
  useSurface,
  type SurfaceAction,
  type SurfaceDescriptor,
} from "@elkdonis/cms-ui/surface";
import { siteConfig } from "@/config/site";
import { ArtistProfileForm } from "@/app/studio/_components/artist-profile-form";
import { ArtworkForm } from "@/app/studio/_components/artwork-form";
import {
  archiveArtworkAction,
  cancelOrderAction,
  confirmOrderPaidAction,
  fulfilOrderAction,
  publishArtworkAction,
  refundOrderAction,
} from "@/app/studio/actions";
import { OrderActions } from "@/app/studio/_components/order-actions";
import { LotActions } from "@/app/studio/_components/lot-actions";
import { PopupRefresh } from "@/lib/popup-refresh";
import { ParcelForm, ShipFromForm, ShipmentCell, type ShipFromValue } from "@/app/studio/_components/shipping-forms";
import {
  enterSeriesAction,
  loadArtworkFrame,
  loadAuctionsFrame,
  loadEntryFrame,
  loadSalesFrame,
  loadMoneyFrame,
  loadPieceFrame,
  loadPresenceFrame,
  loadInstallationsFrame,
  loadInstallationFrame,
  createInstallationFrame,
  loadStoreFrame,
  saveStoreProfileAction,
  loadArtistFrame,
} from "../frames";
import { RichTextEditor } from "@elkdonis/cms-ui/editor";
import { artistEditFrame, artworkFrame, entryFrame, installationFrame, pieceFrame, storeFrame, type StoreTab } from "./descriptors";

/** The hallway editor (three.js) loads only when an installation popup opens. */
const InstallationEditor = dynamic(
  () => import("@/app/studio/installations/[id]/installation-editor").then((m) => m.InstallationEditor),
  { ssr: false, loading: () => <SurfaceSkeleton block /> },
);

/**
 * The /center popups (slice 4 phase 2). Each one loads through a server action in ../frames.ts and saves through
 * /studio's own actions (the forms are /studio's). The surface is a modal <dialog> in the top layer, so the
 * page's toaster would sit behind it: each popup carries its own.
 */

type Custom = Extract<SurfaceDescriptor, { type: "custom" }>;
type Props = { descriptor: Custom };

const AC = siteConfig.network.artsCollectiveUrl;
const k = "text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--sf-muted)]";
const btn =
  "inline-flex min-h-10 items-center justify-center rounded-md border border-[color:var(--sf-line)] px-3.5 text-sm font-medium hover:border-[color:var(--sf-fg)]";

function useLoad<T>(load: () => Promise<T>, deps: React.DependencyList): T | null | { ok: false; error: string } {
  const [data, setData] = React.useState<T | null | { ok: false; error: string }>(null);
  React.useEffect(() => {
    let live = true;
    setData(null);
    load()
      .then((d) => live && setData(d))
      .catch(() => live && setData({ ok: false, error: "This could not be loaded. Try again." }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return data;
}

function Loading({ kind, title }: { kind: string; title: string }) {
  return (
    <SurfaceFrame kind={kind} title={title}>
      <SurfaceSkeleton block />
    </SurfaceFrame>
  );
}

function Failed({ kind, title, error }: { kind: string; title: string; error: string }) {
  return (
    <SurfaceFrame kind={kind} title={title}>
      <p className="text-sm">{error}</p>
    </SurfaceFrame>
  );
}

function Tabs<T extends string>({ label, tabs, current, onSelect }: { label: string; tabs: Array<{ key: T; label: string }>; current: T; onSelect: (t: T) => void }) {
  return (
    <div role="tablist" aria-label={label} className="mb-4 flex gap-2 overflow-x-auto border-b border-[color:var(--sf-line)] pb-2">
      {tabs.map((t) => {
        const on = t.key === current;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onSelect(t.key)}
            className={`min-h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium ${
              on
                ? "border-[color:var(--sf-fg)] bg-[color:var(--sf-fg)] text-[color:var(--sf-bg)]"
                : "border-[color:var(--sf-line)] text-[color:var(--sf-muted)] hover:border-[color:var(--sf-fg)]"
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

const actions = (list: Array<SurfaceAction | null | false | undefined>): SurfaceAction[] => list.filter(Boolean) as SurfaceAction[];

// ── Store ───────────────────────────────────────────────────────────────────

const SHIPPING_MODE: Record<string, string> = {
  arranged: "This store arranges shipping with each buyer.",
  platform: "Buyers pick a courier at checkout and the collective buys the label; you print it from Sales.",
  quote: "Buyers pick a courier at checkout and pay for it; you buy your own label and add tracking in Sales.",
};

export function StoreFrame({ descriptor }: Props) {
  const [tab, setTab] = React.useState<StoreTab>((descriptor.props?.tab as StoreTab) ?? "front");
  const data = useLoad(() => loadStoreFrame(), []);
  if (!data) return <Loading kind="product" title="Your store" />;
  if (data.ok === false) return <Failed kind="product" title="Your store" error={data.error} />;
  return (
    <SurfaceFrame
      kind="product"
      kicker="Store"
      title={data.name}
      rail={
        <div className="flex flex-col gap-3 text-sm">
          <span className={k}>Store front</span>
          {data.slug && (
            <a href={`/artists/${data.slug}`} className="underline underline-offset-4">Preview the store ↗</a>
          )}
          <span className={k}>Elsewhere</span>
          <a href="/studio/payouts" className="underline underline-offset-4">Payouts and team</a>
        </div>
      }
      actions={actions([{ label: "Open as page", href: "/studio/profile", quiet: true }])}
    >
      <Tabs<StoreTab>
        label="Store"
        tabs={[{ key: "front", label: "Store front" }, { key: "look", label: "Look" }, { key: "profile", label: "Where you show" }, { key: "shipping", label: "Shipping" }]}
        current={tab}
        onSelect={setTab}
      />
      {tab === "front" && <StoreProfileTab data={data} />}
      {tab === "look" && <StoreLookTab data={data} />}
      {tab === "profile" && <PresenceTab />}
      {tab === "shipping" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-[color:var(--sf-muted)]">
            {SHIPPING_MODE[data.shippingMode] ?? ""} Couriers quote from your ship-from address, for every store that sells your work.
          </p>
          <ShipFromForm initial={(data.shipFrom as ShipFromValue | null) ?? null} defaults={data.shipFromDefaults ?? undefined} />
        </div>
      )}
      <Toaster richColors position="top-right" />
    </SurfaceFrame>
  );
}

// ── Artwork: add, or edit ───────────────────────────────────────────────────

export function ArtworkFrame({ descriptor }: Props) {
  const surface = useSurface();
  const id = (descriptor.props?.id as string | undefined) ?? null;
  const data = useLoad(() => loadArtworkFrame(id), [id]);
  const title = id ? "Edit artwork" : "Add a work";
  if (!data) return <Loading kind="gallery" title={title} />;
  if (data.ok === false) return <Failed kind="gallery" title={title} error={data.error} />;
  return (
    <SurfaceFrame
      kind="gallery"
      kicker={`Artwork · ${data.storeName}`}
      title={data.initial?.title ?? title}
      actions={actions([
        { label: "Open as page", href: id ? `/studio/artworks/${id}/edit` : "/studio/artworks/new", quiet: true },
        id ? { label: "View it ↗", href: `/artworks/${id}`, quiet: true } : null,
      ])}
    >
      <ArtworkForm
        key={id ?? "new"}
        allowMakerChoice={data.allowMakerChoice}
        beneficiaries={data.beneficiaries}
        orgOptions={data.orgOptions}
        initial={data.initial ?? undefined}
        onCreated={(newId) => surface.replace(artworkFrame(newId))}
        onSaved={
          id
            ? () => {
                // Back to the piece with fresh data: pop when the piece is underneath, else show it in this layer.
                window.dispatchEvent(new Event("market:artwork-saved"));
                surface.connectors.onMutated?.();
                const below = surface.stack[surface.stack.length - 2]?.descriptor;
                if (below && below.type === "custom" && below.key === "market-piece" && below.props?.id === id) surface.pop();
                else surface.replace(pieceFrame(id));
              }
            : undefined
        }
        sources={data.sources}
      />
      {id && (
        <section className="mt-10 border-t border-[color:var(--sf-line)] pt-6">
          <h3 className="font-serif text-xl">Shipping</h3>
          <p className="mb-3 mt-1 text-sm text-[color:var(--sf-muted)]">The piece as packed for the courier; buyers get live courier prices from it.</p>
          <ParcelForm artworkId={id} initial={data.parcel} />
        </section>
      )}
      <Toaster richColors position="top-right" />
    </SurfaceFrame>
  );
}

// ── One piece ───────────────────────────────────────────────────────────────

const PIECE_STATUS: Record<string, string> = {
  draft: "Draft", available: "For sale", reserved: "Reserved", sold: "Sold", archived: "Taken down",
};

export function PieceFrame({ descriptor }: Props) {
  const surface = useSurface();
  const id = String(descriptor.props?.id ?? "");
  const [tick, setTick] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const data = useLoad(() => loadPieceFrame(id), [id, tick]);
  React.useEffect(() => {
    const on = () => setTick((t) => t + 1);
    window.addEventListener("market:artwork-saved", on);
    return () => window.removeEventListener("market:artwork-saved", on);
  }, []);
  if (!data) return <Loading kind="gallery" title={descriptor.title ?? "Piece"} />;
  if (data.ok === false) return <Failed kind="gallery" title="Piece" error={data.error} />;
  const back = encodeURIComponent(typeof window !== "undefined" ? window.location.href : "");
  const canEnter = data.status === "available" && !data.lot;
  /** Publish / re-list / unlist through /studio's own actions, then reload this frame and the page behind it. */
  const run = async (action: (artworkId: string) => Promise<{ ok: boolean; error?: string }>, done: string) => {
    setBusy(true);
    const r = await action(id).catch(() => ({ ok: false, error: "That did not work. Try again." }));
    setBusy(false);
    if (!r.ok) return void toast.error(r.error ?? "That did not work.");
    toast.success(done);
    surface.connectors.onMutated?.();
    setTick((t) => t + 1);
  };
  const listing: SurfaceAction | null = data.lot
    ? null
    : data.status === "draft" || data.status === "archived"
      ? { label: busy ? "…" : data.status === "archived" ? "Re-list" : "Publish", primary: true, disabled: busy, onClick: () => run(publishArtworkAction, "Published to the storefront.") }
      : data.status === "available"
        ? { label: busy ? "…" : "Unlist", quiet: true, disabled: busy, onClick: () => run(archiveArtworkAction, "Unlisted from the storefront.") }
        : null;
  return (
    <SurfaceFrame
      kind="gallery"
      kicker={data.lot ? "Piece · in auction" : `Piece · ${PIECE_STATUS[data.status] ?? data.status}`}
      title={data.title}
      rail={
        <div className="flex flex-col gap-2.5 text-sm">
          <span className={k}>Next for this piece</span>
          <button type="button" className={btn} onClick={() => surface.push(artworkFrame(id))}>Edit the listing</button>
          {canEnter && (
            <button type="button" className={btn} onClick={() => surface.push(entryFrame(id))}>Enter in a series</button>
          )}
          <a className={btn} href={`${AC}/studio?kind=post&back=${back}&backLabel=Center`}>Write about it ↗</a>
          <a className={btn} href={`${AC}/channel/new`}>Make into a post ↗</a>
          <span className={`${k} mt-2`}>Where it is</span>
          <a href={data.publicHref} className="underline underline-offset-4">Its page on the market ↗</a>
        </div>
      }
      actions={actions([{ label: "Open as page", href: `/studio/artworks/${id}/edit`, quiet: true }, listing])}
    >
      <div className="flex flex-wrap gap-5">
        <div className="aspect-[4/3] min-w-0 flex-[1_1_260px] overflow-hidden rounded-md bg-[color:var(--sf-bg-soft)]">
          {data.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.imageUrl} alt={data.title} className="h-full w-full object-cover" />
          )}
        </div>
        <dl className="flex min-w-0 flex-[1_1_180px] flex-col gap-3 text-sm">
          <div><dt className={k}>Price</dt><dd>{data.price}</dd></div>
          {(data.medium || data.size) && <div><dt className={k}>Piece</dt><dd>{[data.medium, data.size].filter(Boolean).join(" · ")}</dd></div>}
          <div><dt className={k}>Views</dt><dd>{data.views}</dd></div>
          {data.lot && (
            <div>
              <dt className={k}>Auction</dt>
              <dd>
                {data.lot.status === "live" ? "Bidding open" : "Scheduled"}
                {data.lot.currentBid ? ` · top bid ${data.lot.currentBid}` : ""}
                {" · "}
                <a href={`/lots/${data.lot.id}`} className="underline underline-offset-4">the lot ↗</a>
              </dd>
            </div>
          )}
        </dl>
      </div>
      <Toaster richColors position="top-right" />
    </SurfaceFrame>
  );
}

// ── Series entry ────────────────────────────────────────────────────────────

const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: "America/Toronto" }) : "";

export function EntryFrame({ descriptor }: Props) {
  const fixed = (descriptor.props?.artworkId as string | undefined) ?? null;
  const data = useLoad(() => loadEntryFrame(), []);
  const [seriesId, setSeriesId] = React.useState<string | null>(null);
  const [artworkId, setArtworkId] = React.useState<string | null>(fixed);
  const [start, setStart] = React.useState("");
  const [reserve, setReserve] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState<{ lotNumber: number; seriesSlug: string | null } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (data && data.ok) {
      setSeriesId((s) => s ?? data.series[0]?.id ?? null);
      setArtworkId((a) => a ?? data.pieces[0]?.id ?? null);
    }
  }, [data]);

  if (!data) return <Loading kind="series" title="Enter a series" />;
  if (data.ok === false) return <Failed kind="series" title="Enter a series" error={data.error} />;

  const piece = data.pieces.find((p) => p.id === artworkId) ?? null;
  async function submit() {
    if (!seriesId || !artworkId) return;
    setBusy(true);
    setError(null);
    const r = await enterSeriesAction({ seriesId, artworkId, startingBid: Number(start), reserve: reserve.trim() ? Number(reserve) : null }).catch(
      () => ({ ok: false as const, error: "The piece could not be entered." }),
    );
    setBusy(false);
    if (r.ok === false) {
      setError(r.error);
      return;
    }
    setDone({ lotNumber: r.lotNumber, seriesSlug: r.seriesSlug });
    toast.success(`Entered as lot ${r.lotNumber}.`);
  }

  if (done) {
    return (
      <SurfaceFrame
        kind="series"
        kicker="Series entry"
        title={`Entered as lot ${done.lotNumber}`}
        actions={actions([done.seriesSlug ? { label: "See the series ↗", href: `/series/${done.seriesSlug}`, primary: true } : null])}
      >
        <p className="text-sm">The piece is in the series now, on its clock. The series desk can take an entry out; you can withdraw it while it has no bids.</p>
        <Toaster richColors position="top-right" />
      </SurfaceFrame>
    );
  }

  const none = data.series.length === 0 ? "No auction series is taking entries from you right now." : data.pieces.length === 0 ? "Only a published piece that is not already in an auction can be entered." : null;
  return (
    <SurfaceFrame
      kind="series"
      kicker="Series entry"
      title="Enter a series"
      status={error ?? undefined}
      statusTone={error ? "error" : "normal"}
      actions={actions([
        !none && { label: busy ? "Entering…" : "Enter it", primary: true, disabled: busy || !seriesId || !artworkId || !(Number(start) >= 1), onClick: submit },
      ])}
    >
      {none ? (
        <p className="text-sm">{none}</p>
      ) : (
        <div className="flex flex-col gap-5">
          <fieldset className="flex flex-col gap-1">
            <legend className={`${k} mb-1`}>Series</legend>
            {data.series.map((s) => (
              <label key={s.id} className="flex min-h-11 items-center gap-3 border-t border-[color:var(--sf-line)] py-2 first-of-type:border-t-0">
                <input type="radio" name="series" checked={seriesId === s.id} onChange={() => setSeriesId(s.id)} />
                <span className="flex flex-col">
                  <b className="font-medium">{s.title}</b>
                  <span className="text-xs text-[color:var(--sf-muted)]">
                    {s.silentOpensAt ? `silent from ${day(s.silentOpensAt)} · ` : ""}live close {day(s.liveAt)}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
          {fixed && piece ? (
            <p className="text-sm"><span className={k}>Piece</span><br />{piece.title}</p>
          ) : (
            <fieldset className="flex flex-col gap-2">
              <legend className={`${k} mb-1`}>Piece</legend>
              <div className="grid grid-cols-3 gap-2">
                {data.pieces.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={artworkId === p.id}
                    onClick={() => setArtworkId(p.id)}
                    className={`flex flex-col gap-1 rounded-md border p-1.5 text-left text-xs ${artworkId === p.id ? "border-[color:var(--sf-fg)] ring-1 ring-[color:var(--sf-fg)]" : "border-[color:var(--sf-line)]"}`}
                  >
                    <span className="aspect-[4/3] overflow-hidden rounded bg-[color:var(--sf-bg-soft)]">
                      {p.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                      )}
                    </span>
                    <span className="truncate font-medium">{p.title}</span>
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Starting bid, CA$</span>
              <input inputMode="decimal" value={start} onChange={(e) => setStart(e.target.value)} className="min-h-10 rounded-md border border-[color:var(--sf-line)] bg-transparent px-2.5" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Reserve, CA$ (optional)</span>
              <input inputMode="decimal" value={reserve} onChange={(e) => setReserve(e.target.value)} className="min-h-10 rounded-md border border-[color:var(--sf-line)] bg-transparent px-2.5" />
            </label>
          </div>
          <p className="text-xs text-[color:var(--sf-muted)]">An entry is in the series at once. The desk can take it out; you can withdraw it while it has no bids.</p>
        </div>
      )}
      <Toaster richColors position="top-right" />
    </SurfaceFrame>
  );
}

// ── Money ───────────────────────────────────────────────────────────────────

export function MoneyFrame() {
  const data = useLoad(() => loadMoneyFrame(), []);
  if (!data) return <Loading kind="service" title="Money" />;
  if (data.ok === false) return <Failed kind="service" title="Money" error={data.error} />;
  return (
    <SurfaceFrame
      kind="service"
      kicker="Money"
      title={data.isOwn ? (data.stripeReady ? "Stripe connected" : "Payouts not set up") : "The store’s money"}
      actions={actions([{ label: data.isOwn ? "Payouts" : "Money and team", href: "/studio/payouts", primary: !data.stripeReady && data.isOwn }])}
    >
      <div className="grid grid-cols-3 gap-3">
        <div><span className={k}>Ready to pay out</span><p className="text-xl font-semibold tabular-nums">{data.payable}</p></div>
        <div><span className={k}>Held</span><p className="text-xl font-semibold tabular-nums">{data.held}</p></div>
        <div><span className={k}>All earned</span><p className="text-xl font-semibold tabular-nums">{data.total}</p></div>
      </div>
      {data.lines.length > 0 && (
        <ul className="mt-5 flex flex-col">
          {data.lines.map((l) => (
            <li key={l.id} className="flex items-center gap-3 border-t border-[color:var(--sf-line)] py-2 text-sm">
              <span className="w-16 shrink-0 text-xs text-[color:var(--sf-muted)]">{day(l.when)}</span>
              <span className="min-w-0 flex-1 truncate">{l.what}{l.held ? " · held" : ""}</span>
              <span className="tabular-nums">{l.amount}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs text-[color:var(--sf-muted)]">Card payments reach you through Stripe, into your own bank account. The collective keeps 5% of each sale.</p>
    </SurfaceFrame>
  );
}

// ── Sales: the store's orders ───────────────────────────────────────────────

const ORDER_WORD: Record<string, string> = {
  draft: "Draft", pending_payment: "Card, not paid yet", awaiting_etransfer: "Awaiting eTransfer",
  payment_received: "Payment received", paid: "Paid, ship it", fulfilled: "Shipped", completed: "Completed",
  cancelled: "Cancelled", refunded: "Refunded",
};
const ORDER_ACTIONS = { confirm: confirmOrderPaidAction, cancel: cancelOrderAction, fulfil: fulfilOrderAction, refund: refundOrderAction };

export function SalesFrame() {
  const [tick, setTick] = React.useState(0);
  const reload = React.useCallback(() => setTick((t) => t + 1), []);
  const data = useLoad(() => loadSalesFrame(), [tick]);
  if (!data && tick === 0) return <Loading kind="product" title="Sales" />;
  if (data && data.ok === false) return <Failed kind="product" title="Sales" error={data.error} />;
  const d = data && data.ok ? data : null;
  const needs = d ? d.orders.filter((o) => ["awaiting_etransfer", "paid", "payment_received"].includes(o.order.status)).length : 0;
  return (
    <SurfaceFrame
      kind="product"
      kicker="Sales"
      title={d ? (needs ? `${needs} need${needs === 1 ? "s" : ""} you` : `${d.orders.length} orders`) : "Sales"}
      actions={actions([{ label: "Open as page", href: "/studio/sales", quiet: true }])}
    >
      <PopupRefresh.Provider value={reload}>
        {!d ? (
          <SurfaceSkeleton block />
        ) : d.orders.length === 0 ? (
          <p className="text-sm">No orders yet. When someone buys a piece, or wins one at auction, it shows here for you to confirm payment and ship.</p>
        ) : (
          <ul className="flex flex-col">
            {d.orders.map((o) => (
              <li key={o.order.id} className="flex flex-wrap items-start gap-3 border-t border-[color:var(--sf-line)] py-3 text-sm first:border-t-0">
                <span className="min-w-0 flex-1">
                  <a href={`/orders/${o.order.id}`} className="font-medium underline-offset-4 hover:underline">{o.order.number}</a>
                  <span className="block text-xs text-[color:var(--sf-muted)]">
                    {day(o.when)} · {o.who}{o.auction ? " · auction" : ""} · {ORDER_WORD[o.order.status] ?? o.order.status}
                  </span>
                </span>
                <span className="tabular-nums">{o.total}</span>
                {d.canManage && (
                  <span className="flex w-full flex-col items-end gap-2 sm:w-auto">
                    <OrderActions order={o.order as never} actions={ORDER_ACTIONS} />
                    {o.shipping && (
                      <ShipmentCell
                        orderId={o.order.id}
                        mode={o.shipping.mode}
                        serviceName={o.shipping.serviceName}
                        canShip={o.order.status === "paid"}
                        shipment={o.shipment as never}
                      />
                    )}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </PopupRefresh.Provider>
      <Toaster richColors position="top-right" />
    </SurfaceFrame>
  );
}

// ── Auctions: the store's lots ──────────────────────────────────────────────

const LOT_WORD: Record<string, string> = { scheduled: "Starts", live: "Bidding open", sold: "Sold", passed: "Passed", cancelled: "Withdrawn", ended: "Ended" };

export function AuctionsFrame() {
  const [tick, setTick] = React.useState(0);
  const reload = React.useCallback(() => setTick((t) => t + 1), []);
  const data = useLoad(() => loadAuctionsFrame(), [tick]);
  if (!data && tick === 0) return <Loading kind="series" title="Auctions" />;
  if (data && data.ok === false) return <Failed kind="series" title="Auctions" error={data.error} />;
  const d = data && data.ok ? data : null;
  const open = d ? d.lots.filter((l) => l.status === "live" || l.status === "scheduled").length : 0;
  return (
    <SurfaceFrame
      kind="series"
      kicker="Auctions"
      title={d ? `${open} open` : "Auctions"}
      actions={actions([{ label: "Open as page", href: "/studio/auctions", quiet: true }])}
    >
      <PopupRefresh.Provider value={reload}>
        {!d ? (
          <SurfaceSkeleton block />
        ) : d.lots.length === 0 ? (
          <p className="text-sm">No lots yet. Enter a piece in a series from Publish or from a piece.</p>
        ) : (
          <ul className="flex flex-col">
            {d.lots.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-3 border-t border-[color:var(--sf-line)] py-3 text-sm first:border-t-0">
                <span className="min-w-0 flex-1">
                  <a href={`/lots/${l.id}`} className="font-serif text-base underline-offset-4 hover:underline">{l.title}</a>
                  <span className="block text-xs text-[color:var(--sf-muted)]">
                    {LOT_WORD[l.status] ?? l.status}
                    {l.status === "scheduled" || l.status === "live" ? ` · ${l.status === "scheduled" ? "starts" : "ends"} ${day(l.at)}` : ""}
                    {" · "}{l.bids} {l.bids === 1 ? "bid" : "bids"}{l.reserve ? ` · reserve ${l.reserve}` : ""}
                  </span>
                </span>
                <span className="tabular-nums">{l.price}</span>
                {(l.status === "live" || l.status === "scheduled") && <LotActions lotId={l.id} bidCount={l.bids} />}
                {l.status === "sold" && l.orderId && <a href={`/orders/${l.orderId}`} className="text-xs underline underline-offset-4">Order</a>}
              </li>
            ))}
          </ul>
        )}
      </PopupRefresh.Provider>
      <Toaster richColors position="top-right" />
    </SurfaceFrame>
  );
}

// ── Market profile tab: where the person shows ──────────────────────────────

function PresenceTab() {
  const data = useLoad(() => loadPresenceFrame(), []);
  if (!data) return <SurfaceSkeleton block />;
  if (data.ok === false) return <p className="text-sm">{data.error}</p>;
  return (
    <div className="flex flex-col gap-6">
      <section>
        <p className={`${k} mb-2`}>Where you show</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {data.places.map((p) => (
            <a key={p.href + p.title} href={p.href} className="rounded-md border border-[color:var(--sf-line)] p-3 text-sm hover:border-[color:var(--sf-fg)]">
              <b className="font-medium">{p.title}</b>
              <span className="mt-0.5 block text-xs text-[color:var(--sf-muted)]">{p.note}</span>
            </a>
          ))}
        </div>
      </section>
      {data.cards.length > 0 && (
        <section>
          <p className={`${k} mb-2`}>How your cards read</p>
          <div className="grid grid-cols-3 gap-3">
            {data.cards.map((c) => (
              <a key={c.id} href={`/artworks/${c.id}`} className="flex flex-col gap-1 text-xs">
                <span className="aspect-[4/5] overflow-hidden rounded bg-[color:var(--sf-bg-soft)]">
                  {c.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.imageUrl} alt="" className="h-full w-full object-cover" />
                  )}
                </span>
                <span className="truncate font-medium">{c.title}</span>
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ── Installations ───────────────────────────────────────────────────────────

export function InstallationsFrame() {
  const surface = useSurface();
  const data = useLoad(() => loadInstallationsFrame(), []);
  const [title, setTitle] = React.useState("");
  const [venue, setVenue] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  if (!data) return <Loading kind="gallery" title="Installations" />;
  if (data.ok === false) return <Failed kind="gallery" title="Installations" error={data.error} />;
  const chosen = venue ?? data.venues[0]?.id ?? "northwest";
  const start = async () => {
    setBusy(true);
    const r = await createInstallationFrame({ title, venue: chosen }).catch(() => ({ ok: false as const, error: "That did not work." }));
    setBusy(false);
    if (r.ok === false) return void toast.error(r.error);
    surface.push(installationFrame(r.id, title || "Untitled collection"));
  };
  return (
    <SurfaceFrame
      kind="gallery"
      kicker="Installations"
      title={`${data.installations.length} hung`}
      actions={actions([{ label: "Open as page", href: "/studio/installations", quiet: true }])}
    >
      <ul className="flex flex-col">
        {data.installations.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center gap-3 border-t border-[color:var(--sf-line)] py-2.5 text-sm first:border-t-0">
            <span className="min-w-0 flex-1">
              <b className="font-medium">{i.title}</b>
              <span className="block text-xs text-[color:var(--sf-muted)]">
                {i.pieces} {i.pieces === 1 ? "piece" : "pieces"} hung · {i.published ? "open to visitors" : "draft"} · updated {day(i.updatedAt)}
              </span>
            </span>
            {i.published && <a href={`/installations/${i.id}`} className="text-xs underline underline-offset-4">Walk it ↗</a>}
            <button type="button" className={btn} onClick={() => surface.push(installationFrame(i.id, i.title))}>Edit the hang</button>
          </li>
        ))}
      </ul>
      <section className="mt-6 border-t border-[color:var(--sf-line)] pt-4">
        <p className={`${k} mb-2`}>Install a collection</p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Where to hang it">
          {data.venues.map((v) => (
            <label key={v.id} className={`flex min-w-[200px] flex-1 cursor-pointer items-start gap-2 rounded-md border p-2.5 text-sm ${chosen === v.id ? "border-[color:var(--sf-fg)]" : "border-[color:var(--sf-line)]"}`}>
              <input type="radio" name="venue" checked={chosen === v.id} onChange={() => setVenue(v.id)} className="mt-1" />
              <span><b className="font-medium">{v.name}</b><span className="block text-xs text-[color:var(--sf-muted)]">{v.blurb}</span></span>
            </label>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} placeholder="Name the collection, e.g. Harvest paintings 2026" className="min-h-10 min-w-[260px] flex-1 rounded-md border border-[color:var(--sf-line)] bg-transparent px-3 text-sm" />
          <button type="button" className={btn} disabled={busy} onClick={start}>{busy ? "Starting…" : "Start hanging"}</button>
        </div>
      </section>
      <Toaster richColors position="top-right" />
    </SurfaceFrame>
  );
}

export function InstallationFrame({ descriptor }: Props) {
  const id = String(descriptor.props?.id ?? "");
  const data = useLoad(() => loadInstallationFrame(id), [id]);
  if (!data) return <Loading kind="gallery" title={descriptor.title ?? "Installation"} />;
  if (data.ok === false) return <Failed kind="gallery" title="Installation" error={data.error} />;
  return (
    <SurfaceFrame
      kind="gallery"
      kicker="Installation"
      title={data.installation.title}
      flush
      actions={actions([
        { label: "Open as page", href: `/studio/installations/${id}`, quiet: true },
        data.installation.status === "published" ? { label: "Walk it ↗", href: `/installations/${id}`, quiet: true } : null,
      ])}
    >
      <InstallationEditor installation={data.installation} artworks={data.artworks} initialPieces={data.pieces} />
      <Toaster richColors position="top-right" />
    </SurfaceFrame>
  );
}

// ── The store's own profile (Store front tab) and colour (Look tab) ─────────

type StoreData = Extract<Awaited<ReturnType<typeof loadStoreFrame>>, { ok: true }>;

async function uploadPicture(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const r = await fetch("/api/upload", { method: "POST", body: fd });
  const j = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!r.ok || !j.url) throw new Error(j.error ?? "The picture could not be uploaded.");
  return j.url;
}

function PicturePick({ label, value, fallback, wide, onChange }: { label: string; value: string; fallback: string | null; wide?: boolean; onChange: (url: string) => void }) {
  const [busy, setBusy] = React.useState(false);
  const shown = value || fallback;
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      <div className={`overflow-hidden rounded-md border border-[color:var(--sf-line)] bg-[color:var(--sf-bg-soft)] ${wide ? "aspect-[3/1]" : "aspect-square w-28"}`}>
        {shown && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="" className={`h-full w-full object-cover ${value ? "" : "opacity-50"}`} />
        )}
      </div>
      <span className="flex flex-wrap items-center gap-3 text-xs">
        <label className="cursor-pointer underline underline-offset-4">
          {busy ? "Uploading…" : value ? "Replace" : "Upload"}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={busy}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setBusy(true);
              try {
                onChange(await uploadPicture(f));
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Upload failed.");
              } finally {
                setBusy(false);
                e.target.value = "";
              }
            }}
          />
        </label>
        {value && <button type="button" className="underline underline-offset-4" onClick={() => onChange("")}>Remove</button>}
        {!value && fallback && <span className="text-[color:var(--sf-muted)]">Showing your network profile’s picture</span>}
      </span>
    </div>
  );
}

function StoreProfileTab({ data }: { data: StoreData }) {
  const surface = useSurface();
  const [f, setF] = React.useState({
    displayName: data.own.displayName ?? "",
    headline: data.own.headline ?? "",
    city: data.own.city ?? "",
    photoUrl: data.own.photoUrl ?? "",
    coverUrl: data.coverUrl ?? "",
    bioHtml: data.bioHtml ?? "",
  });
  const [busy, setBusy] = React.useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const field = "min-h-10 w-full rounded-md border border-[color:var(--sf-line)] bg-transparent px-2.5 text-sm placeholder:text-[color:var(--sf-muted)]";
  const save = async () => {
    setBusy(true);
    const r = await saveStoreProfileAction(f).catch(() => ({ ok: false as const, error: "That did not save." }));
    setBusy(false);
    if (r.ok === false) return void toast.error(r.error);
    toast.success("Store saved.");
    surface.connectors.onMutated?.();
  };
  if (!data.canEdit) return <p className="text-sm">Only the store’s owners and managers can change its profile.</p>;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-[color:var(--sf-muted)]">
        This store’s own profile. Leave a field empty and the store shows your network profile instead (greyed here).
      </p>
      <PicturePick label="Cover picture" wide value={f.coverUrl} fallback={null} onChange={set("coverUrl")} />
      <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)]">
        <PicturePick label="Store photo" value={f.photoUrl} fallback={data.fallback.photoUrl} onChange={set("photoUrl")} />
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm"><span className="font-medium">Store name</span>
            <input value={f.displayName} onChange={(e) => set("displayName")(e.target.value)} placeholder={data.fallback.displayName ?? ""} maxLength={120} className={field} /></label>
          <label className="flex flex-col gap-1 text-sm"><span className="font-medium">Line</span>
            <input value={f.headline} onChange={(e) => set("headline")(e.target.value)} placeholder={data.fallback.headline ?? "What the store is, in a line"} maxLength={200} className={field} /></label>
          <label className="flex flex-col gap-1 text-sm"><span className="font-medium">City</span>
            <input value={f.city} onChange={(e) => set("city")(e.target.value)} placeholder={data.fallback.city ?? ""} maxLength={120} className={field} /></label>
        </div>
      </div>
      <div className="flex flex-col gap-1 text-sm">
        <span className="font-medium">About the store</span>
        <RichTextEditor value={f.bioHtml} onChange={set("bioHtml")} placeholder="What this store is about: the work, how it is made, how it ships." />
      </div>
      <div><button type="button" className={btn} disabled={busy} onClick={save}>{busy ? "Saving…" : "Save the store"}</button></div>
    </div>
  );
}

const ACCENTS = ["#2f4a63", "#a5521b", "#7a3e7a", "#1b6a45", "#bf3122", "#3b342f", "#8a6a00", "#375f8a"];

function StoreLookTab({ data }: { data: StoreData }) {
  const surface = useSurface();
  const [accent, setAccent] = React.useState<string | null>(data.accent);
  const [busy, setBusy] = React.useState(false);
  const save = async () => {
    setBusy(true);
    const r = await saveStoreProfileAction({ accent }).catch(() => ({ ok: false as const, error: "That did not save." }));
    setBusy(false);
    if (r.ok === false) return void toast.error(r.error);
    toast.success("Look saved.");
    surface.connectors.onMutated?.();
  };
  if (!data.canEdit) return <p className="text-sm">Only the store’s owners and managers can change its look.</p>;
  const shown = accent ?? "#3b342f";
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-[color:var(--sf-muted)]">One colour for the store front: the hero behind your cover, the section rules and the buttons. Text on it stays white.</p>
      <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Store colour">
        {ACCENTS.map((c) => (
          <button key={c} type="button" role="radio" aria-checked={accent === c} aria-label={c} onClick={() => setAccent(c)}
            className={`h-10 w-10 rounded-full border-2 ${accent === c ? "border-[color:var(--sf-fg)]" : "border-transparent"}`} style={{ background: c }} />
        ))}
        <label className="flex items-center gap-2 text-sm">Your own
          <input type="color" value={shown} onChange={(e) => setAccent(e.target.value)} className="h-10 w-12 cursor-pointer rounded border border-[color:var(--sf-line)]" /></label>
        <button type="button" className="text-sm underline underline-offset-4" onClick={() => setAccent(null)}>The market’s own</button>
      </div>
      <div className="overflow-hidden rounded-md border border-[color:var(--sf-line)]">
        <div className="flex h-24 items-end p-4 text-white" style={{ background: data.coverUrl ? `linear-gradient(transparent, rgba(0,0,0,.6)), url(${data.coverUrl}) center/cover` : shown }}>
          <b className="font-serif text-2xl font-medium">{data.name}</b>
        </div>
        <div className="flex items-center gap-3 p-3 text-sm">
          <span className="border-b-2 pb-1 font-medium" style={{ borderColor: shown }}>Works</span>
          <span className="rounded-md px-3 py-1.5 text-white" style={{ background: shown }}>Artist page</span>
        </div>
      </div>
      <div><button type="button" className={btn} disabled={busy} onClick={save}>{busy ? "Saving…" : "Save the look"}</button></div>
    </div>
  );
}

// ── An artist's profile (public; the owner can edit it here) ────────────────

export function ArtistFrame({ descriptor }: Props) {
  const surface = useSurface();
  const handle = String(descriptor.props?.handle ?? "");
  const [tick, setTick] = React.useState(0);
  const data = useLoad(() => loadArtistFrame(handle), [handle, tick]);
  const [lb, setLb] = React.useState(-1);
  React.useEffect(() => {
    const on = () => setTick((t) => t + 1);
    window.addEventListener("market:artist-saved", on);
    return () => window.removeEventListener("market:artist-saved", on);
  }, []);
  if (!data) return <Loading kind="product" title={descriptor.title ?? "Artist"} />;
  if (data.ok === false) return <Failed kind="product" title="Artist" error={data.error} />;
  const accent = data.accent ?? "var(--sf-fg)";
  const shown = data.works.slice(0, 4);
  const piece = lb >= 0 ? shown[lb] : null;
  const hasRail = data.timeline.length > 0 || data.files.length > 0 || data.canEdit;
  return (
    <SurfaceFrame
      kind="product"
      kicker="Artist"
      title={data.name}
      flush
      status={data.canEdit ? "You run this store: add links, timeline entries and files here" : [data.city, `${data.works.length} works`].filter(Boolean).join(" · ")}
      actions={actions([
        data.canEdit ? { label: "Look", onClick: () => surface.push(storeFrame("look")) } : null,
        data.canEdit ? { label: "Edit profile", onClick: () => surface.push(artistEditFrame(handle)) } : null,
        { label: "Open the store ↗", href: `/artists/${data.slug}`, primary: true },
      ])}
    >
      <div className="relative">
        <div className={`grid ${hasRail ? "md:grid-cols-[minmax(0,1fr)_290px]" : ""}`}>
          <div className="flex flex-col items-center gap-2.5 px-6 pb-8 pt-8 text-center md:px-10">
            <div className="h-[220px] w-[220px] overflow-hidden rounded-md bg-[color:var(--sf-bg-soft)] shadow-[0_12px_30px_-18px_rgba(0,0,0,.5)]">
              {data.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.photoUrl} alt={data.name} className="h-full w-full object-cover" />
              )}
            </div>
            <h2 className="mt-2 font-serif text-4xl" style={{ color: accent }}>{data.name}</h2>
            <p className="text-[15px] text-[color:var(--sf-muted)]">{[data.headline, data.city].filter(Boolean).join(" · ")}</p>
            {data.bioHtml && (
              <div className="prose mt-2 max-w-[520px] font-serif text-[17px] text-[color:var(--sf-fg)]" dangerouslySetInnerHTML={{ __html: data.bioHtml }} />
            )}
            {(data.links.length > 0 || data.networkHref) && (
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {data.networkHref && (
                  <a href={data.networkHref} className="inline-flex min-h-9 items-center rounded-full border border-[color:var(--sf-line)] px-3 text-sm" style={{ color: accent }}>Artist page on ArtDirect</a>
                )}
                {data.links.map((l) => (
                  <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center rounded-full border border-[color:var(--sf-line)] px-3 text-sm" style={{ color: accent }}>
                    {l.label || l.url.replace(/^https?:\/\//, "")}
                  </a>
                ))}
              </div>
            )}
          </div>
          {hasRail && (
            <aside className="flex flex-col gap-3 border-t border-[color:var(--sf-line)] bg-[color:var(--sf-bg-soft)] p-5 text-sm md:border-l md:border-t-0" aria-label="Timeline and files">
              {data.timeline.length > 0 && (
                <>
                  <p className={k}>Timeline</p>
                  <div className="grid grid-cols-[44px_minmax(0,1fr)] gap-x-2.5 gap-y-1.5">
                    {data.timeline.map((t, i) => (
                      <React.Fragment key={i}>
                        <b className="tabular-nums" style={{ color: accent }}>{t.year}</b>
                        <span>{t.text}</span>
                      </React.Fragment>
                    ))}
                  </div>
                </>
              )}
              {data.files.length > 0 && (
                <>
                  <p className={`${k} mt-2`}>Files</p>
                  {data.files.map((f) => (
                    <a key={f.url} href={f.url} download className="flex items-center gap-2.5 rounded-md border border-[color:var(--sf-line)] bg-[color:var(--sf-bg)] p-2.5">
                      <span className="grid h-9 w-7 place-items-center rounded-sm bg-[#a52a1d] font-mono text-[9px] font-semibold text-white">{(f.url.split(".").pop() ?? "").slice(0, 4).toUpperCase() || "FILE"}</span>
                      <span className="flex flex-col"><b className="font-medium">{f.name}</b><span className="text-xs text-[color:var(--sf-muted)]">download</span></span>
                    </a>
                  ))}
                </>
              )}
              {data.canEdit && data.timeline.length === 0 && data.files.length === 0 && (
                <button type="button" className="text-left text-xs underline underline-offset-4" onClick={() => surface.push(artistEditFrame(handle))}>
                  + Add a timeline, files and links
                </button>
              )}
            </aside>
          )}
        </div>
        {data.works.length > 0 && (
          <section className="flex items-center gap-3 border-t border-[color:var(--sf-line)] px-6 py-4">
            <p className={k}>Work</p>
            <div className="flex gap-2">
              {data.works.slice(0, 4).map((w, i) => (
                <button key={w.id} type="button" onClick={() => setLb(i)} aria-label={`See ${w.title} large`} className="h-14 w-14 cursor-zoom-in overflow-hidden rounded bg-[color:var(--sf-bg-soft)]">
                  {w.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={w.imageUrl} alt="" className="h-full w-full object-cover" />
                  )}
                </button>
              ))}
            </div>
            <a href={`/artists/${data.slug}`} className="ml-auto text-sm underline underline-offset-4" style={{ color: accent }}>
              {data.works.length > 4 ? `All ${data.works.length} works in the store →` : "In the store →"}
            </a>
          </section>
        )}
        {data.writing.length > 0 && (
          <section className="border-t border-[color:var(--sf-line)] px-6 pb-7 pt-4">
            <p className={`${k} mb-2`}>Writing</p>
            {data.writing.map((w) => (
              <div key={w.key} className="border-t border-[color:var(--sf-line)] py-2 first:border-t-0">
                <a href={w.href ?? "#"} className="font-serif text-base hover:underline" style={{ color: accent }}>{w.title}</a>
                {w.excerpt && <p className="line-clamp-2 text-sm text-[color:var(--sf-muted)]">{w.excerpt}</p>}
              </div>
            ))}
          </section>
        )}
        {piece && (
          <div role="dialog" aria-label={piece.title} className="absolute inset-0 z-10 grid gap-6 bg-[rgba(18,16,14,.94)] p-6 text-[#f3efe9] md:grid-cols-[minmax(0,1fr)_280px]">
            <div className="relative flex min-h-[360px] items-center justify-center">
              {piece.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={piece.imageUrl} alt={piece.title} className="max-h-[70vh] max-w-full object-contain" />
              ) : (
                <span className="aspect-[4/5] w-2/3 rounded bg-white/10" />
              )}
              <button type="button" aria-label="Previous" onClick={() => setLb((lb - 1 + shown.length) % shown.length)} className="absolute left-0 top-1/2 h-11 w-11 -translate-y-1/2 rounded-full border border-white/40 bg-black/30 text-lg">‹</button>
              <button type="button" aria-label="Next" onClick={() => setLb((lb + 1) % shown.length)} className="absolute right-0 top-1/2 h-11 w-11 -translate-y-1/2 rounded-full border border-white/40 bg-black/30 text-lg">›</button>
            </div>
            <div className="flex flex-col gap-2.5 pt-2">
              <button type="button" aria-label="Close preview" onClick={() => setLb(-1)} className="h-10 w-10 self-end rounded-full border border-white/40">✕</button>
              <b className="font-serif text-3xl font-medium">{piece.title}</b>
              {piece.detail && <span className="text-[#cfc8bf]">{piece.detail}</span>}
              <span className="text-sm text-[#cfc8bf]">{lb + 1} of {shown.length}</span>
              <a href={`/artworks/${piece.id}`} className="mt-2 inline-flex min-h-10 w-fit items-center rounded-md bg-white px-3.5 text-sm font-medium text-[#201b18]">See the piece ↗</a>
            </div>
          </div>
        )}
      </div>
      <Toaster richColors position="top-right" />
    </SurfaceFrame>
  );
}

// ── The artist's own edit: links, timeline, files ───────────────────────────

async function uploadFile(file: File): Promise<{ url: string; size: number }> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("source", "mine");
  const r = await fetch("/api/content/upload", { method: "POST", body: fd });
  const j = (await r.json().catch(() => ({}))) as { url?: string; size?: number; error?: string };
  if (!r.ok || !j.url) throw new Error(j.error ?? "The file could not be uploaded.");
  return { url: j.url, size: j.size ?? file.size };
}

export function ArtistEditFrame({ descriptor }: Props) {
  const surface = useSurface();
  const handle = String(descriptor.props?.handle ?? "");
  const data = useLoad(() => loadArtistFrame(handle), [handle]);
  const [links, setLinks] = React.useState<Array<{ label: string; url: string }> | null>(null);
  const [timeline, setTimeline] = React.useState<Array<{ year: string; text: string }> | null>(null);
  const [files, setFiles] = React.useState<Array<{ name: string; url: string; size?: number | null }> | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  React.useEffect(() => {
    if (data && data.ok) {
      setLinks((x) => x ?? data.rawLinks);
      setTimeline((x) => x ?? data.timeline);
      setFiles((x) => x ?? data.files);
    }
  }, [data]);
  if (!data || !links || !timeline || !files) return <Loading kind="product" title="Edit profile" />;
  if (data.ok === false) return <Failed kind="product" title="Edit profile" error={data.error} />;
  if (!data.canEdit) return <Failed kind="product" title="Edit profile" error="Only the store’s owners and managers can change it." />;
  const field = "min-h-10 rounded-md border border-[color:var(--sf-line)] bg-transparent px-2.5 text-sm";
  const save = async () => {
    setBusy(true);
    const r = await saveStoreProfileAction({ links, timeline, files }).catch(() => ({ ok: false as const, error: "That did not save." }));
    setBusy(false);
    if (r.ok === false) return void toast.error(r.error);
    toast.success("Profile saved.");
    window.dispatchEvent(new Event("market:artist-saved"));
    surface.connectors.onMutated?.();
    surface.pop();
  };
  return (
    <SurfaceFrame
      kind="product"
      kicker="Artist · edit"
      title={data.name}
      status="Name, photo, line and the main text are on the store’s Store front tab"
      actions={actions([
        { label: "Store front tab", onClick: () => surface.push(storeFrame("front")) },
        { label: busy ? "Saving…" : "Save the profile", primary: true, disabled: busy, onClick: save },
      ])}
    >
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-2">
          <p className={k}>Links</p>
          {links.map((l, i) => (
            <div key={i} className="flex flex-wrap gap-2">
              <input aria-label="Link label" value={l.label} placeholder="Label" onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} className={`${field} w-48`} />
              <input aria-label="Link address" value={l.url} placeholder="https://…" onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} className={`${field} min-w-0 flex-1`} />
              <button type="button" className="text-xs underline" onClick={() => setLinks(links.filter((_, j) => j !== i))}>Remove</button>
            </div>
          ))}
          <button type="button" className="w-fit text-sm underline underline-offset-4" onClick={() => setLinks([...links, { label: "", url: "" }])}>+ Add a link</button>
        </section>
        <section className="flex flex-col gap-2">
          <p className={k}>Timeline</p>
          {timeline.map((t, i) => (
            <div key={i} className="flex flex-wrap gap-2">
              <input aria-label="Year" value={t.year} placeholder="2025" onChange={(e) => setTimeline(timeline.map((x, j) => (j === i ? { ...x, year: e.target.value } : x)))} className={`${field} w-24`} />
              <input aria-label="What" value={t.text} placeholder="Show, residency, award…" onChange={(e) => setTimeline(timeline.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} className={`${field} min-w-0 flex-1`} />
              <button type="button" className="text-xs underline" onClick={() => setTimeline(timeline.filter((_, j) => j !== i))}>Remove</button>
            </div>
          ))}
          <button type="button" className="w-fit text-sm underline underline-offset-4" onClick={() => setTimeline([{ year: String(new Date().getFullYear()), text: "" }, ...timeline])}>+ Add to the timeline</button>
        </section>
        <section className="flex flex-col gap-2">
          <p className={k}>Files to download</p>
          {files.map((f, i) => (
            <div key={f.url} className="flex flex-wrap items-center gap-2">
              <input aria-label="File name" value={f.name} onChange={(e) => setFiles(files.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className={`${field} min-w-0 flex-1`} />
              <a href={f.url} className="text-xs underline">Open</a>
              <button type="button" className="text-xs underline" onClick={() => setFiles(files.filter((_, j) => j !== i))}>Remove</button>
            </div>
          ))}
          <label className="w-fit cursor-pointer text-sm underline underline-offset-4">
            {uploading ? "Uploading…" : "+ Upload a file (a CV, a price list)"}
            <input
              type="file"
              accept=".pdf,application/pdf"
              className="sr-only"
              disabled={uploading}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setUploading(true);
                try {
                  const up = await uploadFile(f);
                  setFiles([...files, { name: f.name.replace(/\.[a-z0-9]+$/i, ""), url: up.url, size: up.size }]);
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Upload failed.");
                } finally {
                  setUploading(false);
                  e.target.value = "";
                }
              }}
            />
          </label>
          <p className="text-xs text-[color:var(--sf-muted)]">Files go into your own folder and anyone can download them from your profile.</p>
        </section>
      </div>
      <Toaster richColors position="top-right" />
    </SurfaceFrame>
  );
}
