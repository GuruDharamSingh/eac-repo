"use client";

// ============================================================================
// The Content card's round 2 popup (Justin's approved design, 2026-11-26): ONE dark popup holding a stack of frames.
//   list   Artworks: search (with suggestions), the scope toggle, Kind, Sort, large tiles, the rail (Store, Sale, Status)
//   piece  the piece: picture, facts, and a foot with Hide / Show, Edit and Open on the site
//   edit   the host's own form (host.renderEdit), drawn inside the same popup; saving pops back to the piece
// Self-contained: it needs no SurfaceProvider. It wears the site's tokens through the --sf-* / --ec-* names, but
// `.eac-c-hubdark` (content.css) pins the dark colours of the design, so a site page is never touched.
// ============================================================================

import * as React from "react";
import type { HubCardHost, HubCardProps } from "@elkdonis/hub/contract";
import type { HubCardHostExtras } from "@elkdonis/hub/mount";
import type { ContentListItem, ContentStatus, ContentType } from "../model";
import type { ContentQuery, ContentSaleState, ContentScope } from "../search-types";
import { contentQueryParams } from "../query-string";
import { STATUS_WORD } from "../registry";
import { SALE_WORD } from "../ui/library/badges";
import { SuggestSearch, type SuggestPiece } from "../ui/library/suggest";
import { useRemoteSearch } from "../ui/library/use-remote-search";
import type { ContentFaceData } from "./model";

type PieceFrameDef = { kind: "piece"; key: string; stub: ContentListItem };
type Frame = PieceFrameDef | { kind: "edit"; key: string };
type Narrow = { scope: ContentScope; name: string };

const DEFAULT_KINDS: Array<{ label: string; types?: ContentType[] }> = [
  { label: "Artwork", types: ["artwork", "product"] },
  { label: "Writing", types: ["writing"] },
  { label: "Everything" },
];
const SALE_SITE: ContentSaleState[] = ["for_sale", "in_auction", "sold"];
const SALE_NET: ContentSaleState[] = ["for_sale", "in_auction", "not_for_sale"];

const saleWord = (it: ContentListItem) => (it.hidden ? "Hidden" : it.sale ? SALE_WORD[it.sale.state] : it.status === "draft" ? "Draft" : "Shown");
const isSale = (it: ContentListItem) => !it.hidden && Boolean(it.sale) && it.sale!.state !== "not_for_sale";

// ── the frame's chrome ──
function Header({ title, size, back, onBack, onClose, onOpenPage }: { title: string; size: number; back?: string; onBack?: () => void; onClose: () => void; onOpenPage?: () => void }) {
  return (
    <header className="hp-head">
      {back ? (
        <button type="button" className="hp-btn hp-back" onClick={onBack} aria-label={`Back to ${back}`}>
          <span aria-hidden>‹</span> {back}
        </button>
      ) : null}
      <h2 className="hp-title" style={{ fontSize: size }} tabIndex={-1}>{title}</h2>
      <div className="hp-head-end">
        {onOpenPage ? (
          <button type="button" className="hp-link" onClick={onOpenPage}>Open as page ↗</button>
        ) : null}
        <button type="button" className="hp-btn hp-x" aria-label="Close" onClick={onClose}><span aria-hidden>✕</span></button>
      </div>
    </header>
  );
}

function CheckGroup({ title, options, chosen, onToggle }: { title: string; options: Array<{ id: string; label: string; count?: number }>; chosen: Set<string>; onToggle: (id: string) => void }) {
  return (
    <fieldset className="hp-group">
      <legend>{title}</legend>
      {options.length === 0 ? <p className="hp-quiet">Nothing to filter yet.</p> : null}
      {options.map((o) => (
        <label key={o.id} className="hp-check">
          <input type="checkbox" checked={chosen.has(o.id)} onChange={() => onToggle(o.id)} />
          <span>{o.label}</span>
          {o.count ? <span className="hp-count">{o.count}</span> : null}
        </label>
      ))}
    </fieldset>
  );
}

const flip = (s: Set<string>, id: string) => {
  const n = new Set(s);
  if (n.has(id)) n.delete(id);
  else n.add(id);
  return n;
};

export function R2Popup({ data, nav, host }: HubCardProps<ContentFaceData>) {
  const { preset } = data;
  const scopes = preset.scopes ?? { site: data.siteName, network: "The collective" };
  const kinds = preset.kinds?.length ? preset.kinds : DEFAULT_KINDS;
  const renderEdit = (host as HubCardHost & HubCardHostExtras).renderEdit;

  // ── the list's state (lives here so it survives a push) ──
  const [scopeKey, setScopeKey] = React.useState<"site" | "network">("site");
  const [narrow, setNarrow] = React.useState<Narrow | null>(null);
  const [q, setQ] = React.useState("");
  const [kindIx, setKindIx] = React.useState(() => {
    const ix = preset.types ? kinds.findIndex((k) => k.types && k.types.some((t) => preset.types!.includes(t))) : -1;
    return ix >= 0 ? ix : 0;
  });
  const [sort, setSort] = React.useState<"recent" | "store" | "title">("recent");
  const [stores, setStores] = React.useState<Set<string>>(new Set());
  const [sales, setSales] = React.useState<Set<string>>(new Set());
  const [statuses, setStatuses] = React.useState<Set<string>>(new Set());
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const net = scopeKey === "network" && !narrow;

  const kind = kinds[kindIx] ?? kinds[0]!;
  const scope: ContentScope = narrow ? narrow.scope : scopeKey === "network" ? { kind: "network" } : preset.scope;
  const statusList: ContentStatus[] | undefined = (() => {
    const out: ContentStatus[] = [];
    if (statuses.has("published")) out.push("published", "live");
    if (statuses.has("draft")) out.push("draft", "scheduled");
    return out.length ? out : undefined;
  })();
  const query: ContentQuery = {
    q: q.trim() || undefined,
    scope,
    view: preset.view,
    types: kind.types ?? (kind.label === "Everything" ? undefined : preset.types),
    statuses: statusList,
    sort: sort === "title" ? "title" : undefined,
    limit: 48,
    storeIds: scopeKey === "site" && !narrow && stores.size ? [...stores] : undefined,
    saleStates: sales.size ? ([...sales] as ContentSaleState[]) : undefined,
    includeHidden: preset.includeHidden && scopeKey === "site" && !narrow ? true : undefined,
  };
  const source = React.useMemo(() => ({ endpoint: data.endpoints.search }), [data.endpoints.search]);
  const rs = useRemoteSearch(source, query);

  // ── the stack ──
  const [frames, setFrames] = React.useState<Frame[]>([]);
  const [lastKey, setLastKey] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState<string | null>(null);
  const panel = React.useRef<HTMLElement>(null);
  const top = frames.length;

  const push = (f: Frame) => setFrames((a) => [...a, f]);
  const pop = () => setFrames((a) => a.slice(0, -1));
  const openPiece = (it: ContentListItem) => {
    setLastKey(it.key);
    setNote(null);
    push({ kind: "piece", key: it.key, stub: it });
  };

  // Focus: the heading of the frame that became the top; the opener (or the Edit button) when we come back.
  const first = React.useRef(true);
  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      panel.current?.querySelector<HTMLElement>(".hp-frame:not([hidden]) .hp-title")?.focus();
      return;
    }
    const el = panel.current?.querySelector<HTMLElement>(".hp-frame:not([hidden])");
    (el?.querySelector<HTMLElement>("[data-hp-focus]") ?? el?.querySelector<HTMLElement>(".hp-title"))?.focus();
  }, [top]);

  // Body scroll lock and focus return to whatever opened the popup.
  React.useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
      opener?.focus?.();
    };
  }, []);

  const onPanelKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      if (top > 0) pop();
      else nav.close();
    } else if (e.key === "Tab") {
      const nodes = [...(panel.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex="0"]') ?? [])].filter((n) => n.offsetParent !== null);
      if (!nodes.length) return;
      const a = nodes[0]!;
      const z = nodes[nodes.length - 1]!;
      if (e.shiftKey && document.activeElement === a) {
        e.preventDefault();
        z.focus();
      } else if (!e.shiftKey && document.activeElement === z) {
        e.preventDefault();
        a.focus();
      }
    }
  };

  // A picked suggestion: open the piece (its row, if loaded; else a stub that is replaced once fetched).
  const pickPiece = (p: SuggestPiece) => {
    const have = rs.items.find((i) => i.key === p.key);
    if (have) return openPiece(have);
    const stub = { key: p.key, type: p.type as ContentType, title: p.title, cover: p.cover, meta: "", excerpt: "", status: "published", siteIdentityId: "", siteName: "", siteHost: null, ownerIdentityId: null, series: null, createdAt: "", date: null, marks: [], note: null, timeline: [], links: { public: null, studio: null } } as ContentListItem;
    openPiece(stub);
    const find = async (sc: ContentScope) => {
      const qs = contentQueryParams({ q: p.title, scope: sc, view: "all", limit: 20 }).toString();
      const r = await fetch(`${data.endpoints.search}?${qs}`, { credentials: "same-origin" });
      if (!r.ok) return null;
      const b = (await r.json()) as { items?: ContentListItem[] };
      return b.items?.find((i) => i.key === p.key) ?? null;
    };
    void (async () => {
      try {
        const it = (await find(scope)) ?? (await find({ kind: "network" }));
        if (it) setFrames((a) => a.map((f) => (f.kind === "piece" && f.key === p.key ? { ...f, stub: it } : f)));
      } catch {
        /* the stub stays */
      }
    })();
  };

  const allowed = new Set(data.actions);
  const runAct = async (id: string, artworkId: string) => {
    setBusy(true);
    setNote(null);
    const r = await host.act(id, { artworkId });
    setBusy(false);
    if (r.ok) {
      pop();
      rs.reload();
      host.refresh?.();
    } else setNote(("error" in r && r.error) || "That could not be done.");
  };

  // ── the rail's options ──
  const storeOpts = net
    ? [...rs.items.reduce((m, i) => m.set(i.siteName, (m.get(i.siteName) ?? 0) + 1), new Map<string, number>()).entries()].map(([n, c]) => ({ id: n, label: n, count: c }))
    : rs.facets.stores.map((s) => ({ id: s.id, label: s.name, count: s.count }));
  const saleOpts = (net ? SALE_NET : SALE_SITE).map((s) => ({ id: s, label: SALE_WORD[s], count: rs.facets.sale[s] }));
  const statusOpts = [
    { id: "published", label: "Published", count: (rs.facets.statuses.published ?? 0) + (rs.facets.statuses.live ?? 0) },
    ...(net ? [] : [{ id: "draft", label: "Draft", count: (rs.facets.statuses.draft ?? 0) + (rs.facets.statuses.scheduled ?? 0) }]),
    ...(!net && preset.includeHidden ? [{ id: "hidden", label: "Hidden", count: 0 }] : []),
  ];

  // Client-side parts: the network's store filter, the Hidden status, "By store" order.
  let shown = rs.items;
  if (net && stores.size) shown = shown.filter((i) => stores.has(i.siteName));
  if (statuses.has("hidden") && statuses.size === 1) shown = shown.filter((i) => i.hidden === true);
  if (sort === "store") shown = [...shown].sort((a, b) => (a.storefront?.name ?? a.siteName).localeCompare(b.storefront?.name ?? b.siteName));

  const label = preset.title;
  const more = rs.nextCursor ? "+" : "";
  const countLine = rs.loading && !rs.items.length ? "Loading…" : narrow ? `${shown.length}${more} by ${narrow.name}` : net ? "Published work across the collective" : `${shown.length}${more} on ${scopes.site}`;
  const who = (it: ContentListItem) => (net ? [it.ownerName, it.siteName].filter(Boolean).join(" · ") : it.storefront?.name ?? it.ownerName ?? it.siteName);

  const resetFilters = () => {
    setStores(new Set());
    setSales(new Set());
    setStatuses(new Set());
  };
  const setScope = (k: "site" | "network") => {
    setNarrow(null);
    setScopeKey(k);
    resetFilters();
  };

  const pieceFrames = frames.filter((f): f is PieceFrameDef => f.kind === "piece");
  const editFrame = frames.find((f) => f.kind === "edit");
  const titleOf = (key: string) => rs.items.find((x) => x.key === key)?.title ?? pieceFrames.find((p) => p.key === key)?.stub.title ?? "piece";
  const kindSelect = (
    <label className="hp-sel">
      <span className="hp-sel-label">Kind</span>
      <select value={kindIx} onChange={(e) => { setKindIx(Number(e.target.value)); resetFilters(); }}>
        {kinds.map((k, i) => <option key={k.label} value={i}>{k.label}</option>)}
      </select>
    </label>
  );
  const sortSelect = (
    <label className="hp-sel">
      <span className="hp-sel-label">Sort</span>
      <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
        <option value="recent">Newest</option>
        <option value="store">By store</option>
        <option value="title">Title</option>
      </select>
    </label>
  );

  return (
    <div className="eac-c eac-c-hubdark hp-scrim" onMouseDown={(e) => e.target === e.currentTarget && nav.close()}>
      <section ref={panel} className="hp-panel" role="dialog" aria-modal="true" aria-label={label} onKeyDown={onPanelKey}>
        {/* the list */}
        <div className="hp-frame" hidden={top > 0}>
          <Header title={label} size={36} onClose={() => nav.close()} onOpenPage={() => nav.openDetail(undefined, undefined, preset.id ? { preset: preset.id } : undefined)} />
          <div className="hp-tools" role="toolbar" aria-label={`${label} tools`} data-open={filtersOpen ? "1" : undefined}>
            <SuggestSearch
              className="hp-search"
              placeholder={narrow ? `Search ${narrow.name}` : net ? `Search ${scopes.network.toLowerCase()}` : `Search ${scopes.site}`}
              value={q}
              onChange={setQ}
              suggest={{
                endpoint: data.endpoints.search.replace(/\/search\/?$/, "/suggest"),
                onPiece: pickPiece,
                onPerson: (p) => {
                  setNarrow({ scope: { kind: "person", userId: p.id }, name: p.name });
                  setQ("");
                  resetFilters();
                },
                onOrg: (o) => {
                  setNarrow({ scope: { kind: "org", orgId: o.id }, name: o.name });
                  setQ("");
                  resetFilters();
                },
              }}
            />
            <div className="hp-seg" role="group" aria-label="Whose works">
              <button type="button" aria-pressed={scopeKey === "site" && !narrow} onClick={() => setScope("site")}>{scopes.site}</button>
              <button type="button" aria-pressed={scopeKey === "network" && !narrow} onClick={() => setScope("network")}>{scopes.network}</button>
            </div>
            <button type="button" className="hp-btn hp-filters-btn" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((o) => !o)}>Filters</button>
            <span className="hp-wide-only">{kindSelect}</span>
            <span className="hp-wide-only">{sortSelect}</span>
          </div>
          {narrow ? (
            <p className="hp-narrow" role="status">
              Works by {narrow.name}
              <button type="button" className="hp-link" onClick={() => setNarrow(null)}>Show {scopeKey === "network" ? scopes.network : scopes.site}</button>
            </p>
          ) : null}
          <div className="hp-body" data-filters={filtersOpen ? "1" : undefined}>
            <div className="hp-main">
              {rs.error ? (
                <p className="hp-quiet" role="alert">{rs.error} <button type="button" className="hp-link" onClick={rs.reload}>Try again</button></p>
              ) : !rs.loading && shown.length === 0 ? (
                <p className="hp-quiet">{q.trim() ? `Nothing matches “${q.trim()}”.` : "Nothing here yet."}</p>
              ) : (
                <ul className="hp-grid">
                  {shown.map((it) => (
                    <li key={it.key}>
                      <button type="button" className="hp-tile" aria-haspopup="dialog" data-hp-focus={it.key === lastKey ? "1" : undefined} onClick={() => openPiece(it)}>
                        <span className="hp-pic" data-blank={it.cover ? undefined : "1"}>
                          {it.cover ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={it.cover} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                          ) : null}
                        </span>
                        <span className="hp-tile-title">{it.title}</span>
                        <span className="hp-tile-sub">
                          <span className="hp-chip" data-sale={isSale(it) ? "1" : undefined}>{saleWord(it)}</span>
                          <span className="hp-who">{who(it)}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <aside className="hp-rail" aria-label="Filters">
              <div className="hp-phone-only hp-sel-phone">
                {kindSelect}
                {sortSelect}
              </div>
              <CheckGroup title="Store" options={storeOpts} chosen={stores} onToggle={(id) => setStores((s) => flip(s, id))} />
              <CheckGroup title="Sale" options={saleOpts} chosen={sales} onToggle={(id) => setSales((s) => flip(s, id))} />
              <CheckGroup title="Status" options={statusOpts} chosen={statuses} onToggle={(id) => setStatuses((s) => flip(s, id))} />
            </aside>
          </div>
          <footer className="hp-foot">
            <span className="hp-count" role="status" aria-live="polite">{countLine}</span>
            {rs.nextCursor ? <button type="button" className="hp-btn" disabled={rs.loadingMore} onClick={rs.more}>{rs.loadingMore ? "Loading…" : "Show more"}</button> : null}
          </footer>
        </div>

        {/* the pieces (one per push) and the edit frame */}
        {pieceFrames.map((f, i) => {
          const item = rs.items.find((x) => x.key === f.key) ?? f.stub;
          const deeper = frames.indexOf(f) < top - 1;
          const artworkId = item.key.startsWith("artwork:") ? item.key.slice("artwork:".length) : null;
          const canHide = artworkId && !item.hidden && item.can?.hide !== false && allowed.has("artwork-hide");
          const canShow = artworkId && item.hidden === true && allowed.has("artwork-show");
          const canEdit = item.can?.edit !== false && item.key.startsWith("artwork:");
          const studio = item.links.studio ?? (artworkId && host.studioHref ? host.studioHref({ kind: "artwork", id: artworkId }) || null : null);
          const images = item.images?.length ? item.images : item.cover ? [item.cover] : [];
          return (
            <PieceFrame
              key={`${f.key}-${i}`}
              hidden={deeper}
              item={item}
              backLabel={label}
              onBack={pop}
              onClose={() => nav.close()}
              images={images}
              note={note}
              foot={
                <>
                  <span className="hp-foot-start">
                    {canHide ? <button type="button" className="hp-btn hp-danger" disabled={busy} onClick={() => runAct("artwork-hide", artworkId!)}>Hide from the site</button> : null}
                    {canShow ? <button type="button" className="hp-btn" disabled={busy} onClick={() => runAct("artwork-show", artworkId!)}>Show on the site</button> : null}
                  </span>
                  <span className="hp-foot-end">
                    {canEdit && renderEdit ? (
                      <button type="button" className="hp-btn" data-hp-focus="1" onClick={() => push({ kind: "edit", key: item.key })}>Edit</button>
                    ) : canEdit && studio ? (
                      <a className="hp-btn" data-hp-focus="1" href={studio}>Edit</a>
                    ) : null}
                    {item.links.public ? <a className="hp-btn hp-primary" href={item.links.public} target="_blank" rel="noreferrer">Open on the site</a> : null}
                  </span>
                </>
              }
            />
          );
        })}
        {editFrame && renderEdit ? (
          <div className="hp-frame">
            <Header title={`Edit ${titleOf(editFrame.key)}`} size={26} back="Back" onBack={pop} onClose={() => nav.close()} />
            <div className="hp-edit">
              {renderEdit({
                key: editFrame.key,
                onDone: () => {
                  pop();
                  rs.reload();
                  host.refresh?.();
                },
                onCancel: pop,
              })}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function PieceFrame({ item, hidden, backLabel, onBack, onClose, images, foot, note }: { item: ContentListItem; hidden: boolean; backLabel: string; onBack: () => void; onClose: () => void; images: string[]; foot: React.ReactNode; note: string | null }) {
  const [pic, setPic] = React.useState(0);
  const cur = images[pic] ?? images[0] ?? null;
  const store = item.storefront?.name ?? item.siteName;
  const rows: Array<[string, string | null, boolean?]> = [
    ["Store", store || null],
    ["Sale", item.hidden ? null : item.sale ? SALE_WORD[item.sale.state] : null, isSale(item)],
    ["Price", item.sale?.price ?? null],
    ["Status", item.hidden ? "Hidden from the site" : STATUS_WORD[item.status] ?? null],
  ];
  return (
    <div className="hp-frame" hidden={hidden}>
      <Header title={item.title} size={26} back={backLabel} onBack={onBack} onClose={onClose} />
      <div className="hp-body hp-piece">
        <div className="hp-main hp-piece-main">
          <span className="hp-bigpic" data-blank={cur ? undefined : "1"}>
            {cur ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cur} alt={item.title} />
            ) : null}
          </span>
          {images.length > 1 ? (
            <ul className="hp-thumbs" aria-label="Pictures">
              {images.map((src, i) => (
                <li key={src}>
                  <button type="button" className="hp-thumb" aria-label={`Picture ${i + 1}`} aria-pressed={i === pic} onClick={() => setPic(i)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {item.note?.text || item.meta ? <p className="hp-lede">{item.note?.text || item.meta}</p> : null}
          {item.excerpt ? <p className="hp-lede">{item.excerpt}</p> : null}
          {note ? <p className="hp-error" role="alert">{note}</p> : null}
        </div>
        <aside className="hp-rail hp-facts" aria-label="About this piece">
          <dl>
            {rows.filter((r) => r[1]).map(([k, v, gold]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd data-gold={gold ? "1" : undefined}>{v}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </div>
      <footer className="hp-foot hp-foot-piece">{foot}</footer>
    </div>
  );
}
