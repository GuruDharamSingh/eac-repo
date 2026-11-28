"use client";

import * as React from "react";
import { Toaster, toast } from "sonner";
import {
  SurfaceFrame,
  SurfaceSkeleton,
  useSurface,
  type SurfaceAction,
  type SurfaceDescriptor,
} from "@elkdonis/cms-ui/surface";
import {
  adminCancelOrder,
  adminConfirmOrder,
  adminFulfilOrder,
  adminPauseStore,
  adminReactivateStore,
  adminRefundOrder,
} from "@/app/admin/actions";
import {
  loadApplicationsFrame,
  loadMembersFrame,
  loadMoneyHubFrame,
  loadOrderFrame,
  loadOrdersFrame,
  loadSeriesFrame,
  loadStoresFrame,
} from "../frames";
import { ApplicationActions } from "@/app/admin/applications/application-actions";
import { NewSeriesForm } from "@/app/admin/series/series-panels";
import { ApprovePayeeButton, OwedTable, ReleaseButton, SettingsForm } from "@/app/admin/money/money-panels";
import { ArrivalsTable } from "@elkdonis/cms-ui/network";
import { PopupRefresh } from "@/lib/popup-refresh";
import { orderConfirmFrame, orderFrame } from "./descriptors";
import { siteConfig } from "@/config/site";

/**
 * The /hub popups (slice 5). Reads through ../frames.ts; writes through /admin's own actions, which re-check the
 * role. A confirm (cancel, refund) is its own compact layer pushed over the order, as the surface system does it,
 * not a second dialog. Each popup carries a toaster: the page's sits behind the modal <dialog>.
 */

type Custom = Extract<SurfaceDescriptor, { type: "custom" }>;
type Props = { descriptor: Custom };

const k = "text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--sf-muted)]";
const CHANGED = "hub:changed";
const changed = () => window.dispatchEvent(new Event(CHANGED));

/** Load, and load again whenever a popup reports a change (a confirm layer above it, say). */
function useLoad<T>(load: () => Promise<T>, deps: React.DependencyList): T | null | { ok: false; error: string } {
  const [data, setData] = React.useState<T | null | { ok: false; error: string }>(null);
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    const on = () => setTick((t) => t + 1);
    window.addEventListener(CHANGED, on);
    return () => window.removeEventListener(CHANGED, on);
  }, []);
  React.useEffect(() => {
    let live = true;
    load()
      .then((d) => live && setData(d))
      .catch(() => live && setData({ ok: false, error: "This could not be loaded. Try again." }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return data;
}

const actions = (list: Array<SurfaceAction | null | false | undefined>): SurfaceAction[] => list.filter(Boolean) as SurfaceAction[];
const day = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: "America/Toronto" });

function Chips<T extends string>({ items, current, onSelect }: { items: Array<{ key: T; label: string }>; current: T; onSelect: (k: T) => void }) {
  return (
    <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Show">
      {items.map((c) => (
        <button
          key={c.key}
          type="button"
          aria-pressed={c.key === current}
          onClick={() => onSelect(c.key)}
          className={`min-h-8 rounded-full border px-3 text-xs font-medium ${
            c.key === current ? "border-[color:var(--sf-fg)] bg-[color:var(--sf-fg)] text-[color:var(--sf-bg)]" : "border-[color:var(--sf-line)]"
          }`}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

// ── Orders ──────────────────────────────────────────────────────────────────

const ORDER_GROUP: Record<string, "pay" | "ship" | "done"> = {
  pending_payment: "pay", awaiting_etransfer: "pay",
  paid: "ship", payment_received: "ship",
  fulfilled: "done", completed: "done", cancelled: "done", refunded: "done", draft: "done",
};

export function OrdersFrame({ descriptor }: Props) {
  const surface = useSurface();
  const [filter, setFilter] = React.useState<"pay" | "ship" | "done" | "all">((descriptor.props?.filter as never) ?? "ship");
  const data = useLoad(() => loadOrdersFrame(), []);
  if (!data) return <SurfaceFrame kind="board" title="Orders"><SurfaceSkeleton block /></SurfaceFrame>;
  if (data.ok === false) return <SurfaceFrame kind="board" title="Orders"><p className="text-sm">{data.error}</p></SurfaceFrame>;
  const count = (g: string) => data.orders.filter((o) => ORDER_GROUP[o.status] === g).length;
  const shown = data.orders.filter((o) => filter === "all" || ORDER_GROUP[o.status] === filter);
  return (
    <SurfaceFrame
      kind="board"
      kicker="Orders"
      title={`${count("ship")} to ship, ${count("pay")} to pay`}
      status={`The latest ${data.orders.length} orders`}
      actions={actions([{ label: "Open as page", href: "/admin/orders", quiet: true }])}
    >
      <Chips<"pay" | "ship" | "done" | "all">
        items={[
          { key: "pay" as const, label: `To pay ${count("pay")}` },
          { key: "ship" as const, label: `To ship ${count("ship")}` },
          { key: "done" as const, label: `Done ${count("done")}` },
          { key: "all" as const, label: `All ${data.orders.length}` },
        ]}
        current={filter}
        onSelect={setFilter}
      />
      {shown.length === 0 ? (
        <p className="text-sm text-[color:var(--sf-muted)]">Nothing here.</p>
      ) : (
        <ul className="flex flex-col">
          {shown.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => surface.push(orderFrame(o.id, o.number))}
                className="flex min-h-12 w-full items-center gap-3 border-t border-[color:var(--sf-line)] px-1 py-2 text-left text-sm hover:bg-[color:var(--sf-bg-soft)]"
              >
                <b className="w-24 shrink-0 font-medium tabular-nums">{o.number}</b>
                <span className="min-w-0 flex-1 truncate">{o.who} · {day(o.when)}</span>
                <span className="shrink-0 text-xs text-[color:var(--sf-muted)]">{o.statusWord}</span>
                <span className="w-24 shrink-0 text-right tabular-nums">{o.total}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </SurfaceFrame>
  );
}

export function OrderFrame({ descriptor }: Props) {
  const surface = useSurface();
  const id = String(descriptor.props?.id ?? "");
  const [busy, setBusy] = React.useState(false);
  const data = useLoad(() => loadOrderFrame(id), [id]);
  if (!data) return <SurfaceFrame kind="board" title={descriptor.title ?? "Order"}><SurfaceSkeleton block /></SurfaceFrame>;
  if (data.ok === false) return <SurfaceFrame kind="board" title="Order"><p className="text-sm">{data.error}</p></SurfaceFrame>;

  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>, done: string) => {
    setBusy(true);
    const r = await fn().catch(() => ({ ok: false, error: "That did not work." }));
    setBusy(false);
    if (!r.ok) return void toast.error(r.error ?? "That did not work.");
    toast.success(done);
    surface.connectors.onMutated?.();
    changed();
  };
  const s = data.status;
  const canConfirm = s === "awaiting_etransfer";
  const canShip = s === "paid" || s === "payment_received";
  const canCancel = s === "pending_payment" || s === "awaiting_etransfer";
  const canRefund = s === "paid" || s === "payment_received" || s === "fulfilled" || s === "completed";
  return (
    <SurfaceFrame
      kind="board"
      kicker={`Order · ${data.statusWord}`}
      title={`${data.number} · ${data.who}`}
      status={`${data.method === "stripe" ? "Card" : data.method}, ${day(data.when)} · ${data.total}`}
      actions={actions([
        { label: "Order page ↗", href: `/orders/${data.id}`, quiet: true },
        canCancel && { label: "Cancel…", danger: true, onClick: () => surface.push(orderConfirmFrame({ id: data.id, number: data.number, total: data.total, act: "cancel" })) },
        canRefund && { label: "Refund…", danger: true, onClick: () => surface.push(orderConfirmFrame({ id: data.id, number: data.number, total: data.total, act: "refund" })) },
        canConfirm && { label: busy ? "…" : "Payment received", primary: true, disabled: busy, onClick: () => run(() => adminConfirmOrder(data.id), "Payment recorded.") },
        canShip && { label: busy ? "…" : "Mark shipped", primary: true, disabled: busy, onClick: () => run(() => adminFulfilOrder(data.id), "Marked shipped.") },
      ])}
    >
      <ul className="flex flex-col">
        {data.lines.map((l) => (
          <li key={l.id} className="flex items-center gap-3 border-t border-[color:var(--sf-line)] py-2 text-sm first:border-t-0">
            <span className="min-w-0 flex-1">{l.what}{l.qty > 1 ? ` × ${l.qty}` : ""}</span>
            <span className="tabular-nums">{l.price}</span>
          </li>
        ))}
      </ul>
      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <div><dt className={k}>Pieces</dt><dd className="tabular-nums">{data.subtotal}</dd></div>
        <div><dt className={k}>Shipping</dt><dd className="tabular-nums">{data.shipping}</dd></div>
        <div><dt className={k}>Total</dt><dd className="font-semibold tabular-nums">{data.total}</dd></div>
      </dl>
      <p className="mt-4 text-sm"><span className={k}>Buyer</span><br />{data.who} · {data.email}</p>
      <Toaster richColors position="top-right" />
    </SurfaceFrame>
  );
}

export function OrderConfirmFrame({ descriptor }: Props) {
  const surface = useSurface();
  const p = descriptor.props as { id: string; number: string; total: string; act: "cancel" | "refund" };
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const refund = p.act === "refund";
  const go = async () => {
    setBusy(true);
    setError(null);
    const r = await (refund ? adminRefundOrder(p.id, reason) : adminCancelOrder(p.id, reason)).catch(() => ({ ok: false, error: "That did not work." }));
    setBusy(false);
    if (!r.ok) return setError(r.error ?? "That did not work.");
    toast.success(refund ? "Refunded." : "Order cancelled.");
    surface.connectors.onMutated?.();
    changed();
    surface.pop();
  };
  return (
    <SurfaceFrame
      kind="board"
      kicker={refund ? "Refund" : "Cancel"}
      title={refund ? `Refund order ${p.number}?` : `Cancel order ${p.number}?`}
      status={error ?? "Nothing happens until you press the button."}
      statusTone={error ? "error" : "normal"}
      actions={actions([
        { label: refund ? "Keep the order" : "Keep it", onClick: () => surface.pop() },
        { label: busy ? "…" : refund ? `Refund ${p.total}` : "Cancel the order", primary: true, danger: true, disabled: busy, onClick: go },
      ])}
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{refund ? "Why (the buyer sees this)" : "Why"}</span>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="rounded-md border border-[color:var(--sf-line)] bg-transparent p-2" />
      </label>
      <p className="mt-3 text-xs text-[color:var(--sf-muted)]">
        {refund
          ? "A card order is refunded through Stripe; anything else is recorded, and the money moves by hand."
          : "The order is cancelled and nothing is charged."}
      </p>
      <Toaster richColors position="top-right" />
    </SurfaceFrame>
  );
}

// ── Stores ──────────────────────────────────────────────────────────────────

const STORE_WORD: Record<string, string> = { active: "Active", pending: "Waiting", paused: "Paused", rejected: "Declined" };

export function StoresFrame({ descriptor }: Props) {
  const [filter, setFilter] = React.useState<"active" | "pending" | "paused" | "all">((descriptor.props?.filter as never) ?? "active");
  const [busy, setBusy] = React.useState<string | null>(null);
  const data = useLoad(() => loadStoresFrame(), []);
  if (!data) return <SurfaceFrame kind="product" title="Stores"><SurfaceSkeleton block /></SurfaceFrame>;
  if (data.ok === false) return <SurfaceFrame kind="product" title="Stores"><p className="text-sm">{data.error}</p></SurfaceFrame>;
  const count = (st: string) => data.stores.filter((s) => s.status === st).length;
  const shown = data.stores.filter((s) => filter === "all" || s.status === filter);
  const toggle = async (id: string, pause: boolean) => {
    setBusy(id);
    try {
      await (pause ? adminPauseStore(id) : adminReactivateStore(id));
      toast.success(pause ? "Store paused." : "Store active again.");
      changed();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That did not work.");
    } finally {
      setBusy(null);
    }
  };
  return (
    <SurfaceFrame
      kind="product"
      kicker="Stores"
      title={`${count("active")} active`}
      actions={actions([{ label: "Open as page", href: "/admin/stores", quiet: true }])}
    >
      <Chips<"active" | "pending" | "paused" | "all">
        items={[
          { key: "active" as const, label: `Active ${count("active")}` },
          { key: "pending" as const, label: `Waiting ${count("pending")}` },
          { key: "paused" as const, label: `Paused ${count("paused")}` },
          { key: "all" as const, label: `All ${data.stores.length}` },
        ]}
        current={filter}
        onSelect={setFilter}
      />
      <ul className="flex flex-col">
        {shown.map((s) => (
          <li key={s.id} className="flex min-h-12 items-center gap-3 border-t border-[color:var(--sf-line)] py-2 text-sm">
            <span className="min-w-0 flex-1">
              <b className="font-medium">{s.name}</b>
              <span className="block text-xs text-[color:var(--sf-muted)]">
                {s.kind === "org" ? "Organisation store" : "A person’s store"}{s.city ? ` · ${s.city}` : ""} · since {day(s.joined)}
              </span>
            </span>
            <span className="text-xs text-[color:var(--sf-muted)]">{STORE_WORD[s.status] ?? s.status}</span>
            {s.slug && <a href={`/artists/${s.slug}`} className="text-xs underline underline-offset-4">Front ↗</a>}
            {s.status === "active" && (
              <button type="button" disabled={busy === s.id} onClick={() => toggle(s.id, true)} className="min-h-9 rounded-md border border-[color:var(--sf-line)] px-3 text-xs">
                {busy === s.id ? "…" : "Pause"}
              </button>
            )}
            {s.status === "paused" && (
              <button type="button" disabled={busy === s.id} onClick={() => toggle(s.id, false)} className="min-h-9 rounded-md border border-[color:var(--sf-line)] px-3 text-xs">
                {busy === s.id ? "…" : "Make active"}
              </button>
            )}
          </li>
        ))}
      </ul>
      <Toaster richColors position="top-right" />
    </SurfaceFrame>
  );
}

// ── Applications ────────────────────────────────────────────────────────────

export function ApplicationsFrame() {
  const data = useLoad(() => loadApplicationsFrame(), []);
  if (!data) return <SurfaceFrame kind="product" title="Applications"><SurfaceSkeleton block /></SurfaceFrame>;
  if (data.ok === false) return <SurfaceFrame kind="product" title="Applications"><p className="text-sm">{data.error}</p></SurfaceFrame>;
  return (
    <SurfaceFrame
      kind="product"
      kicker="Store applications"
      title={`${data.applications.length} waiting`}
      actions={actions([{ label: "Open as page", href: "/admin/applications", quiet: true }])}
    >
      <PopupRefresh.Provider value={changed}>
        {data.applications.length === 0 ? (
          <p className="text-sm">No applications waiting.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {data.applications.map((a) => (
              <li key={a.id} className="rounded-md border border-[color:var(--sf-line)] p-4">
                <div className="flex items-start gap-3">
                  <span className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-[color:var(--sf-bg-soft)]">
                    {a.photoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.photoUrl} alt="" className="h-full w-full object-cover" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1 text-sm">
                    <b className="font-serif text-lg font-medium">{a.name}</b>
                    {a.headline && <p className="text-[color:var(--sf-muted)]">{a.headline}</p>}
                    <p className="text-xs text-[color:var(--sf-muted)]">{[a.city, a.email].filter(Boolean).join(" · ")}</p>
                    {a.bioHtml && <div className="prose prose-sm mt-2 max-w-none" dangerouslySetInnerHTML={{ __html: a.bioHtml }} />}
                  </div>
                </div>
                <div className="mt-3 flex justify-end"><ApplicationActions storeId={a.id} /></div>
              </li>
            ))}
          </ul>
        )}
      </PopupRefresh.Provider>
      <Toaster richColors position="top-right" />
    </SurfaceFrame>
  );
}

// ── Series ──────────────────────────────────────────────────────────────────

const PHASE_WORD: Record<string, string> = { draft: "Draft", announced: "Announced", silent: "Silent bidding", live: "Live close", closed: "Closed" };

export function SeriesFrame() {
  const data = useLoad(() => loadSeriesFrame(), []);
  if (!data) return <SurfaceFrame kind="series" title="Series"><SurfaceSkeleton block /></SurfaceFrame>;
  if (data.ok === false) return <SurfaceFrame kind="series" title="Series"><p className="text-sm">{data.error}</p></SurfaceFrame>;
  const running = data.series.filter((s) => s.phase === "announced" || s.phase === "silent" || s.phase === "live").length;
  return (
    <SurfaceFrame
      kind="series"
      kicker="Auction series"
      title={`${running} running`}
      status="A series is run from its workspace: weeks, desk team, lots."
      actions={actions([{ label: "Open as page", href: "/admin/series", quiet: true }])}
    >
      <ul className="flex flex-col">
        {data.series.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-3 border-t border-[color:var(--sf-line)] py-2.5 text-sm first:border-t-0">
            <span className="min-w-0 flex-1">
              <a href={`/series/${s.slug}/manage`} className="font-medium underline-offset-4 hover:underline">{s.title}</a>
              <span className="block text-xs text-[color:var(--sf-muted)]">
                {PHASE_WORD[s.phase] ?? s.phase}{s.draft ? " (unpublished)" : ""}
                {s.silentOpensAt ? ` · bidding ${day(s.silentOpensAt)}` : ""}{s.liveAt ? ` · live close ${day(s.liveAt)}` : ""}
              </span>
            </span>
            <span className="text-xs tabular-nums text-[color:var(--sf-muted)]">{s.lots} lots</span>
            <a href={`/series/${s.slug}/manage`} className="min-h-9 rounded-md border border-[color:var(--sf-line)] px-3 py-1.5 text-xs">Workspace ↗</a>
          </li>
        ))}
      </ul>
      {data.mayCreate && (
        <section className="mt-6 border-t border-[color:var(--sf-line)] pt-4">
          <p className={`${k} mb-2`}>New series</p>
          <NewSeriesForm />
        </section>
      )}
      <Toaster richColors position="top-right" />
    </SurfaceFrame>
  );
}

// ── Money ───────────────────────────────────────────────────────────────────

type MoneyTab = "owed" | "held" | "beneficiaries" | "settings";

export function MoneyHubFrame() {
  const [tab, setTab] = React.useState<MoneyTab>("owed");
  const data = useLoad(() => loadMoneyHubFrame(), []);
  if (!data) return <SurfaceFrame kind="service" title="Money"><SurfaceSkeleton block /></SurfaceFrame>;
  if (data.ok === false) return <SurfaceFrame kind="service" title="Money"><p className="text-sm">{data.error}</p></SurfaceFrame>;
  const tabs: Array<{ key: MoneyTab; label: string }> = [
    { key: "owed", label: `Owed ${data.owed.length}` },
    { key: "held", label: `Held ${data.held.length}` },
    ...(data.suggested.length ? [{ key: "beneficiaries" as const, label: `Beneficiaries ${data.suggested.length}` }] : []),
    { key: "settings", label: "Settings" },
  ];
  return (
    <SurfaceFrame
      kind="service"
      kicker="Money"
      title={`${data.owed.length} owed, ${data.held.length} held`}
      actions={actions([
        { label: "Network ledger ↗", href: `${siteConfig.network.artsCollectiveUrl}/hub/admin/ledger`, quiet: true },
        { label: "Open as page", href: "/admin/money", quiet: true },
      ])}
    >
      <Chips<MoneyTab> items={tabs} current={tab} onSelect={setTab} />
      <PopupRefresh.Provider value={changed}>
        {tab === "owed" && (data.owed.length ? <OwedTable rows={data.owed} /> : <p className="text-sm">Nobody is owed payable money.</p>)}
        {tab === "held" &&
          (data.held.length ? (
            <ul className="flex flex-col">
              {data.held.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-3 border-t border-[color:var(--sf-line)] py-2 text-sm first:border-t-0">
                  <span className="min-w-0 flex-1">{e.party} <span className="text-xs text-[color:var(--sf-muted)]">({e.partyKind}) · {e.reason} · since {day(e.since)}</span></span>
                  <span className="tabular-nums">{e.amount}</span>
                  {e.waitsOnBeneficiary ? <span className="text-xs text-[color:var(--sf-muted)]">approve the beneficiary first</span> : <ReleaseButton entryId={e.id} />}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm">Nothing held.</p>
          ))}
        {tab === "beneficiaries" && (
          <ul className="flex flex-col">
            {data.suggested.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 border-t border-[color:var(--sf-line)] py-2 text-sm first:border-t-0">
                <span>{p.name}{p.website ? <a className="ml-2 text-xs underline" href={p.website} target="_blank" rel="noopener">{p.website}</a> : null}{p.managedBy ? <span className="ml-2 text-xs text-[color:var(--sf-muted)]">for {p.managedBy}</span> : null}</span>
                <ApprovePayeeButton payeeId={p.id} />
              </li>
            ))}
          </ul>
        )}
        {tab === "settings" && (
          <SettingsForm
            defaultCommissionRate={data.settings.defaultCommissionRate}
            softCloseMinutes={data.settings.softCloseMinutes}
            paymentWindowHours={data.settings.paymentWindowHours}
          />
        )}
      </PopupRefresh.Provider>
      <Toaster richColors position="top-right" />
    </SurfaceFrame>
  );
}

// ── Members ─────────────────────────────────────────────────────────────────

export function MembersFrame() {
  const data = useLoad(() => loadMembersFrame(), []);
  if (!data) return <SurfaceFrame kind="neutral" title="Members"><SurfaceSkeleton block /></SurfaceFrame>;
  if (data.ok === false) return <SurfaceFrame kind="neutral" title="Members"><p className="text-sm">{data.error}</p></SurfaceFrame>;
  return (
    <SurfaceFrame
      kind="neutral"
      kicker="Members"
      title={`${data.users.length} people`}
      actions={actions([{ label: "Open as page", href: "/admin/users", quiet: true }])}
    >
      <ul className="flex flex-col">
        {data.users.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center gap-3 border-t border-[color:var(--sf-line)] py-2 text-sm first:border-t-0">
            <span className="min-w-0 flex-1">
              <b className="font-medium">{u.name ?? "—"}</b>
              <span className="block text-xs text-[color:var(--sf-muted)]">{u.email ?? "—"} · joined {day(u.joined)}</span>
            </span>
            {u.store && <span className="rounded-full bg-[color:var(--sf-bg-soft)] px-2 py-0.5 text-xs">store · {u.store}</span>}
            {u.collective && <span className="rounded-full bg-[color:var(--sf-bg-soft)] px-2 py-0.5 text-xs">collective</span>}
          </li>
        ))}
      </ul>
      <ArrivalsTable arrivals={data.arrivals as never} />
    </SurfaceFrame>
  );
}
