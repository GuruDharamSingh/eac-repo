"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { AuctionSeries, SeriesWeek, SeriesLot, SeriesMember } from "@elkdonis/commerce/queries";
import {
  createSeriesAction,
  updateSeriesAction,
  setSeriesStatusAction,
  setWeekFocusAction,
  addLotToSeriesAction,
  removeLotFromSeriesAction,
  renumberSeriesLotsAction,
  setSeriesMemberAction,
  removeSeriesMemberAction,
} from "./actions";

const inputCls =
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
const labelCls = "mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground";

function localInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const toIso = (v: string) => (v ? new Date(v).toISOString() : null);

export function NewSeriesForm() {
  const router = useRouter();
  const [title, setTitle] = React.useState("");
  const [subtitle, setSubtitle] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const r = await createSeriesAction({ title, subtitle: subtitle || null });
        setBusy(false);
        if (!r.ok || !r.id) return toast.error(r.error ?? "Could not create the series.");
        // The old manage route redirects to the series workspace.
        router.push(`/admin/series/${r.id}`);
      }}
    >
      <div className="min-w-[16rem] flex-1">
        <label className={labelCls}>New series</label>
        <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="IFAC Art Auction 2026" required />
      </div>
      <div className="min-w-[16rem] flex-1">
        <label className={labelCls}>Subtitle</label>
        <input className={inputCls} value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="A silent auction, closing live" />
      </div>
      <Button type="submit" disabled={busy}>{busy ? "Creating…" : "Create"}</Button>
    </form>
  );
}

export function DetailsPanel({ series }: { series: AuctionSeries }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [f, setF] = React.useState({
    title: series.title,
    subtitle: series.subtitle ?? "",
    descriptionHtml: series.descriptionHtml ?? "",
    eyebrow: series.card.eyebrow ?? "",
    blurb: series.card.blurb ?? "",
    imageUrl: series.card.imageUrl ?? "",
    announceAt: localInput(series.announceAt),
    silentOpensAt: localInput(series.silentOpensAt),
    liveAt: localInput(series.liveAt),
    weekCount: String(series.weekCount),
    closeMode: series.closeMode,
    staggerSeconds: String(series.staggerSeconds),
    softCloseMinutes: String(series.softCloseMinutes),
    paymentWindowHours: String(series.paymentWindowHours),
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await updateSeriesAction(series.id, series.slug, {
      title: f.title,
      subtitle: f.subtitle || null,
      descriptionHtml: f.descriptionHtml || null,
      card: { eyebrow: f.eyebrow || undefined, blurb: f.blurb || undefined, imageUrl: f.imageUrl || undefined },
      announceAt: toIso(f.announceAt),
      silentOpensAt: toIso(f.silentOpensAt),
      liveAt: toIso(f.liveAt),
      weekCount: Number(f.weekCount),
      closeMode: f.closeMode,
      staggerSeconds: Number(f.staggerSeconds),
      softCloseMinutes: Number(f.softCloseMinutes),
      paymentWindowHours: Number(f.paymentWindowHours),
    });
    setBusy(false);
    if (!r.ok) return toast.error(r.error ?? "Could not save.");
    toast.success("Saved.");
    router.refresh();
  }

  async function status(s: "draft" | "published" | "closed") {
    setBusy(true);
    const r = await setSeriesStatusAction(series.id, series.slug, s);
    setBusy(false);
    if (!r.ok) return toast.error(r.error ?? "Could not change status.");
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className={labelCls}>Title</label><input className={inputCls} value={f.title} onChange={set("title")} required /></div>
        <div><label className={labelCls}>Subtitle</label><input className={inputCls} value={f.subtitle} onChange={set("subtitle")} /></div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Description (HTML allowed)</label>
          <textarea className={inputCls} rows={6} value={f.descriptionHtml} onChange={set("descriptionHtml")} />
        </div>
        <div><label className={labelCls}>Card eyebrow</label><input className={inputCls} value={f.eyebrow} onChange={set("eyebrow")} placeholder="November 2026" /></div>
        <div><label className={labelCls}>Card blurb</label><input className={inputCls} value={f.blurb} onChange={set("blurb")} placeholder="One line for the home page" /></div>
        <div className="sm:col-span-2"><label className={labelCls}>Card image URL</label><input className={inputCls} value={f.imageUrl} onChange={set("imageUrl")} placeholder="https://…" /></div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div><label className={labelCls}>Announce (landing public)</label><input type="datetime-local" className={inputCls} value={f.announceAt} onChange={set("announceAt")} /></div>
        <div><label className={labelCls}>Bidding opens (silent)</label><input type="datetime-local" className={inputCls} value={f.silentOpensAt} onChange={set("silentOpensAt")} /></div>
        <div><label className={labelCls}>Live close</label><input type="datetime-local" className={inputCls} value={f.liveAt} onChange={set("liveAt")} /></div>
      </div>

      <div className="grid gap-4 sm:grid-cols-5">
        <div><label className={labelCls}>Weeks</label><input type="number" min={1} max={12} className={inputCls} value={f.weekCount} onChange={set("weekCount")} /></div>
        <div>
          <label className={labelCls}>Close</label>
          <select className={inputCls} value={f.closeMode} onChange={set("closeMode")}>
            <option value="staggered">Staggered by lot number</option>
            <option value="single">All at once</option>
          </select>
        </div>
        <div><label className={labelCls}>Stagger (seconds)</label><input type="number" min={10} className={inputCls} value={f.staggerSeconds} onChange={set("staggerSeconds")} /></div>
        <div><label className={labelCls}>Soft close (min)</label><input type="number" min={0} className={inputCls} value={f.softCloseMinutes} onChange={set("softCloseMinutes")} /></div>
        <div><label className={labelCls}>Payment window (h)</label><input type="number" min={1} className={inputCls} value={f.paymentWindowHours} onChange={set("paymentWindowHours")} /></div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <Button type="submit" disabled={busy}>Save</Button>
        <span className="text-sm text-muted-foreground">Status: <strong>{series.status}</strong> · phase: {series.phase}</span>
        <span className="ml-auto flex gap-2">
          {series.status !== "published" && <Button type="button" variant="outline" disabled={busy} onClick={() => status("published")}>Publish</Button>}
          {series.status === "published" && <Button type="button" variant="outline" disabled={busy} onClick={() => status("draft")}>Unpublish</Button>}
          {series.status !== "closed" && <Button type="button" variant="ghost" disabled={busy} onClick={() => status("closed")}>Close</Button>}
        </span>
      </div>
    </form>
  );
}

export function WeeksPanel({ series, weeks }: { series: AuctionSeries; weeks: SeriesWeek[] }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<number | null>(null);
  return (
    <div className="space-y-4">
      {weeks.map((w) => (
        <form
          key={w.weekNo}
          className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-[6rem_1fr_1fr_auto]"
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            setBusy(w.weekNo);
            const r = await setWeekFocusAction(series.id, series.slug, w.weekNo, {
              title: String(fd.get("title") ?? ""),
              focus: String(fd.get("focus") ?? ""),
              brief: String(fd.get("brief") ?? ""),
            });
            setBusy(null);
            if (!r.ok) return toast.error(r.error ?? "Could not save.");
            toast.success(`Week ${w.weekNo} saved.`);
            router.refresh();
          }}
        >
          <div className="font-serif text-xl">Week {w.weekNo}</div>
          <div>
            <label className={labelCls}>Title</label>
            <input name="title" className={inputCls} defaultValue={w.title} />
            <label className={`${labelCls} mt-2`}>Focus</label>
            <input name="focus" className={inputCls} defaultValue={w.focus ?? ""} placeholder="The week's key focus" />
          </div>
          <div>
            <label className={labelCls}>Notes for the desk</label>
            <textarea name="brief" className={inputCls} rows={4} defaultValue={w.brief ?? ""} />
          </div>
          <div className="self-end">
            <Button type="submit" size="sm" disabled={busy === w.weekNo}>Save</Button>
          </div>
        </form>
      ))}
    </div>
  );
}

export function LotsPanel({
  series,
  lots,
  unassigned,
}: {
  series: AuctionSeries;
  lots: SeriesLot[];
  unassigned: Array<{ id: string; title: string; artistName: string | null; endAt: string }>;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [pick, setPick] = React.useState("");
  const [order, setOrder] = React.useState(lots.map((l) => l.id));
  React.useEffect(() => setOrder(lots.map((l) => l.id)), [lots]);
  const byId = new Map(lots.map((l) => [l.id, l]));
  const money = (n: number | null, c: string) => (n == null ? "—" : new Intl.NumberFormat("en-CA", { style: "currency", currency: c }).format(n / 100));

  async function run(p: Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    const r = await p;
    setBusy(false);
    if (!r.ok) return toast.error(r.error ?? "Failed.");
    router.refresh();
  }
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j]!, next[i]!];
    setOrder(next);
  };

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Lot</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Closes</th>
              <th className="px-3 py-2 text-right font-medium">Current</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {order.map((id, i) => {
              const l = byId.get(id);
              if (!l) return null;
              return (
                <tr key={id}>
                  <td className="px-3 py-2 tabular-nums">
                    <span className="mr-2">{i + 1}</span>
                    <button type="button" className="text-xs" onClick={() => move(i, -1)} aria-label="Move up">↑</button>
                    <button type="button" className="ml-1 text-xs" onClick={() => move(i, 1)} aria-label="Move down">↓</button>
                  </td>
                  <td className="px-3 py-2">
                    <a href={`/lots/${l.id}`} className="underline-offset-4 hover:underline">{l.title}</a>
                    {l.artistName && <span className="ml-2 text-xs text-muted-foreground">{l.artistName}</span>}
                  </td>
                  <td className="px-3 py-2">{l.status}</td>
                  <td className="px-3 py-2 text-muted-foreground">{new Date(l.endAt).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" })}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(l.currentBidMinor, l.currency)} <span className="text-xs text-muted-foreground">({l.bidCount})</span></td>
                  <td className="px-3 py-2 text-right">
                    <button type="button" className="text-xs text-destructive underline-offset-4 hover:underline" disabled={busy} onClick={() => run(removeLotFromSeriesAction(series.id, series.slug, l.id))}>
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
            {order.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-sm text-muted-foreground">No lots in this series yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {order.length > 1 && order.join() !== lots.map((l) => l.id).join() && (
        <Button type="button" size="sm" disabled={busy} onClick={() => run(renumberSeriesLotsAction(series.id, series.slug, order))}>
          Save the order
        </Button>
      )}
      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-4">
        <div className="min-w-[18rem] flex-1">
          <label className={labelCls}>Add an open lot</label>
          <select className={inputCls} value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">Choose…</option>
            {unassigned.map((u) => (
              <option key={u.id} value={u.id}>{u.title}{u.artistName ? ` — ${u.artistName}` : ""}</option>
            ))}
          </select>
        </div>
        <Button type="button" size="sm" disabled={busy || !pick} onClick={() => run(addLotToSeriesAction(series.id, series.slug, pick)).then(() => setPick(""))}>
          Add to series
        </Button>
        <p className="w-full text-xs text-muted-foreground">
          A lot is created from a piece&rsquo;s page in My art (&ldquo;Put up for auction&rdquo;). Once in the series its clock follows the series dates: it opens at the silent-bidding time and closes at the live close{series.closeMode === "staggered" ? `, ${series.staggerSeconds} seconds apart per lot number` : ""}.
        </p>
      </div>
    </div>
  );
}

export function TeamPanel({ series, members }: { series: AuctionSeries; members: SeriesMember[] }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<"editor" | "contributor">("editor");
  async function run(p: Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    const r = await p;
    setBusy(false);
    if (!r.ok) return toast.error(r.error ?? "Failed.");
    setEmail("");
    router.refresh();
  }
  return (
    <div className="rounded-lg border border-border">
      <ul className="divide-y divide-border text-sm">
        {members.map((m) => (
          <li key={m.userId} className="flex items-center justify-between gap-3 px-4 py-3">
            <span>{m.displayName ?? m.email}{m.email && m.displayName ? <span className="ml-2 text-xs text-muted-foreground">{m.email}</span> : null}</span>
            <span className="flex items-center gap-3">
              <span className="rounded bg-muted px-2 py-0.5 text-xs">{m.role}</span>
              <button type="button" className="text-xs text-destructive underline-offset-4 hover:underline" disabled={busy} onClick={() => run(removeSeriesMemberAction(series.id, m.userId))}>Remove</button>
            </span>
          </li>
        ))}
        {members.length === 0 && <li className="px-4 py-3 text-muted-foreground">No desk members yet.</li>}
      </ul>
      <form
        className="flex flex-wrap items-center gap-2 border-t border-border p-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(setSeriesMemberAction(series.id, email, role));
        }}
      >
        <input type="email" required className={`${inputCls} flex-1`} placeholder="member@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <select className={inputCls} style={{ width: "auto" }} value={role} onChange={(e) => setRole(e.target.value as "editor" | "contributor")}>
          <option value="editor">editor — runs the desk</option>
          <option value="contributor">contributor — writes, no editing here</option>
        </select>
        <Button type="submit" size="sm" variant="outline" disabled={busy}>Add</Button>
      </form>
    </div>
  );
}
