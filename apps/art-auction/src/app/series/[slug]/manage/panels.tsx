"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MultiImageUploader, type UploadedImage } from "@elkdonis/studio-ui";
import { RichTextEditor } from "@elkdonis/cms-ui/editor";
import type { AuctionSeries, SeriesMember, SeriesLot } from "@elkdonis/commerce/queries";
import type { SeriesPerson, WeekBoard, WeekItemThread } from "@elkdonis/commerce/server";
import { SrsHero, type SeriesHero, type SeriesTheme, type JournalEntry } from "../series-template";
import {
  saveSeriesAction,
  searchPeopleAction,
  addMemberAction,
  removeMemberAction,
  addLotAction,
  removeLotAction,
  renumberLotsAction,
  attachOpenLotAction,
  saveWeekAction,
  addWeekItemAction,
  removeWeekItemAction,
  approveWeekItemAction,
  setWeekFeaturedAction,
  searchRepostableAction,
  collectiveArtistsAction,
  listLibrariesAction,
  listLibraryItemsAction,
  listArtistListingsAction,
  addListingAction,
} from "./actions";
import type { ArtistListing, SeriesLibrary } from "@elkdonis/commerce/server";

type Result = { ok: boolean; error?: string };

function localInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const toIso = (v: string) => (v ? new Date(v).toISOString() : null);
const numOrNull = (v: string) => (v.trim() === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const money = (n: number | null, c = "CAD") =>
  n == null ? "—" : new Intl.NumberFormat("en-CA", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(n / 100);
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" }) : "—");

function useRun() {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const run = React.useCallback(
    async (p: Promise<Result>, ok?: string): Promise<boolean> => {
      setBusy(true);
      const r = await p;
      setBusy(false);
      if (!r.ok) {
        toast.error(r.error ?? "Failed.");
        return false;
      }
      if (ok) toast.success(ok);
      router.refresh();
      return true;
    },
    [router]
  );
  return { busy, run };
}

/** A native modal dialog in the workspace look. */
export function Dialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const ref = React.useRef<HTMLDialogElement>(null);
  React.useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="sw-dialog" onClose={onClose} aria-label={title}>
      <div className="sw sw-dialog-body" style={{ minHeight: 0 }}>
        <div className="sw-head">
          <h2 className="sw-h2" style={{ margin: 0 }}>{title}</h2>
          <button type="button" className="sw-link" onClick={onClose}>Close</button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

// ─── Media ───────────────────────────────────────────────────────────────────

export async function uploadSeriesMedia(seriesId: string, file: File): Promise<{ url: string; kind: "image" | "video" }> {
  const fd = new FormData();
  fd.append("seriesId", seriesId);
  fd.append("file", file);
  const res = await fetch("/api/series/media", { method: "POST", body: fd });
  const body = (await res.json().catch(() => ({}))) as { url?: string; kind?: "image" | "video"; error?: string };
  if (!res.ok || !body.url) throw new Error(body.error ?? "Upload failed.");
  return { url: body.url, kind: body.kind ?? "image" };
}

export function MediaDrop({ seriesId, accept, label, onUploaded }: {
  seriesId: string;
  accept: string;
  label: string;
  onUploaded: (url: string, kind: "image" | "video") => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const [over, setOver] = React.useState(false);
  const ref = React.useRef<HTMLInputElement>(null);
  async function take(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const r = await uploadSeriesMedia(seriesId, file);
      onUploaded(r.url, r.kind);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }
  return (
    <div
      className={`sw-drop${over ? " is-over" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files?.[0]); }}
    >
      {busy ? "Uploading…" : (
        <>Drop a file here or <button type="button" className="sw-link" onClick={() => ref.current?.click()}>{label}</button></>
      )}
      <input ref={ref} type="file" accept={accept} className="sr-only" onChange={(e) => take(e.target.files?.[0])} />
    </div>
  );
}

// ─── People picker ───────────────────────────────────────────────────────────

export function PersonPicker({ seriesId, slug, id, label, onPick, onCreate, createHint }: {
  seriesId: string;
  slug: string;
  id: string;
  label: string;
  onPick: (p: SeriesPerson) => void;
  onCreate?: (name: string) => void;
  createHint?: string;
}) {
  const [q, setQ] = React.useState("");
  const [hits, setHits] = React.useState<SeriesPerson[]>([]);
  const [open, setOpen] = React.useState(false);
  // Before anything is typed: the collective's artists (people with a market
  // store, members of the presenting and host organisations).
  const [collective, setCollective] = React.useState<SeriesPerson[] | null>(null);
  React.useEffect(() => {
    if (!open || collective !== null) return;
    let live = true;
    collectiveArtistsAction(seriesId, slug).then((r) => live && setCollective(r)).catch(() => live && setCollective([]));
    return () => { live = false; };
  }, [open, collective, seriesId, slug]);
  React.useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setHits([]); return; }
    let live = true;
    const t = setTimeout(() => {
      searchPeopleAction(seriesId, slug, term).then((r) => live && setHits(r)).catch(() => live && setHits([]));
    }, 200);
    return () => { live = false; clearTimeout(t); };
  }, [q, seriesId, slug]);
  const typed = q.trim().length >= 2;
  const show = open && (typed || (collective?.length ?? 0) > 0);
  const list = typed ? hits : (collective ?? []);
  return (
    <div className="sw-field sw-search">
      <label htmlFor={id} className="sw-label">{label}</label>
      <input
        id={id}
        className="sw-input"
        value={q}
        autoComplete="off"
        placeholder="Name, @username or email"
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {show && (
        <ul className="sw-suggest" style={{ top: "100%", maxHeight: 360, overflowY: "auto" }}>
          {!typed && <li className="sw-eyebrow" style={{ padding: "6px 8px" }}>Artists of the collective</li>}
          {list.map((p) => (
            <li key={p.id}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onPick(p); setQ(""); setOpen(false); }}>
                <span className="sw-avatar" aria-hidden="true" />
                <span>
                  <strong>{p.name}</strong>{" "}
                  <span className="sw-muted">
                    {p.username ? `@${p.username}` : ""}{p.email ? ` · ${p.email}` : ""}{p.orgRole ? ` · ${p.orgRole}` : ""}
                  </span>
                </span>
              </button>
            </li>
          ))}
          {typed && hits.length === 0 && <li className="sw-muted" style={{ padding: 8 }}>No one on the network matches.</li>}
          {onCreate && typed && (
            <li>
              <button type="button" className="is-create" onMouseDown={(e) => e.preventDefault()} onClick={() => { onCreate(q.trim()); setQ(""); setOpen(false); }}>
                <strong>+ Add &ldquo;{q.trim()}&rdquo; as a new artist</strong>
                {createHint && <span className="sw-muted" style={{ display: "block" }}>{createHint}</span>}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

// ─── Team ────────────────────────────────────────────────────────────────────

export function TeamPanel({ series, members }: { series: AuctionSeries; members: SeriesMember[] }) {
  const { busy, run } = useRun();
  const [role, setRole] = React.useState<"editor" | "contributor">("editor");
  return (
    <>
      <section className="sw-card">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 320px" }}>
            <PersonPicker
              seriesId={series.id}
              slug={series.slug}
              id="team-search"
              label="Add someone"
              onPick={(p) => run(addMemberAction(series.id, series.slug, p.id, role), `${p.name} added as ${role}.`)}
            />
          </div>
          <div className="sw-field">
            <label htmlFor="team-role" className="sw-label">Role</label>
            <select id="team-role" className="sw-select" value={role} onChange={(e) => setRole(e.target.value as "editor" | "contributor")}>
              <option value="editor">Editor</option>
              <option value="contributor">Contributor</option>
            </select>
          </div>
        </div>
        <p className="sw-hint" style={{ marginTop: 8 }}>
          Matches name, username and email; close spellings are included. {series.presenterName ?? "Presenting org"} members are listed first.
          Pick the role, then the person.
        </p>
      </section>
      <div className="sw-table-wrap">
        <table className="sw-table">
          <thead><tr><th>Person</th><th>Role</th><th /></tr></thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.userId}>
                <td><strong>{m.displayName ?? m.email}</strong>{m.email && m.displayName && <div className="sw-muted">{m.email}</div>}</td>
                <td>
                  <select
                    aria-label={`Role of ${m.displayName ?? m.email ?? "member"}`}
                    className="sw-select"
                    style={{ minHeight: 36, width: "auto" }}
                    value={m.role}
                    disabled={busy}
                    onChange={(e) => run(addMemberAction(series.id, series.slug, m.userId, e.target.value as "editor" | "contributor"))}
                  >
                    <option value="editor">Editor</option>
                    <option value="contributor">Contributor</option>
                  </select>
                </td>
                <td style={{ textAlign: "right" }}>
                  <button type="button" className="sw-link is-danger" disabled={busy}
                    onClick={() => window.confirm(`Remove ${m.displayName ?? m.email} from the team?`) && run(removeMemberAction(series.id, series.slug, m.userId))}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {members.length === 0 && <tr><td colSpan={3} className="sw-muted">No team members yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ─── Dates & bidding ─────────────────────────────────────────────────────────

export function RulesPanel({ series }: { series: AuctionSeries }) {
  const { busy, run } = useRun();
  const [f, setF] = React.useState({
    announceAt: localInput(series.announceAt),
    silentOpensAt: localInput(series.silentOpensAt),
    liveAt: localInput(series.liveAt),
    weekCount: String(series.weekCount),
    closeMode: series.closeMode,
    staggerSeconds: String(series.staggerSeconds),
    softCloseMinutes: String(series.softCloseMinutes),
    paymentWindowHours: String(series.paymentWindowHours),
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(saveSeriesAction(series.id, series.slug, {
          announceAt: toIso(f.announceAt),
          silentOpensAt: toIso(f.silentOpensAt),
          liveAt: toIso(f.liveAt),
          weekCount: Number(f.weekCount),
          closeMode: f.closeMode,
          staggerSeconds: Number(f.staggerSeconds),
          softCloseMinutes: Number(f.softCloseMinutes),
          paymentWindowHours: Number(f.paymentWindowHours),
        }), "Saved. Every lot in the series follows the new dates.");
      }}
      style={{ display: "flex", flexDirection: "column", gap: 20 }}
    >
      <section className="sw-card">
        <h2 className="sw-h2">Dates</h2>
        <div className="sw-grid cols-3">
          <div className="sw-field"><label htmlFor="r-ann" className="sw-label">Announce</label><input id="r-ann" type="datetime-local" className="sw-input" value={f.announceAt} onChange={set("announceAt")} /><span className="sw-hint">The page goes public; lots stay hidden.</span></div>
          <div className="sw-field"><label htmlFor="r-sil" className="sw-label">Bidding opens</label><input id="r-sil" type="datetime-local" className="sw-input" value={f.silentOpensAt} onChange={set("silentOpensAt")} /><span className="sw-hint">Silent bidding on every lot.</span></div>
          <div className="sw-field"><label htmlFor="r-live" className="sw-label">Live close</label><input id="r-live" type="datetime-local" className="sw-input" value={f.liveAt} onChange={set("liveAt")} /><span className="sw-hint">Lots close from this time.</span></div>
        </div>
      </section>
      <section className="sw-card">
        <h2 className="sw-h2">Bidding</h2>
        <div className="sw-grid cols-5">
          <div className="sw-field"><label htmlFor="r-weeks" className="sw-label">Weeks</label><input id="r-weeks" type="number" min={1} max={12} className="sw-input" value={f.weekCount} onChange={set("weekCount")} /></div>
          <div className="sw-field">
            <label htmlFor="r-close" className="sw-label">Close</label>
            <select id="r-close" className="sw-select" value={f.closeMode} onChange={set("closeMode")}>
              <option value="staggered">Staggered by lot</option>
              <option value="single">All at once</option>
            </select>
          </div>
          <div className="sw-field"><label htmlFor="r-stag" className="sw-label">Stagger (s)</label><input id="r-stag" type="number" min={10} className="sw-input" value={f.staggerSeconds} onChange={set("staggerSeconds")} /></div>
          <div className="sw-field"><label htmlFor="r-soft" className="sw-label">Soft close (min)</label><input id="r-soft" type="number" min={0} className="sw-input" value={f.softCloseMinutes} onChange={set("softCloseMinutes")} /></div>
          <div className="sw-field"><label htmlFor="r-pay" className="sw-label">Pay within (h)</label><input id="r-pay" type="number" min={1} className="sw-input" value={f.paymentWindowHours} onChange={set("paymentWindowHours")} /></div>
        </div>
      </section>
      <div><button type="submit" className="sw-btn" disabled={busy}>{busy ? "Saving…" : "Save"}</button></div>
    </form>
  );
}

// ─── Lots & artworks ─────────────────────────────────────────────────────────

const LOT_TONE: Record<string, { label: string; tone: string }> = {
  scheduled: { label: "Scheduled", tone: "is-accent" },
  live: { label: "Bidding", tone: "is-ok" },
  sold: { label: "Sold", tone: "is-plain" },
  passed: { label: "Passed", tone: "is-bad" },
  cancelled: { label: "Withdrawn", tone: "is-bad" },
};

export function LotsBoard({ series, lots, unassigned }: {
  series: AuctionSeries;
  lots: SeriesLot[];
  unassigned: Array<{ id: string; title: string; artistName: string | null; endAt: string }>;
}) {
  const { busy, run } = useRun();
  const [order, setOrder] = React.useState(lots.map((l) => l.id));
  const [filter, setFilter] = React.useState<"all" | "open" | "noimage" | "closed">("all");
  const [attachOpen, setAttachOpen] = React.useState(false);
  const [pick, setPick] = React.useState("");
  React.useEffect(() => setOrder(lots.map((l) => l.id)), [lots]);
  const byId = new Map(lots.map((l) => [l.id, l]));
  const changed = order.join() !== lots.map((l) => l.id).join();
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j]!, next[i]!];
    setOrder(next);
  };
  const visible = order.filter((id) => {
    const l = byId.get(id);
    if (!l) return false;
    if (filter === "open") return l.status === "scheduled" || l.status === "live";
    if (filter === "noimage") return !l.imageUrl;
    if (filter === "closed") return !(l.status === "scheduled" || l.status === "live");
    return true;
  });
  const counts = {
    all: lots.length,
    open: lots.filter((l) => l.status === "scheduled" || l.status === "live").length,
    noimage: lots.filter((l) => !l.imageUrl).length,
    closed: lots.filter((l) => !(l.status === "scheduled" || l.status === "live")).length,
  };
  return (
    <>
      <div className="sw-grid cols-4">
        <div className="sw-stat"><div className="sw-stat-label">Lots</div><div className="sw-stat-value">{lots.length}</div></div>
        <div className="sw-stat"><div className="sw-stat-label">Open for bids</div><div className="sw-stat-value">{counts.open}</div></div>
        <div className="sw-stat"><div className="sw-stat-label">Bids</div><div className="sw-stat-value">{lots.reduce((n, l) => n + l.bidCount, 0)}</div></div>
        <div className="sw-stat"><div className="sw-stat-label">High bids total</div><div className="sw-stat-value">{money(lots.reduce((n, l) => n + (l.currentBidMinor ?? 0), 0))}</div></div>
      </div>
      <div className="sw-head">
        <div className="sw-filters" role="group" aria-label="Filter lots">
          {([["all", "All"], ["open", "Open"], ["noimage", "No image"], ["closed", "Closed"]] as const).map(([k, label]) => (
            <button key={k} type="button" className="sw-filter" aria-pressed={filter === k} onClick={() => setFilter(k)}>{label} ({counts[k]})</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {changed && <button type="button" className="sw-btn is-outline" disabled={busy} onClick={() => run(renumberLotsAction(series.id, series.slug, order), "Lot order saved.")}>Save lot order</button>}
          <button type="button" className="sw-btn is-quiet" onClick={() => setAttachOpen(true)}>Add an artist&rsquo;s own lot</button>
          <Link href={`/series/${series.slug}/manage/lots/new`} className="sw-btn">+ Add a lot</Link>
        </div>
      </div>
      <div className="sw-table-wrap">
        <table className="sw-table" style={{ minWidth: 860 }}>
          <thead>
            <tr><th>#</th><th>Lot</th><th>Status</th><th className="is-num">Estimate</th><th className="is-num">Current</th><th>Closes</th><th /></tr>
          </thead>
          <tbody>
            {visible.map((id) => {
              const l = byId.get(id)!;
              const i = order.indexOf(id);
              const st = LOT_TONE[l.status] ?? { label: l.status, tone: "is-plain" };
              return (
                <tr key={id} className={!l.imageUrl ? "is-highlight" : undefined}>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <span style={{ fontWeight: 600, marginRight: 6 }}>{i + 1}</span>
                    <button type="button" className="sw-link" aria-label={`Move ${l.title} up`} onClick={() => move(i, -1)}>↑</button>{" "}
                    <button type="button" className="sw-link" aria-label={`Move ${l.title} down`} onClick={() => move(i, 1)}>↓</button>
                  </td>
                  <td>
                    <div className="sw-cell-art">
                      {l.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={l.imageUrl} alt="" className="sw-thumb" />
                      ) : (
                        <span className="sw-thumb" title="No image" />
                      )}
                      <span>
                        <strong>{l.title}</strong>
                        <div className="sw-muted">{l.artistName ?? "No artist named"}{!l.imageUrl ? " · no image" : ""}</div>
                      </span>
                    </div>
                  </td>
                  <td><span className={`sw-pill ${st.tone}`}>{st.label}</span></td>
                  <td className="is-num">{l.estimateLowMinor || l.estimateHighMinor ? `${money(l.estimateLowMinor, l.currency)}–${money(l.estimateHighMinor, l.currency)}` : "—"}</td>
                  <td className="is-num">{money(l.currentBidMinor ?? l.startingBidMinor, l.currency)}<div className="sw-muted sw-small">{l.bidCount} bid{l.bidCount === 1 ? "" : "s"}{l.leaderPaddle ? ` · ${l.leaderPaddle}` : ""}</div></td>
                  <td className="sw-muted">{when(l.endAt)}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <a href={`/lots/${l.id}`} target="_blank" rel="noopener">View</a>{" · "}
                    <button type="button" className="sw-link is-danger" disabled={busy}
                      onClick={() => window.confirm(`Take "${l.title}" out of the series? The lot stays open in the market.`) && run(removeLotAction(series.id, series.slug, l.id))}>
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr><td colSpan={7} className="sw-muted" style={{ textAlign: "center", padding: 28 }}>
                {lots.length === 0 ? <>No lots yet. <Link href={`/series/${series.slug}/manage/lots/new`}>Add the first lot</Link>.</> : "No lots match this filter."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="sw-hint">Lot order is the order of the staggered close. Highlighted rows have no image.</p>

      <Dialog open={attachOpen} onClose={() => setAttachOpen(false)} title="Add an artist's own lot">
        <p className="sw-muted" style={{ margin: 0 }}>Artists with their own store can put a piece up for auction from My art; open lots that are in no series are listed here.</p>
        <div className="sw-field">
          <label htmlFor="attach-lot" className="sw-label">Open lot</label>
          <select id="attach-lot" className="sw-select" value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">Choose…</option>
            {unassigned.map((u) => <option key={u.id} value={u.id}>{u.title}{u.artistName ? ` — ${u.artistName}` : ""}</option>)}
          </select>
          {unassigned.length === 0 && <span className="sw-hint">There are no open lots outside a series.</span>}
        </div>
        <div className="sw-dialog-foot">
          <button type="button" className="sw-btn" disabled={busy || !pick}
            onClick={async () => { if (await run(attachOpenLotAction(series.id, series.slug, pick), "Lot added to the series.")) { setPick(""); setAttachOpen(false); } }}>
            Add to series
          </button>
        </div>
      </Dialog>
    </>
  );
}

// ─── Add a lot ───────────────────────────────────────────────────────────────

type ArtistChoice = { kind: "account"; person: SeriesPerson } | { kind: "name"; name: string };

export function AddLotForm({ series, presenterName, storeReady, nextLotNumber }: {
  series: AuctionSeries;
  presenterName: string;
  storeReady: boolean;
  nextLotNumber: number;
}) {
  const router = useRouter();
  const [artist, setArtist] = React.useState<ArtistChoice | null>(null);
  const [proceeds, setProceeds] = React.useState<"artist" | "donated">("artist");
  const [images, setImages] = React.useState<UploadedImage[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const [description, setDescription] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [preview, setPreview] = React.useState({ title: "", estLow: "", estHigh: "", week: "", lotNumber: String(nextLotNumber) });
  const formRef = React.useRef<HTMLFormElement>(null);
  const needsDates = !series.liveAt;
  // Where the piece comes from: a new piece (uploaded or picked from a
  // library), or one of the artist's existing listings in the marketplace.
  const [source, setSource] = React.useState<"new" | "listing">("new");
  const [listing, setListing] = React.useState<ArtistListing | null>(null);
  const [listings, setListings] = React.useState<ArtistListing[] | null>(null);
  const [libraryOpen, setLibraryOpen] = React.useState(false);
  const artistUserId = artist?.kind === "account" ? artist.person.id : null;
  React.useEffect(() => {
    setListings(null);
    setListing(null);
    if (!artistUserId) { setSource("new"); return; }
    let live = true;
    listArtistListingsAction(series.id, series.slug, artistUserId).then((r) => live && setListings(r)).catch(() => live && setListings([]));
    return () => { live = false; };
  }, [artistUserId, series.id, series.slug]);

  async function submit(again: boolean) {
    const form = formRef.current;
    if (!form || !form.reportValidity()) return;
    if (!artist) return toast.error("Choose the artist, or add them by name.");
    if (source === "new" && uploading) return toast.error("Still uploading an image.");
    if (source === "new" && images.length === 0) return toast.error("Add at least one image.");
    const fd = new FormData(form);
    const s = (k: string) => String(fd.get(k) ?? "");
    setBusy(true);
    if (needsDates) {
      const dates = await saveSeriesAction(series.id, series.slug, { silentOpensAt: toIso(s("silentOpensAt")), liveAt: toIso(s("liveAt")) });
      if (!dates.ok) { setBusy(false); return toast.error(dates.error ?? "Could not save the dates."); }
    }
    if (source === "listing") {
      if (!listing) { setBusy(false); return toast.error("Choose one of the artist's listings."); }
      const r = await addListingAction(series.id, series.slug, {
        artworkId: listing.id,
        startingBid: Number(s("start")),
        reserve: numOrNull(s("reserve")),
        buyNow: numOrNull(s("buyNow")),
        weekNo: numOrNull(s("week")),
        lotNumber: numOrNull(s("lotNumber")),
      });
      setBusy(false);
      if (!r.ok) return toast.error(r.error ?? "Could not add the lot.");
      toast.success("Lot added from the artist's listing.");
      if (again) { form.reset(); setListing(null); setArtist(null); router.refresh(); }
      else { router.push(`/series/${series.slug}/manage/lots`); router.refresh(); }
      return;
    }
    const r = await addLotAction(series.id, series.slug, {
      artist: artist.kind === "account" ? { userId: artist.person.id } : { name: artist.name },
      proceeds,
      title: s("title"),
      descriptionHtml: description || null,
      yearCreated: numOrNull(s("year")),
      medium: s("medium") || null,
      heightCm: numOrNull(s("height")),
      widthCm: numOrNull(s("width")),
      depthCm: numOrNull(s("depth")),
      images: images.map((img) => ({ url: img.url, nextcloudFileId: img.nextcloudFileId ?? null, nextcloudPath: img.path ?? null })),
      estimateLow: numOrNull(s("estLow")),
      estimateHigh: numOrNull(s("estHigh")),
      startingBid: Number(s("start")),
      reserve: numOrNull(s("reserve")),
      buyNow: numOrNull(s("buyNow")),
      weekNo: numOrNull(s("week")),
      lotNumber: numOrNull(s("lotNumber")),
    });
    setBusy(false);
    if (!r.ok) return toast.error(r.error ?? "Could not add the lot.");
    toast.success("Lot added.");
    if (again) {
      form.reset();
      setImages([]);
      setDescription("");
      setArtist(null);
      setPreview({ title: "", estLow: "", estHigh: "", week: "", lotNumber: String(Number(preview.lotNumber || nextLotNumber) + 1) });
      router.refresh();
    } else {
      router.push(`/series/${series.slug}/manage/lots`);
      router.refresh();
    }
  }

  if (!storeReady) {
    return (
      <p className="sw-card">
        {presenterName} has no active store in this marketplace yet. An owner of {presenterName} opens it from My art (&ldquo;Open a store&rdquo;); lots can then be added here.
      </p>
    );
  }

  const cover = source === "listing" ? (listing?.imageUrl ?? null) : (images[0]?.url ?? null);
  const artistName = artist ? (artist.kind === "account" ? artist.person.name : artist.name) : "[Artist]";
  const onField = (k: keyof typeof preview) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setPreview({ ...preview, [k]: e.target.value });

  return (
    <form ref={formRef} onSubmit={(e) => { e.preventDefault(); submit(false); }} style={{ display: "flex", flexWrap: "wrap", gap: 28 }}>
      <div style={{ flex: "999 1 560px", minWidth: 0, display: "flex", flexDirection: "column", gap: 20 }}>
        {needsDates && (
          <section className="sw-card" style={{ borderColor: "#e8c99a", background: "#fffaf0" }}>
            <h2 className="sw-h2">The series&rsquo; dates</h2>
            <p className="sw-muted" style={{ margin: "0 0 12px" }}>Each lot opens with silent bidding and closes at the live close. Set them once here; change them later under Dates &amp; bidding.</p>
            <div className="sw-grid cols-2">
              <div className="sw-field"><label htmlFor="d-sil" className="sw-label">Bidding opens</label><input id="d-sil" name="silentOpensAt" type="datetime-local" className="sw-input" required /></div>
              <div className="sw-field"><label htmlFor="d-live" className="sw-label">Live close</label><input id="d-live" name="liveAt" type="datetime-local" className="sw-input" required /></div>
            </div>
          </section>
        )}

        <section className="sw-card">
          <h2 className="sw-h2" style={{ marginBottom: 4 }}>Artist</h2>
          <p className="sw-muted" style={{ margin: "0 0 12px" }}>The piece is listed under the artist&rsquo;s name and their market profile. Proceeds follow the choice below.</p>
          {artist ? (
            <div className="sw-chosen">
              <span>
                <strong>{artistName}</strong>{" "}
                <span className="sw-muted">
                  {artist.kind === "account"
                    ? `${artist.person.username ? "@" + artist.person.username : ""}${artist.person.email ? " · " + artist.person.email : ""}`
                    : "not on the network yet"}
                </span>
              </span>
              <button type="button" className="sw-link" onClick={() => setArtist(null)}>Change</button>
            </div>
          ) : (
            <PersonPicker
              seriesId={series.id}
              slug={series.slug}
              id="lot-artist"
              label="Search by name, username or email"
              onPick={(p) => setArtist({ kind: "account", person: p })}
              onCreate={(name) => name && setArtist({ kind: "name", name })}
              createHint={`Their name is shown on the lot; ${presenterName} receives the sale and pays them.`}
            />
          )}
          <fieldset style={{ border: 0, padding: 0, margin: "16px 0 0", display: "flex", flexDirection: "column", gap: 8 }}>
            <legend className="sw-label" style={{ marginBottom: 6 }}>Proceeds</legend>
            <label className="sw-check">
              <input type="radio" name="proceeds" checked={proceeds === "artist"} onChange={() => setProceeds("artist")} />
              <span><strong>To the artist</strong> <span className="sw-muted">({artist?.kind === "name" ? `paid by ${presenterName} by hand` : "held until paid out; no Stripe account needed"})</span></span>
            </label>
            <label className="sw-check">
              <input type="radio" name="proceeds" checked={proceeds === "donated"} onChange={() => setProceeds("donated")} />
              <span><strong>Donated: all to {presenterName}</strong> <span className="sw-muted">(the artist is credited)</span></span>
            </label>
          </fieldset>
        </section>

        <section className="sw-card">
          <h2 className="sw-h2">The piece</h2>
          {artistUserId && (
            <div className="sw-seg" role="group" aria-label="Where the piece comes from" style={{ maxWidth: 520, marginBottom: 16 }}>
              <button type="button" aria-pressed={source === "new"} onClick={() => setSource("new")}>A new piece</button>
              <button type="button" aria-pressed={source === "listing"} onClick={() => setSource("listing")}>
                One of the artist&rsquo;s listings{listings ? ` (${listings.length})` : ""}
              </button>
            </div>
          )}
          {source === "listing" ? (
            <div>
              {listings === null ? <p className="sw-muted">Loading the artist&rsquo;s listings…</p>
              : listings.length === 0 ? <p className="sw-muted">This artist has no listings in the marketplace yet. Add a new piece instead.</p>
              : (
                <ul className="sw-items" style={{ maxHeight: 420, overflowY: "auto" }}>
                  {listings.map((l) => (
                    <li key={l.id} style={{ alignItems: "center" }}>
                      <label className="sw-check" style={{ alignItems: "center", width: "100%", cursor: l.atAuction ? "default" : "pointer" }}>
                        <input type="radio" name="listing" disabled={l.atAuction} checked={listing?.id === l.id} onChange={() => { setListing(l); setPreview({ ...preview, title: l.title }); }} />
                        {l.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={l.imageUrl} alt="" className="sw-thumb" />
                        ) : <span className="sw-thumb" />}
                        <span>
                          <strong>{l.title}</strong>
                          <span className="sw-muted sw-small" style={{ display: "block" }}>
                            {l.status === "draft" ? "draft, published when added" : "listed"}{l.priceMinor ? ` · ${money(l.priceMinor, l.currency ?? "CAD")}` : ""}{l.storeName ? ` · ${l.storeName}` : ""}{l.atAuction ? " · already at auction" : ""}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              <p className="sw-hint" style={{ marginTop: 8 }}>The lot stays on the artist&rsquo;s own store: they are paid as for any sale of theirs and can withdraw it from My art.</p>
            </div>
          ) : (
          <>
          <div style={{ marginBottom: 16 }}>
            <MultiImageUploader value={images} onChange={setImages} uploadEndpoint="/api/upload" maxImages={12} onBusyChange={setUploading} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginTop: 8 }}>
              <button type="button" className="sw-btn is-small is-outline" onClick={() => setLibraryOpen(true)}>Choose from a library…</button>
              <span className="sw-hint">The first image is the cover; drag to reorder. Libraries: the organisations&rsquo; Nextcloud folders{artistUserId ? " and the artist's files" : ""}.</span>
            </div>
          </div>
          <div className="sw-grid cols-2">
            <div className="sw-field"><label htmlFor="l-title" className="sw-label">Title</label><input id="l-title" name="title" className="sw-input" required={source === "new"} onChange={onField("title")} /></div>
            <div className="sw-field"><label htmlFor="l-year" className="sw-label">Year</label><input id="l-year" name="year" type="number" min={1000} max={2100} className="sw-input" /></div>
            <div className="sw-field"><label htmlFor="l-medium" className="sw-label">Medium</label><input id="l-medium" name="medium" className="sw-input" placeholder="Oil on canvas" /></div>
            <div className="sw-field">
              <span className="sw-label">Size (cm)</span>
              <span style={{ display: "flex", gap: 6 }}>
                <input aria-label="Height in cm" name="height" type="number" step="0.1" min={0} className="sw-input" placeholder="H" />
                <input aria-label="Width in cm" name="width" type="number" step="0.1" min={0} className="sw-input" placeholder="W" />
                <input aria-label="Depth in cm" name="depth" type="number" step="0.1" min={0} className="sw-input" placeholder="D" />
              </span>
            </div>
          </div>
          <div className="sw-field" style={{ marginTop: 12 }}>
            <span className="sw-label">About the piece</span>
            <RichTextEditor value={description} onChange={setDescription} placeholder="The artist's statement, provenance, framing…" minHeight={110} ariaLabel="About the piece" />
          </div>
          </>
          )}
        </section>

        <section className="sw-card">
          <h2 className="sw-h2">Lot</h2>
          <div className="sw-grid cols-4">
            {source === "new" && <div className="sw-field"><label htmlFor="l-est-lo" className="sw-label">Estimate low ($)</label><input id="l-est-lo" name="estLow" type="number" min={0} className="sw-input" onChange={onField("estLow")} /></div>}
            {source === "new" && <div className="sw-field"><label htmlFor="l-est-hi" className="sw-label">Estimate high ($)</label><input id="l-est-hi" name="estHigh" type="number" min={0} className="sw-input" onChange={onField("estHigh")} /></div>}
            <div className="sw-field"><label htmlFor="l-start" className="sw-label">Starting bid ($)</label><input id="l-start" name="start" type="number" min={1} className="sw-input" required /></div>
            <div className="sw-field"><label htmlFor="l-res" className="sw-label">Reserve ($, hidden)</label><input id="l-res" name="reserve" type="number" min={0} className="sw-input" /></div>
            <div className="sw-field"><label htmlFor="l-buy" className="sw-label">Buy now ($)</label><input id="l-buy" name="buyNow" type="number" min={0} className="sw-input" placeholder="optional" /></div>
            <div className="sw-field">
              <label htmlFor="l-week" className="sw-label">Featured in week</label>
              <select id="l-week" name="week" className="sw-select" defaultValue="" onChange={onField("week")}>
                <option value="">None</option>
                {Array.from({ length: series.weekCount }, (_, i) => <option key={i + 1} value={i + 1}>Week {i + 1}</option>)}
              </select>
            </div>
            <div className="sw-field"><label htmlFor="l-num" className="sw-label">Lot number</label><input id="l-num" name="lotNumber" type="number" min={1} className="sw-input" defaultValue={nextLotNumber} onChange={onField("lotNumber")} /></div>
          </div>
          <p className="sw-hint" style={{ marginTop: 12 }}>Opens with silent bidding, closes at the live close{series.closeMode === "staggered" ? ` in lot order, ${series.staggerSeconds} s apart` : ""}.</p>
        </section>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="submit" className="sw-btn" disabled={busy || uploading}>{busy ? "Saving…" : "Save lot"}</button>
          <button type="button" className="sw-btn is-outline" disabled={busy || uploading} onClick={() => submit(true)}>Save and add another</button>
          <Link href={`/series/${series.slug}/manage/lots`} className="sw-btn is-quiet">Cancel</Link>
        </div>
      </div>

      <aside style={{ flex: "1 1 300px", display: "flex", flexDirection: "column", gap: 16, alignSelf: "flex-start", position: "sticky", top: 16 }}>
        <div className="sw-card is-flush">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" style={{ width: "100%", aspectRatio: "4 / 5", objectFit: "cover", display: "block" }} />
          ) : (
            <div style={{ aspectRatio: "4 / 5", background: "#e5e0d6", display: "flex", alignItems: "center", justifyContent: "center", color: "#5e5a53" }}>Cover image</div>
          )}
          <div style={{ padding: 14 }}>
            <div className="sw-small sw-muted">Lot {preview.lotNumber || "–"}{preview.week ? ` · Week ${preview.week}` : ""}</div>
            <div style={{ fontFamily: "var(--sw-serif)", fontSize: 20 }}>{preview.title || "[Title]"}</div>
            <div>{artistName}</div>
            <div className="sw-muted" style={{ marginTop: 6 }}>Estimate {preview.estLow ? `$${preview.estLow}` : "$—"} – {preview.estHigh ? `$${preview.estHigh}` : "$—"}</div>
          </div>
        </div>
        <div className="sw-card is-tint">
          <strong>When you save</strong>
          <ul className="sw-bullets" style={{ margin: "8px 0 0", paddingLeft: 18 }}>
            <li>The artwork is listed under the artist in {presenterName}&rsquo;s store, published, and added to this series.</li>
            <li>The artist gets a market page at /artists/&lt;username&gt; and sees the piece in My art.</li>
            <li>No Stripe account is needed to sell; the artist&rsquo;s share is held until paid out.</li>
          </ul>
        </div>
      </aside>
      <LibraryDialog
        series={series}
        artistUserId={artistUserId}
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onPick={(url, name) => setImages((cur) => (cur.some((i) => i.url === url) || cur.length >= 12 ? cur : [...cur, { url, name } as UploadedImage]))}
      />
    </form>
  );
}

/** Pick images from the Nextcloud folders open to this series (orgs taking part, the artist's own). */
function LibraryDialog({ series, artistUserId, open, onClose, onPick }: {
  series: AuctionSeries;
  artistUserId: string | null;
  open: boolean;
  onClose: () => void;
  onPick: (url: string, name: string) => void;
}) {
  const [libraries, setLibraries] = React.useState<SeriesLibrary[] | null>(null);
  const [key, setKey] = React.useState<string | null>(null);
  const [items, setItems] = React.useState<Array<{ url: string; name: string }> | null>(null);
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  React.useEffect(() => {
    if (!open) return;
    let live = true;
    listLibrariesAction(series.id, series.slug, artistUserId).then((r) => { if (!live) return; setLibraries(r); setKey((k) => k ?? r[0]?.key ?? null); }).catch(() => live && setLibraries([]));
    return () => { live = false; };
  }, [open, series.id, series.slug, artistUserId]);
  React.useEffect(() => {
    if (!open || !key) return;
    let live = true;
    setItems(null);
    listLibraryItemsAction(series.id, series.slug, key).then((r) => live && setItems(r)).catch(() => live && setItems([]));
    return () => { live = false; };
  }, [open, key, series.id, series.slug]);
  return (
    <Dialog open={open} onClose={onClose} title="Choose from a library">
      {libraries === null ? <p className="sw-muted">Loading…</p> : libraries.length === 0 ? (
        <p className="sw-muted">No libraries are open to this series yet. Organisations taking part (Organisations in the menu) open their media folders.</p>
      ) : (
        <>
          <div className="sw-filters" role="tablist" aria-label="Libraries">
            {libraries.map((l) => (
              <button key={l.key} type="button" role="tab" className="sw-filter" aria-pressed={key === l.key} onClick={() => setKey(l.key)}>{l.label}</button>
            ))}
          </div>
          {items === null ? <p className="sw-muted">Loading images…</p> : items.length === 0 ? (
            <p className="sw-muted">No images in this folder (Media/Images).</p>
          ) : (
            <div className="sw-thumbs" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))", maxHeight: 380, overflowY: "auto" }}>
              {items.map((it) => (
                <button key={it.url} type="button" title={it.name} aria-pressed={picked.has(it.url)}
                  style={{ padding: 0, border: picked.has(it.url) ? "3px solid var(--sw-accent)" : "3px solid transparent", borderRadius: 6, background: "none", cursor: "pointer" }}
                  onClick={() => { onPick(it.url, it.name); setPicked((p) => new Set(p).add(it.url)); }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={it.url} alt={it.name} loading="lazy" style={{ aspectRatio: "1", width: "100%", objectFit: "cover", borderRadius: 4, display: "block" }} />
                </button>
              ))}
            </div>
          )}
          <p className="sw-hint" style={{ margin: 0 }}>Click an image to add it to the piece. {picked.size > 0 ? `${picked.size} added.` : ""}</p>
        </>
      )}
      <div className="sw-dialog-foot"><button type="button" className="sw-btn" onClick={onClose}>Done</button></div>
    </Dialog>
  );
}

// ─── Weeks & content ─────────────────────────────────────────────────────────

const WEEK_PALETTE = ["#2F5D7C", "#9A5B2E", "#5B6B3A", "#8C1F3A", "#5B4A7A", "#3F3B35"];

export function RepostPicker({ series, mineOnly, onPick }: { series: AuctionSeries; mineOnly?: boolean; onPick: (t: WeekItemThread) => void }) {
  const [q, setQ] = React.useState("");
  const [hits, setHits] = React.useState<WeekItemThread[] | null>(null);
  React.useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      searchRepostableAction(series.id, series.slug, q, mineOnly).then((r) => live && setHits(r)).catch(() => live && setHits([]));
    }, 200);
    return () => { live = false; clearTimeout(t); };
  }, [q, series.id, series.slug, mineOnly]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="sw-field">
        <label htmlFor="repost-q" className="sw-label">{mineOnly ? "Your published pieces" : "Search public writing on the network"}</label>
        <input id="repost-q" className="sw-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Title or author" autoComplete="off" />
      </div>
      <ul className="sw-items" style={{ maxHeight: 320, overflowY: "auto" }}>
        {hits === null && <li className="sw-muted">Searching…</li>}
        {hits?.length === 0 && <li className="sw-muted">Nothing public matches.</li>}
        {hits?.map((t) => (
          <li key={t.id}>
            <span>
              <strong>{t.title}</strong>
              <span className="sw-muted sw-small" style={{ display: "block" }}>
                {t.kind === "writing" ? "Studio piece" : "Post"} · {t.authorName ?? "—"}{t.publishedAt ? ` · ${new Date(t.publishedAt).toLocaleDateString("en-CA")}` : ""}
              </span>
            </span>
            <button type="button" className="sw-btn is-small" onClick={() => onPick(t)}>Add</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

type ContentMode = null | "menu" | "repost" | "upload" | "announce" | "feature";

function WeekCard({ series, week, lots }: { series: AuctionSeries; week: WeekBoard; lots: SeriesLot[] }) {
  const { busy, run } = useRun();
  const [title, setTitle] = React.useState(/^Week \d+$/.test(week.title) ? "" : week.title);
  const [focus, setFocus] = React.useState(week.focus ?? "");
  const [question, setQuestion] = React.useState(week.question ?? "");
  const [brief, setBrief] = React.useState(week.brief ?? "");
  const [color, setColor] = React.useState(week.color ?? WEEK_PALETTE[(week.weekNo - 1) % WEEK_PALETTE.length]!);
  const [mode, setMode] = React.useState<ContentMode>(null);
  const [media, setMedia] = React.useState<{ url: string; kind: "image" | "video" } | null>(null);
  const [itemTitle, setItemTitle] = React.useState("");
  const [itemText, setItemText] = React.useState("");
  const [itemLink, setItemLink] = React.useState("");
  const [itemWhen, setItemWhen] = React.useState("");
  const [featured, setFeatured] = React.useState<string[]>(week.featured.map((f) => f.artworkId));
  const dirty =
    title !== (/^Week \d+$/.test(week.title) ? "" : week.title) || focus !== (week.focus ?? "") || question !== (week.question ?? "") ||
    brief !== (week.brief ?? "") || color !== (week.color ?? WEEK_PALETTE[(week.weekNo - 1) % WEEK_PALETTE.length]);

  const resetItem = () => { setMedia(null); setItemTitle(""); setItemText(""); setItemLink(""); setItemWhen(""); setMode(null); };
  const addItem = async (input: Parameters<typeof addWeekItemAction>[2]) => {
    if (await run(addWeekItemAction(series.id, series.slug, input), "Added to the week.")) resetItem();
  };

  return (
    <section className="sw-week" aria-label={`Week ${week.weekNo}`}>
      <div className="sw-week-band" style={{ background: color }} />
      <div className="sw-week-body">
        <div className="sw-head" style={{ alignItems: "center" }}>
          <span className="sw-eyebrow">Week {week.weekNo}</span>
          <span className="sw-swatches" role="group" aria-label="Week colour">
            {WEEK_PALETTE.map((c) => (
              <button key={c} type="button" className="sw-swatch" style={{ background: c }} aria-label={`Colour ${c}`} aria-pressed={color === c} onClick={() => setColor(c)} />
            ))}
          </span>
        </div>
        <div className="sw-field"><label className="sw-label" htmlFor={`w${week.weekNo}-t`}>Theme</label><input id={`w${week.weekNo}-t`} className="sw-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`Week ${week.weekNo} theme`} style={{ fontFamily: "var(--sw-serif)", fontSize: 18 }} /></div>
        <div className="sw-field"><label className="sw-label" htmlFor={`w${week.weekNo}-f`}>Focus</label><input id={`w${week.weekNo}-f`} className="sw-input" value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="What this week draws attention to" /></div>
        <div className="sw-field"><label className="sw-label" htmlFor={`w${week.weekNo}-q`}>Question for the week</label><input id={`w${week.weekNo}-q`} className="sw-input" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="A question visitors can answer" style={{ fontStyle: "italic" }} /></div>
        <div className="sw-field"><label className="sw-label" htmlFor={`w${week.weekNo}-b`}>Notes for the team</label><textarea id={`w${week.weekNo}-b`} className="sw-textarea" rows={2} value={brief} onChange={(e) => setBrief(e.target.value)} /></div>
        {dirty && (
          <button type="button" className="sw-btn" disabled={busy}
            onClick={() => run(saveWeekAction(series.id, series.slug, week.weekNo, { title: title || `Week ${week.weekNo}`, focus, question, brief, color }), `Week ${week.weekNo} saved.`)}>
            Save week {week.weekNo}
          </button>
        )}

        <div>
          <div className="sw-head" style={{ marginBottom: 6 }}>
            <span className="sw-small sw-muted">Featured lots ({week.featured.length})</span>
            <button type="button" className="sw-link sw-small" onClick={() => setMode("feature")}>Choose</button>
          </div>
          {week.featured.length > 0 ? (
            <div className="sw-thumbs">
              {week.featured.slice(0, 8).map((f) => f.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={f.artworkId} src={f.imageUrl} alt={f.title} title={f.title} />
              ) : <span key={f.artworkId} title={f.title} />)}
            </div>
          ) : <p className="sw-hint" style={{ margin: 0 }}>None yet.</p>}
        </div>

        <div>
          <div className="sw-small sw-muted" style={{ marginBottom: 6 }}>Content ({week.items.length})</div>
          {week.items.length > 0 && (
            <ul className="sw-items">
              {week.items.map((i) => (
                <li key={i.id}>
                  <span style={{ minWidth: 0 }}>
                    <strong>{i.kind === "article" ? "Article" : i.media?.kind === "video" ? "Video" : i.media ? "Image" : "Announcement"}</strong> · {i.title}
                    <span className="sw-small sw-muted" style={{ display: "block" }}>
                      {i.status === "submitted" ? "submitted, awaiting approval" : i.publishAt && new Date(i.publishAt).getTime() > Date.now() ? `scheduled ${when(i.publishAt)}` : "published"}
                      {i.addedByName ? ` · ${i.addedByName}` : ""}
                    </span>
                  </span>
                  <span style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    {i.status === "submitted" && <button type="button" className="sw-link" disabled={busy} onClick={() => run(approveWeekItemAction(series.id, series.slug, i.id), "Approved.")}>Approve</button>}
                    <button type="button" className="sw-link is-danger" disabled={busy} aria-label={`Remove ${i.title}`}
                      onClick={() => window.confirm(`Remove "${i.title}" from week ${week.weekNo}?`) && run(removeWeekItemAction(series.id, series.slug, i.id))}>
                      ✕
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <button type="button" className={mode === "menu" ? "sw-btn" : "sw-btn is-dashed"} aria-expanded={mode === "menu"} onClick={() => setMode(mode === "menu" ? null : "menu")}>+ Add content</button>
          {mode === "menu" && (
            <ul className="sw-menu" style={{ listStyle: "none" }}>
              <li><button type="button" onClick={() => setMode("repost")}><strong>Repost from the network</strong><small>An article or Studio piece from IFAC, the Studio or an artist&rsquo;s page</small></button></li>
              <li><a href={`${process.env.NEXT_PUBLIC_ARTS_COLLECTIVE_URL ?? ""}/studio?kind=writing`} target="_blank" rel="noopener" style={{ display: "block", padding: 10, color: "inherit", textDecoration: "none" }}><strong>Write a post</strong><small style={{ display: "block", color: "var(--sw-muted)", fontSize: 12 }}>Opens the Studio in a new tab; publish it, then repost it here</small></a></li>
              <li><button type="button" onClick={() => setMode("upload")}><strong>Upload image or video</strong><small>Shown in the series&rsquo; Articles section</small></button></li>
              <li><button type="button" onClick={() => setMode("feature")}><strong>Feature lots</strong><small>Pick lots to spotlight this week</small></button></li>
              <li><button type="button" onClick={() => setMode("announce")}><strong>Announcement</strong><small>A short note, with an optional link</small></button></li>
            </ul>
          )}
        </div>
      </div>

      <Dialog open={mode === "repost"} onClose={() => setMode(null)} title={`Repost into week ${week.weekNo}`}>
        <RepostPicker series={series} onPick={(t) => addItem({ weekNo: week.weekNo, kind: "article", threadId: t.id })} />
      </Dialog>

      <Dialog open={mode === "upload" || mode === "announce"} onClose={resetItem} title={mode === "upload" ? `Image or video for week ${week.weekNo}` : `Announcement for week ${week.weekNo}`}>
        {mode === "upload" && (media ? (
          media.kind === "video"
            ? <video src={media.url} controls style={{ width: "100%", borderRadius: 8 }} />
            // eslint-disable-next-line @next/next/no-img-element
            : <img src={media.url} alt="" style={{ width: "100%", borderRadius: 8 }} />
        ) : (
          <MediaDrop seriesId={series.id} accept="image/*,video/mp4,video/webm" label="choose an image or video" onUploaded={(url, kind) => setMedia({ url, kind })} />
        ))}
        <div className="sw-field"><label htmlFor={`it-t${week.weekNo}`} className="sw-label">Title</label><input id={`it-t${week.weekNo}`} className="sw-input" value={itemTitle} onChange={(e) => setItemTitle(e.target.value)} /></div>
        <div className="sw-field"><label htmlFor={`it-x${week.weekNo}`} className="sw-label">Text</label><textarea id={`it-x${week.weekNo}`} className="sw-textarea" value={itemText} onChange={(e) => setItemText(e.target.value)} /></div>
        <div className="sw-grid cols-2">
          <div className="sw-field"><label htmlFor={`it-l${week.weekNo}`} className="sw-label">Link (optional)</label><input id={`it-l${week.weekNo}`} className="sw-input" value={itemLink} onChange={(e) => setItemLink(e.target.value)} placeholder="https://…" /></div>
          <div className="sw-field"><label htmlFor={`it-w${week.weekNo}`} className="sw-label">Publish at (optional)</label><input id={`it-w${week.weekNo}`} type="datetime-local" className="sw-input" value={itemWhen} onChange={(e) => setItemWhen(e.target.value)} /></div>
        </div>
        <div className="sw-dialog-foot">
          <button type="button" className="sw-btn" disabled={busy || (mode === "upload" && !media)}
            onClick={() => addItem({ weekNo: week.weekNo, kind: "announcement", title: itemTitle, text: itemText, media, link: itemLink || null, publishAt: toIso(itemWhen) })}>
            Add to week {week.weekNo}
          </button>
        </div>
      </Dialog>

      <Dialog open={mode === "feature"} onClose={() => setMode(null)} title={`Featured lots, week ${week.weekNo}`}>
        {lots.length === 0 ? <p className="sw-muted">No lots in the series yet.</p> : (
          <ul className="sw-items" style={{ maxHeight: 360, overflowY: "auto" }}>
            {lots.map((l) => (
              <li key={l.id}>
                <label className="sw-check" style={{ width: "100%" }}>
                  <input type="checkbox" checked={featured.includes(l.artworkId)}
                    onChange={(e) => setFeatured(e.target.checked ? [...featured, l.artworkId] : featured.filter((x) => x !== l.artworkId))} />
                  <span>Lot {l.lotNumber ?? "–"} · <strong>{l.title}</strong> <span className="sw-muted">{l.artistName ?? ""}</span></span>
                </label>
              </li>
            ))}
          </ul>
        )}
        <div className="sw-dialog-foot">
          <button type="button" className="sw-btn" disabled={busy}
            onClick={async () => { if (await run(setWeekFeaturedAction(series.id, series.slug, week.weekNo, featured), "Featured lots saved.")) setMode(null); }}>
            Save
          </button>
        </div>
      </Dialog>
    </section>
  );
}

export function WeeksBoard({ series, weeks, lots }: { series: AuctionSeries; weeks: WeekBoard[]; lots: SeriesLot[] }) {
  return (
    <div className="sw-weeks">
      {weeks.map((w) => <WeekCard key={w.weekNo} series={series} week={w} lots={lots} />)}
    </div>
  );
}

// ─── Page & look ─────────────────────────────────────────────────────────────

export function PageLookPanel({ series }: { series: AuctionSeries }) {
  const { busy, run } = useRun();
  const theme = (series.theme ?? {}) as SeriesTheme;
  const [hero, setHero] = React.useState<SeriesHero>(theme.hero ?? { kind: "image", url: "" });
  const [title, setTitle] = React.useState(series.title);
  const [subtitle, setSubtitle] = React.useState(series.subtitle ?? "");
  const [eyebrow, setEyebrow] = React.useState(series.card.eyebrow ?? "");
  const [description, setDescription] = React.useState(series.descriptionHtml ?? "");
  const [curator, setCurator] = React.useState({ name: theme.curator?.name ?? "", role: theme.curator?.role ?? "", portraitUrl: theme.curator?.portraitUrl ?? "" });
  const [proceedsNote, setProceedsNote] = React.useState(theme.proceedsNote ?? "");
  const [beneficiaryName, setBeneficiaryName] = React.useState(theme.beneficiaryName ?? "");
  const [journal, setJournal] = React.useState<JournalEntry[]>(theme.journal ?? []);
  const [blurb, setBlurb] = React.useState(series.card.blurb ?? "");
  const [cardImage, setCardImage] = React.useState(series.card.imageUrl ?? "");

  const save = () =>
    run(saveSeriesAction(series.id, series.slug, {
      title,
      subtitle: subtitle || null,
      descriptionHtml: description || null,
      card: { eyebrow: eyebrow || undefined, blurb: blurb || undefined, imageUrl: cardImage || undefined },
      theme: {
        ...series.theme,
        hero: hero.url ? hero : null,
        curator: curator.name ? curator : null,
        proceedsNote: proceedsNote || null,
        beneficiaryName: beneficiaryName || null,
        journal: journal.filter((j) => j.date && j.text.trim()),
      },
    }), "Saved. The series page shows the changes now.");

  const previewSeries: AuctionSeries = { ...series, title: title || series.title, subtitle: subtitle || null, card: { ...series.card, eyebrow } };
  const heroStill = hero.kind === "image" ? hero.url : hero.kind === "video" ? hero.poster ?? "" : "";

  return (
    <>
      <div className="sw-card is-tint" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
        <span>You can also edit on the series page itself: signed in as an editor, the page shows Change cover, Edit text, Add artwork and Add article.</span>
        <a href={`/series/${series.slug}`} className="sw-btn">Edit on the page</a>
      </div>

      <section aria-label="Hero preview">
        <p className="sw-eyebrow" style={{ margin: "0 0 8px" }}>Preview · the top of the series page as you edit</p>
        <div className="sw-preview srs">
          <SrsHero series={previewSeries} hero={hero.url ? hero : null} curator={curator.name ? curator : null} compact />
        </div>
      </section>

      <form onSubmit={(e) => { e.preventDefault(); save(); }} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <section className="sw-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <h2 className="sw-h2" style={{ margin: 0 }}>Cover</h2>
          <div className="sw-seg" role="group" aria-label="Cover type" style={{ maxWidth: 420 }}>
            {(["image", "video", "embed"] as const).map((k) => (
              <button key={k} type="button" aria-pressed={hero.kind === k} onClick={() => setHero({ kind: k, url: hero.kind === k ? hero.url : "" })}>
                {k === "image" ? "Image" : k === "video" ? "Uploaded video" : "YouTube / Vimeo"}
              </button>
            ))}
          </div>
          {hero.kind === "embed" ? (
            <div className="sw-field"><label htmlFor="hero-embed" className="sw-label">Video link</label><input id="hero-embed" className="sw-input" value={hero.url} onChange={(e) => setHero({ ...hero, url: e.target.value })} placeholder="https://www.youtube.com/watch?v=…" /><span className="sw-hint">Plays muted behind the title.</span></div>
          ) : (
            <div className="sw-grid cols-2">
              <MediaDrop seriesId={series.id} accept={hero.kind === "video" ? "video/mp4,video/webm" : "image/*"} label={hero.kind === "video" ? "choose a video (mp4 or webm, up to 250 MB)" : "choose an image"} onUploaded={(url) => setHero({ ...hero, url })} />
              {hero.kind === "video" ? (
                <div className="sw-field"><span className="sw-label">Poster image (before the video plays)</span><MediaDrop seriesId={series.id} accept="image/*" label="choose an image" onUploaded={(url) => setHero({ ...hero, poster: url })} /></div>
              ) : <span className="sw-hint" style={{ alignSelf: "center" }}>A wide image (16:9 or wider) works best.</span>}
            </div>
          )}
          {hero.url && <div><button type="button" className="sw-link is-danger" onClick={() => setHero({ kind: hero.kind, url: "" })}>Remove the cover</button></div>}
        </section>

        <section className="sw-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <h2 className="sw-h2" style={{ margin: 0 }}>Title</h2>
          <div className="sw-grid cols-2">
            <div className="sw-field"><label htmlFor="pl-title" className="sw-label">Series name</label><input id="pl-title" className="sw-input" value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
            <div className="sw-field"><label htmlFor="pl-eye" className="sw-label">Line above the name</label><input id="pl-eye" className="sw-input" value={eyebrow} onChange={(e) => setEyebrow(e.target.value)} placeholder="Auction Series 1" /></div>
            <div className="sw-field"><label htmlFor="pl-sub" className="sw-label">Subtitle (when there is no curator)</label><input id="pl-sub" className="sw-input" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} /></div>
          </div>
        </section>

        <section className="sw-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <h2 className="sw-h2" style={{ margin: 0 }}>From the curator</h2>
          <div className="sw-grid cols-3">
            <div className="sw-field"><label htmlFor="pl-cn" className="sw-label">Curator</label><input id="pl-cn" className="sw-input" value={curator.name} onChange={(e) => setCurator({ ...curator, name: e.target.value })} /></div>
            <div className="sw-field"><label htmlFor="pl-cr" className="sw-label">Role</label><input id="pl-cr" className="sw-input" value={curator.role} onChange={(e) => setCurator({ ...curator, role: e.target.value })} /></div>
            <div className="sw-field"><span className="sw-label">Portrait</span>
              {curator.portraitUrl
                ? <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={curator.portraitUrl} alt="" style={{ width: 44, height: 56, objectFit: "cover", borderRadius: 4 }} />
                    <button type="button" className="sw-link" onClick={() => setCurator({ ...curator, portraitUrl: "" })}>Remove</button>
                  </span>
                : <MediaDrop seriesId={series.id} accept="image/*" label="choose" onUploaded={(url) => setCurator({ ...curator, portraitUrl: url })} />}
            </div>
          </div>
          <div className="sw-field">
            <span className="sw-label">Write-up</span>
            <RichTextEditor value={description} onChange={setDescription} placeholder="What the series brings together, how the works were chosen, what to look for…" minHeight={200} ariaLabel="Write-up" />
          </div>
        </section>

        <section className="sw-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <h2 className="sw-h2" style={{ margin: 0 }}>Where the money goes</h2>
          <p className="sw-muted" style={{ margin: 0 }}>The split itself comes from the marketplace commission; this adds the words around it.</p>
          <div className="sw-grid cols-2">
            <div className="sw-field"><label htmlFor="pl-pn" className="sw-label">Note</label><textarea id="pl-pn" className="sw-textarea" value={proceedsNote} onChange={(e) => setProceedsNote(e.target.value)} placeholder="What the auction supports" /></div>
            <div className="sw-field"><label htmlFor="pl-bn" className="sw-label">Beneficiary (optional)</label><input id="pl-bn" className="sw-input" value={beneficiaryName} onChange={(e) => setBeneficiaryName(e.target.value)} /></div>
          </div>
        </section>

        <section className="sw-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="sw-head"><h2 className="sw-h2" style={{ margin: 0 }}>Series journal</h2>
            <button type="button" className="sw-btn is-small is-outline" onClick={() => setJournal([{ date: new Date().toISOString().slice(0, 10), text: "" }, ...journal])}>+ Entry</button></div>
          {journal.length === 0 && <p className="sw-hint" style={{ margin: 0 }}>Short dated notes on how the series is going. The section is hidden until there is one.</p>}
          {journal.map((j, idx) => (
            <div key={idx} style={{ display: "grid", gridTemplateColumns: "160px minmax(0,1fr) auto", gap: 8, alignItems: "center" }}>
              <input aria-label="Date" type="date" className="sw-input" value={j.date.slice(0, 10)} onChange={(e) => setJournal(journal.map((x, i) => (i === idx ? { ...x, date: e.target.value } : x)))} />
              <input aria-label="Entry" className="sw-input" value={j.text} onChange={(e) => setJournal(journal.map((x, i) => (i === idx ? { ...x, text: e.target.value } : x)))} />
              <button type="button" className="sw-link is-danger" onClick={() => setJournal(journal.filter((_, i) => i !== idx))}>Remove</button>
            </div>
          ))}
        </section>

        <section className="sw-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <h2 className="sw-h2" style={{ margin: 0 }}>Card on the marketplace home</h2>
          <div className="sw-grid cols-2">
            <div className="sw-field"><label htmlFor="pl-blurb" className="sw-label">One line</label><input id="pl-blurb" className="sw-input" value={blurb} onChange={(e) => setBlurb(e.target.value)} /></div>
            <div className="sw-field"><span className="sw-label">Card image</span>
              <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {cardImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cardImage} alt="" style={{ width: 44, height: 56, objectFit: "cover", borderRadius: 4 }} />
                )}
                {heroStill && heroStill !== cardImage && <button type="button" className="sw-btn is-small is-quiet" onClick={() => setCardImage(heroStill)}>Use the cover</button>}
                {cardImage && <button type="button" className="sw-link is-danger" onClick={() => setCardImage("")}>Remove</button>}
              </span>
              <MediaDrop seriesId={series.id} accept="image/*" label="choose a card image" onUploaded={(url) => setCardImage(url)} />
            </div>
          </div>
        </section>

        <div style={{ position: "sticky", bottom: 0, padding: "12px 0", background: "var(--sw-ground)", borderTop: "1px solid var(--sw-line)", display: "flex", gap: 8 }}>
          <button type="submit" className="sw-btn" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
          <a href={`/series/${series.slug}`} className="sw-btn is-quiet">Open the page</a>
        </div>
      </form>
    </>
  );
}
