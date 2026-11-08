"use client";

import * as React from "react";
import { LayoutGrid, List, Search } from "lucide-react";
import { type ContentIdentity, type ContentListItem, type ContentStatus, type ContentType } from "../model";
import { STATUS_WORD, typeLabel } from "../registry";
import { IdentityMark } from "./atoms";
import { PieceBrick, PieceLightbox, type PieceLightboxAction } from "./PieceLightbox";
import { PieceList } from "./PieceRow";

export type LibraryView = "bricks" | "list";
export type LibrarySort = "recent" | "next" | "title";

export interface LibraryState {
  q: string;
  scope: string;
  kind: ContentType | "all";
  status: ContentStatus | "all";
  series: string;
  sort: LibrarySort;
  view: LibraryView;
}

export interface ContentLibraryProps {
  items: ContentListItem[];
  /** The people and orgs the viewer acts for: the scope toggle ("All yours | You | Elkdonis Arts"). Hidden when there is one. */
  identities: ContentIdentity[];
  timeZone: string;
  /** ISO instant for "Next up" and for dating; defaults to the first render's clock. */
  now?: string;
  /** Start from these (a `?kind=` or `?q=` address). */
  initial?: Partial<LibraryState>;
  /** Mirror the state into the address, or anywhere. */
  onStateChange?: (state: LibraryState) => void;
  /** Bricks grouped under each site (Channel), or one flat run (/content). */
  groupBySite?: boolean;
  /** Tags a brick or row "Open now". */
  currentKey?: string | null;
  /** The lightbox's lead button for a piece. Default: none. */
  primaryAction?: (item: ContentListItem) => PieceLightboxAction | null;
  /** A row above the filters (Channel puts "Content | People | Sites | Forum" here). */
  header?: React.ReactNode;
  /** Shown instead of everything when the host has no pieces at all ("Publish your first post"). */
  empty?: React.ReactNode;
  searchPlaceholder?: string;
  allLabel?: string;
  /** How many to draw before "Show more". Default 60. */
  pageSize?: number;
  /** Text of the count line; default "N of M pieces". */
  countLabel?: (shown: number, total: number) => string;
  className?: string;
}

const KIND_ORDER: ContentType[] = ["artwork", "product", "writing", "video", "series", "meeting", "questionnaire", "poll"];
const STATUS_ORDER: ContentStatus[] = ["draft", "scheduled", "live", "published", "archived"];

const matchKind = (it: ContentListItem, kind: ContentType | "all") =>
  kind === "all" ||
  it.type === kind ||
  (kind === "series" && it.type === "workshop") ||
  (kind === "meeting" && it.type === "event") ||
  (kind === "artwork" && it.type === "product");

/**
 * The content library: Channel's library made general. Search, scope, filter
 * by kind, status and series, sort, and bricks or a list. Clicking a piece
 * opens its lightbox; the host decides what the lead button does. Data comes
 * in as props, already filtered to what the viewer may see.
 */
export function ContentLibrary({
  items,
  identities,
  timeZone,
  now,
  initial,
  onStateChange,
  groupBySite = false,
  currentKey = null,
  primaryAction,
  header,
  empty,
  searchPlaceholder = "Search your pieces",
  allLabel = "All yours",
  pageSize = 60,
  countLabel,
  className,
}: ContentLibraryProps) {
  const [st, setSt] = React.useState<LibraryState>({ q: "", scope: "all", kind: "all", status: "all", series: "all", sort: "recent", view: "bricks", ...initial });
  const set = (patch: Partial<LibraryState>) => {
    setLimit(pageSize);
    setSt((s) => ({ ...s, ...patch }));
  };
  const [limit, setLimit] = React.useState(pageSize);
  const [open, setOpen] = React.useState<string | null>(null);
  const opener = React.useRef<HTMLElement | null>(null);
  const clock = React.useMemo(() => now ?? new Date().toISOString(), [now]);

  React.useEffect(() => {
    onStateChange?.(st);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st]);

  const close = () => {
    setOpen(null);
    requestAnimationFrame(() => opener.current?.focus());
  };
  const onOpen = (item: ContentListItem, el: HTMLElement) => {
    opener.current = el;
    setOpen(item.key);
  };

  const kinds = KIND_ORDER.filter((k) => k !== "product" && items.some((p) => p.type === k || (k === "series" && p.type === "workshop") || (k === "meeting" && p.type === "event") || (k === "artwork" && p.type === "product")));
  const statuses = STATUS_ORDER.filter((s) => items.some((p) => p.status === s));
  const seriesList = [...new Map(items.filter((p) => p.series).map((p) => [p.series!.id, p.series!.name])).entries()];

  const needle = st.q.trim().toLowerCase();
  const filtered = items.filter(
    (p) =>
      matchKind(p, st.kind) &&
      (st.status === "all" || p.status === st.status) &&
      (st.series === "all" || p.series?.id === st.series) &&
      (st.scope === "all" || p.siteIdentityId === st.scope || p.ownerIdentityId === st.scope) &&
      (!needle || `${p.title} ${p.excerpt} ${p.meta} ${p.siteName}`.toLowerCase().includes(needle))
  );
  const sorted = [...filtered].sort((a, b) => {
    if (st.sort === "title") return a.title.localeCompare(b.title);
    if (st.sort === "next") {
      const an = a.date && a.date >= clock ? a.date : null;
      const bn = b.date && b.date >= clock ? b.date : null;
      if (an && bn) return an.localeCompare(bn);
      if (an) return -1;
      if (bn) return 1;
    }
    return b.createdAt.localeCompare(a.createdAt);
  });
  const shown = sorted.slice(0, limit);

  const groups = new Map<string, { title: string; host: string | null; identityId: string; pieces: ContentListItem[] }>();
  if (groupBySite) {
    for (const p of shown) {
      const k = `${p.siteIdentityId}|${p.siteName}`;
      if (!groups.has(k)) groups.set(k, { title: p.siteName, host: p.siteHost, identityId: p.siteIdentityId, pieces: [] });
      groups.get(k)!.pieces.push(p);
    }
  }
  const openItem = open ? items.find((p) => p.key === open) : undefined;
  const multiSite = new Set(items.map((p) => p.siteIdentityId)).size > 1;

  if (items.length === 0 && empty) return <div className={`eac-c eac-c-lib${className ? ` ${className}` : ""}`}>{empty}</div>;

  const bricks = (list: ContentListItem[]) => (
    <ul className="chn-bricks">
      {list.map((p) => (
        <PieceBrick key={p.key} item={p} onOpen={onOpen} current={p.key === currentKey} />
      ))}
    </ul>
  );

  return (
    <div
      className={`eac-c eac-c-lib${className ? ` ${className}` : ""}`}
      onKeyDown={(e) => {
        if (open && e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          close();
        }
      }}
    >
      <div className="eac-c-lib-content" inert={openItem ? true : undefined}>
        {header}
        <div className="eac-c-lib-bar">
          <label className="chn-search">
            <Search size={15} aria-hidden />
            <span className="chn-sr">Search</span>
            <input type="search" placeholder={searchPlaceholder} value={st.q} onChange={(e) => set({ q: e.target.value })} />
          </label>
          <div className="eac-c-lib-filters">
            <label className="eac-c-select-label">
              Sort
              <select className="eac-c-select" value={st.sort} onChange={(e) => set({ sort: e.target.value as LibrarySort })}>
                <option value="recent">Newest</option>
                <option value="next">Next up</option>
                <option value="title">A to Z</option>
              </select>
            </label>
            <div className="chn-seg is-small eac-c-viewseg" role="group" aria-label="View">
              <button type="button" aria-pressed={st.view === "bricks"} aria-label="Bricks" title="Bricks" onClick={() => set({ view: "bricks" })}>
                <LayoutGrid size={14} aria-hidden />
              </button>
              <button type="button" aria-pressed={st.view === "list"} aria-label="List" title="List" onClick={() => set({ view: "list" })}>
                <List size={14} aria-hidden />
              </button>
            </div>
          </div>
        </div>
        <div className="eac-c-lib-bar">
          {identities.length > 1 ? (
            <div className="chn-seg" role="group" aria-label="Scope">
              <button type="button" aria-pressed={st.scope === "all"} onClick={() => set({ scope: "all" })}>
                {allLabel}
              </button>
              {identities.map((i) => (
                <button key={i.id} type="button" aria-pressed={st.scope === i.id} onClick={() => set({ scope: i.id })}>
                  {i.kind === "user" ? "You" : i.shortName}
                </button>
              ))}
            </div>
          ) : (
            <span />
          )}
          <div className="eac-c-lib-filters">
            <div className="chn-seg is-small" role="group" aria-label="Kind">
              <button type="button" aria-pressed={st.kind === "all"} onClick={() => set({ kind: "all" })}>
                All
              </button>
              {kinds.map((k) => (
                <button key={k} type="button" aria-pressed={st.kind === k} onClick={() => set({ kind: k })}>
                  {typeLabel(k)}
                </button>
              ))}
            </div>
            {statuses.length > 1 && (
              <div className="chn-seg is-small" role="group" aria-label="Status">
                <button type="button" aria-pressed={st.status === "all"} onClick={() => set({ status: "all" })}>
                  Any status
                </button>
                {statuses.map((s) => (
                  <button key={s} type="button" aria-pressed={st.status === s} onClick={() => set({ status: s })}>
                    {STATUS_WORD[s]}
                  </button>
                ))}
              </div>
            )}
            {seriesList.length > 0 && (
              <label className="eac-c-select-label">
                Series
                <select className="eac-c-select" value={st.series} onChange={(e) => set({ series: e.target.value })}>
                  <option value="all">Any</option>
                  {seriesList.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </div>

        {shown.length === 0 ? (
          <p className="eac-c-lib-empty">{needle ? `Nothing matches “${st.q}”.` : "Nothing here yet."}</p>
        ) : st.view === "list" ? (
          <PieceList items={shown} timeZone={timeZone} density="regular" showSite={multiSite} onOpen={onOpen} />
        ) : groupBySite ? (
          [...groups.values()].map((g) => {
            const idn = identities.find((i) => i.id === g.identityId);
            return (
              <section key={`${g.identityId}|${g.title}`} className="eac-c-lib-group">
                <h3>
                  {idn ? <IdentityMark initials={idn.initials} kind={idn.kind} size={18} /> : null}
                  <strong>{g.title}</strong>
                  {g.host && <small>{g.host}</small>}
                </h3>
                {bricks(g.pieces)}
              </section>
            );
          })
        ) : (
          bricks(shown)
        )}

        <p className="eac-c-lib-count" role="status">
          {countLabel ? countLabel(shown.length, filtered.length) : `${shown.length} of ${filtered.length} ${filtered.length === 1 ? "piece" : "pieces"}${filtered.length !== items.length ? ` (${items.length} in all)` : ""}`}
        </p>
        {sorted.length > shown.length && (
          <button type="button" className="chn-btn eac-c-lib-more" onClick={() => setLimit((n) => n + pageSize)}>
            Show {Math.min(pageSize, sorted.length - shown.length)} more
          </button>
        )}
      </div>
      {openItem && <PieceLightbox item={openItem} timeZone={timeZone} onClose={close} primary={primaryAction?.(openItem) ?? null} />}
    </div>
  );
}

