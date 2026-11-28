"use client";

import * as React from "react";
import { type ContentIdentity, type ContentListItem, type ContentStatus, type ContentStore, type ContentType, type ContentView } from "../model";
import { STATUS_WORD, typeLabel } from "../registry";
import type { ContentQuery, ContentSaleState, ContentScope } from "../search-types";
import { IdentityMark } from "./atoms";
import { PieceBrick, PieceLightbox, type PieceLightboxAction } from "./PieceLightbox";
import { PieceList, PieceRow } from "./PieceRow";
import { CountLine, SearchBox, SegGroup, ViewToggle } from "./library/bar";
import { SuggestSearch, type SuggestConfig } from "./library/suggest";
import { SALE_WORD } from "./library/badges";
import { FileBrowser } from "./library/FileBrowser";
import { FileBrick, FileRow } from "./library/file-tiles";
import { isFileItem } from "./library/file-lightbox";
import { listItemToFileLike } from "./library/file-model";
import { KIND_WORD } from "./library/file-utils";
import type { FolderSource } from "./library/folder-nav";
import type { LibraryUpload } from "./library/upload";
import { useRemoteSearch, type RemoteSource } from "./library/use-remote-search";

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

export type LibraryGroupBy = "site" | "store" | "none";

/** One place a files view can look. A source with no `endpoint` of its own is read through `folders.endpoint?source=<key>`. */
export type LibraryFolderSource = FolderSource;

export interface ContentLibraryProps {
  /** Items mode: the pieces, already filtered to what the viewer may see. Left out (or `[]`) in remote mode. */
  items?: ContentListItem[];
  /** The people and orgs the viewer acts for: the scope toggle ("All yours | You | Elkdonis Arts"). Hidden when there is one. */
  identities?: ContentIdentity[];
  timeZone?: string;
  /** ISO instant for "Next up" and for dating; defaults to the first render's clock. */
  now?: string;
  /** Start from these (a `?kind=` or `?q=` address). */
  initial?: Partial<LibraryState>;
  /** Mirror the state into the address, or anywhere. */
  onStateChange?: (state: LibraryState) => void;
  /** Bricks grouped under each site (Channel), or one flat run (/content). Kept as an alias of `groupBy="site"`. */
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
  /** How many to draw before "Show more". Default 60. In remote mode it is the page size asked of the server (at most 100). */
  pageSize?: number;
  /** Text of the count line; default "N of M pieces". */
  countLabel?: (shown: number, total: number) => string;
  className?: string;

  // ── v1 (CONTRACT.md §7, §10): one component for the library, the file browser and the picker ──

  /** Remote mode: the library calls this instead of filtering `items` (debounced q, cursor "Show more", facets). */
  source?: RemoteSource;
  /** What the remote query asks for; default the viewer's own pieces. */
  scope?: ContentScope;
  /** Keepers only: also ask for hidden rows. The server checks it against rights. */
  includeHidden?: boolean;
  /** Only these types, before any filter the viewer sets (the card's preset). */
  types?: ContentType[];
  /** Published | Files | All. Starts here; shows the toggle unless `lockView`. */
  view?: ContentView;
  lockView?: boolean;
  onViewChange?: (view: ContentView) => void;
  /** browse opens the lightbox; pick and pickMany report a click instead. */
  mode?: "browse" | "pick" | "pickMany";
  /** pick: the chosen piece's key (or a file's URL), marked. */
  value?: string;
  /** pickMany: the chosen keys (or URLs). */
  picked?: string[];
  /** `part` is set when `pickPart="image"`: the image chosen from the piece. */
  onPick?: (item: ContentListItem, part?: { image: string }) => void;
  /** pick: choose the whole item (default) or one image of it (CONTRACT §11.4). */
  pickPart?: "item" | "image";
  onToggle?: (item: ContentListItem) => void;
  /** Files view: folder navigation (Back, Forward, Up, crumbs, folder chips) through the folders route. */
  folders?: { endpoint?: string; sources: LibraryFolderSource[] };
  /** File filter, as an <input accept>: "image/*". */
  accept?: string;
  upload?: LibraryUpload;
  /** After an upload. In pick mode the new file is also picked. */
  onUploaded?: (item: ContentListItem) => void;
  /** compact = the Puck side panel and sheets: one column of rows, selects for the filters. */
  density?: "full" | "compact";
  groupBy?: LibraryGroupBy;
  /** Return true when the host opened its own frame for the piece: the lightbox is then skipped. */
  onOpen?: (item: ContentListItem) => boolean | void;
  /** The host's own buttons in the lightbox, beside the lead one. */
  railSlot?: (item: ContentListItem) => React.ReactNode;
  /** The lightbox's secondary actions after `primaryAction` (CONTRACT §10.9): Hide / Show for keepers, built from the host's allow-list and `item.can`. */
  itemActions?: (item: ContentListItem) => PieceLightboxAction[];
  /** Files view: session-storage namespace for the remembered folder and view. Default "eac-mlib". */
  rememberAs?: string;
  /** Files view: which source opens first. Default the first. */
  initialSource?: string;
  /** Files view: shown when a folder is empty. */
  emptyText?: string;
  /** Round 2: "large" = 4-across tiles with a 4/5 picture and 16px titles (2-across on a phone). Default as before. */
  tileSize?: "regular" | "large";
  /** Round 2: the Show toggle offers only these views (and is hidden when one is left). Default: all three, as before. */
  views?: ContentView[];
  /**
   * Round 2: a suggestions dropdown under the search box (Pieces / People / Orgs, from GET <endpoint>?q=&limit=).
   * A piece fills the search; a person or an org narrows the list to their works (a chip clears it). Remote mode.
   */
  suggest?: { endpoint: string };
}

const KIND_ORDER: ContentType[] = ["artwork", "product", "writing", "video", "series", "meeting", "questionnaire", "poll", "image", "audio", "document", "file"];
const STATUS_ORDER: ContentStatus[] = ["draft", "scheduled", "live", "published", "archived"];
const SALE_ORDER: ContentSaleState[] = ["for_sale", "in_auction", "reserved", "sold", "passed", "withdrawn"];
const FILE_KIND: Partial<Record<ContentType, string>> = { image: KIND_WORD.image, audio: KIND_WORD.audio, document: KIND_WORD.document, file: KIND_WORD.other };
const VIEW_WORD: Array<{ value: ContentView; label: string }> = [
  { value: "published", label: "Published" },
  { value: "files", label: "Files" },
  { value: "all", label: "All" },
];

const kindLabel = (k: ContentType) => FILE_KIND[k] ?? typeLabel(k);

const matchKind = (it: ContentListItem, kind: ContentType | "all") =>
  kind === "all" ||
  it.type === kind ||
  (kind === "series" && it.type === "workshop") ||
  (kind === "meeting" && it.type === "event") ||
  (kind === "artwork" && it.type === "product");

/** The types a kind chip asks the server for (a chip stands for its family). */
const typesOfKind = (kind: ContentType): ContentType[] => (kind === "artwork" ? ["artwork", "product"] : kind === "series" ? ["series", "workshop"] : kind === "meeting" ? ["meeting", "event"] : [kind]);

const storeOf = (it: ContentListItem): ContentStore => it.store ?? ((it.key.split(":")[0] as ContentStore) || "thread");

/** Which items a view shows (items mode). */
const inView = (it: ContentListItem, view: ContentView) => view === "all" || (view === "files" ? storeOf(it) === "file" : storeOf(it) !== "file");

/**
 * The content library: Channel's library made general, and (CONTRACT §7) the one component for the
 * platform's libraries, file browsers and pickers. Search, scope, filter by kind, status and series,
 * sort, and bricks or a list. Clicking a piece opens its lightbox; the host decides what the lead
 * button does.
 *
 *  - items mode (default): data comes in as props, already filtered to what the viewer may see;
 *  - remote mode (`source`): the library asks for pages, with a debounced `q`, a cursor, facets and
 *    the server's `missing` list shown;
 *  - files with folders (`view="files"` + `folders`): the folder browser, MediaLibrary's body;
 *  - pick and pickMany (`mode`): a click chooses instead of opening.
 *
 * With none of the v1 props it renders exactly as it did before.
 */
export function ContentLibrary({
  items: itemsProp,
  identities = [],
  timeZone = "UTC",
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
  source,
  scope: scopeProp,
  includeHidden,
  types: baseTypes,
  view: viewProp,
  lockView = false,
  onViewChange,
  mode,
  value,
  picked,
  onPick,
  pickPart,
  onToggle,
  folders,
  accept = "*",
  upload,
  onUploaded,
  density,
  groupBy: groupByProp,
  onOpen: hostOpen,
  railSlot,
  itemActions,
  rememberAs,
  initialSource,
  emptyText,
  tileSize,
  views,
  suggest,
}: ContentLibraryProps) {
  const [st, setSt] = React.useState<LibraryState>({ q: "", scope: "all", kind: "all", status: "all", series: "all", sort: "recent", view: "bricks", ...initial });
  const set = (patch: Partial<LibraryState>) => {
    setLimit(pageSize);
    setSt((s) => ({ ...s, ...patch }));
  };
  const [limit, setLimit] = React.useState(pageSize);
  const [open, setOpen] = React.useState<string | null>(null);
  const [cview, setCview] = React.useState<ContentView>(viewProp ?? "published");
  const [sale, setSale] = React.useState<ContentSaleState | "all">("all");
  const [store, setStore] = React.useState("all");
  const [sortChosen, setSortChosen] = React.useState(false);
  const [narrow, setNarrow] = React.useState<{ scope: ContentScope; name: string } | null>(null);
  const opener = React.useRef<HTMLElement | null>(null);
  const clock = React.useMemo(() => now ?? new Date().toISOString(), [now]);

  React.useEffect(() => {
    if (viewProp) setCview(viewProp);
  }, [viewProp]);

  const items = itemsProp ?? [];
  const remote = Boolean(source);
  const compact = density === "compact";
  const view: ContentView = lockView ? viewProp ?? "published" : cview;
  const viewWords = views ? VIEW_WORD.filter((o) => views.includes(o.value)) : VIEW_WORD;
  const showViewToggle = !lockView && (viewProp !== undefined || remote) && viewWords.length > 1;
  /** The files view with folders: the folder browser, MediaLibrary's body. Also in remote mode
   *  (PM, 2026-11-26): files have no index rows until Step 5, and browsing stays live folders after it. */
  const folderBrowser = view === "files" && Boolean(folders) && (!views || views.includes("files"));
  const groupBy: LibraryGroupBy = groupByProp ?? (groupBySite ? "site" : "none");
  const picking = mode === "pick" || mode === "pickMany";

  const pickView = (v: ContentView) => {
    setCview(v);
    onViewChange?.(v);
    set({ kind: "all", status: "all", series: "all" });
    setSale("all");
    setStore("all");
  };

  React.useEffect(() => {
    onStateChange?.(st);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st]);

  // ── remote mode ──
  const baseScope: ContentScope = scopeProp ?? { kind: "mine" };
  const idn = identities.find((i) => i.id === st.scope);
  const scope: ContentScope = narrow ? narrow.scope : idn && idn.kind === "org" ? { kind: "org", orgId: idn.id.startsWith("org:") ? idn.id.slice(4) : idn.id } : idn ? { kind: "mine" } : baseScope;
  const q = st.q.trim();
  const query: ContentQuery = {
    q: q || undefined,
    scope,
    view,
    types: st.kind !== "all" ? typesOfKind(st.kind) : baseTypes,
    statuses: st.status !== "all" ? [st.status] : undefined,
    seriesId: st.series !== "all" ? st.series : undefined,
    sort: sortChosen ? st.sort : undefined,
    limit: Math.min(100, pageSize),
    storeIds: store !== "all" ? [store] : undefined,
    saleStates: sale !== "all" ? [sale] : undefined,
    includeHidden: includeHidden || undefined,
  };
  const rs = useRemoteSearch(source, query, { enabled: remote && !folderBrowser });

  const close = () => {
    setOpen(null);
    requestAnimationFrame(() => opener.current?.focus());
  };
  /** A click on a piece: choose it (pick modes), hand it to the host, or open its lightbox. */
  const activate = (item: ContentListItem, el: HTMLElement) => {
    if (mode === "pick") {
      if (item.can?.pick === false) return;
      if (pickPart === "image" && (item.images?.length || item.cover)) {
        opener.current = el;
        setOpen(item.key);
        return;
      }
      onPick?.(item);
      return;
    }
    if (mode === "pickMany") {
      if (item.can?.pick !== false) onToggle?.(item);
      return;
    }
    if (hostOpen?.(item) === true) return;
    opener.current = el;
    setOpen(item.key);
  };
  const isChosen = (it: ContentListItem) => {
    const ids = [it.key, it.links.public ?? ""].filter(Boolean);
    return mode === "pickMany" ? (picked ?? []).some((p) => ids.includes(p)) : mode === "pick" && value ? ids.includes(value) : false;
  };

  if (folderBrowser) {
    const viewSeg = showViewToggle ? (
      <div className="eac-c-lib-bar">
        <SegGroup<ContentView> label="Show" value={view} options={viewWords} onChange={pickView} />
      </div>
    ) : null;
    return (
      <FileBrowser
        sources={folders!.sources}
        endpoint={folders!.endpoint}
        mode={mode}
        value={value}
        picked={picked}
        onPick={onPick}
        onToggle={onToggle}
        accept={accept}
        upload={upload}
        onUploaded={onUploaded}
        onOpen={hostOpen}
        primaryAction={primaryAction}
        railSlot={railSlot}
        itemActions={itemActions}
        header={viewSeg ? (
          <>
            {header}
            {viewSeg}
          </>
        ) : (
          header
        )}
        rememberAs={rememberAs}
        defaultView={initial?.view === "list" ? "list" : "grid"}
        initialSource={initialSource}
        emptyText={emptyText}
        className={className}
        density={density}
      />
    );
  }

  // The pool the filters and the lightbox read from.
  const pool: ContentListItem[] = remote ? rs.items : showViewToggle || viewProp !== undefined ? items.filter((p) => inView(p, view)) : items;

  const kinds = remote
    ? KIND_ORDER.filter((k) => k !== "product" && (rs.facets.types[k] || (k === "artwork" && rs.facets.types.product) || (k === "series" && rs.facets.types.workshop) || (k === "meeting" && rs.facets.types.event)))
    : KIND_ORDER.filter((k) => k !== "product" && pool.some((p) => p.type === k || (k === "series" && p.type === "workshop") || (k === "meeting" && p.type === "event") || (k === "artwork" && p.type === "product")));
  const statuses = remote ? STATUS_ORDER.filter((s) => rs.facets.statuses[s]) : STATUS_ORDER.filter((s) => pool.some((p) => p.status === s));
  const seriesList = [...new Map(pool.filter((p) => p.series).map((p) => [p.series!.id, p.series!.name])).entries()];
  const saleKinds = remote ? SALE_ORDER.filter((s) => rs.facets.sale[s]) : SALE_ORDER.filter((s) => pool.some((p) => p.sale?.state === s));
  const stores = remote ? rs.facets.stores : [];

  const needle = st.q.trim().toLowerCase();
  const filtered = remote
    ? pool
    : pool.filter(
        (p) =>
          (!baseTypes || baseTypes.some((t) => matchKind(p, t))) &&
          matchKind(p, st.kind) &&
          (st.status === "all" || p.status === st.status) &&
          (st.series === "all" || p.series?.id === st.series) &&
          (sale === "all" || p.sale?.state === sale) &&
          (st.scope === "all" || p.siteIdentityId === st.scope || p.ownerIdentityId === st.scope) &&
          (!needle || `${p.title} ${p.excerpt} ${p.meta} ${p.siteName}`.toLowerCase().includes(needle))
      );
  const sorted = remote
    ? filtered
    : [...filtered].sort((a, b) => {
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
  const shown = remote ? sorted : sorted.slice(0, limit);
  const listView = compact || st.view === "list";

  const groups = new Map<string, { title: string; host: string | null; identityId: string; pieces: ContentListItem[] }>();
  if (groupBy !== "none") {
    for (const p of shown) {
      const sf = groupBy === "store" ? p.storefront : null;
      const k = sf ? `store:${sf.id}` : `${p.siteIdentityId}|${p.siteName}`;
      if (!groups.has(k)) groups.set(k, sf ? { title: sf.name, host: null, identityId: p.siteIdentityId, pieces: [] } : { title: p.siteName, host: p.siteHost, identityId: p.siteIdentityId, pieces: [] });
      groups.get(k)!.pieces.push(p);
    }
  }
  const openItem = open ? pool.find((p) => p.key === open) : undefined;
  const multiSite = new Set(pool.map((p) => p.siteIdentityId)).size > 1;

  if (!remote && items.length === 0 && empty) return <div className={`eac-c eac-c-lib${className ? ` ${className}` : ""}`}>{empty}</div>;

  const mine = new Set(identities.map((i) => i.id));
  /** "Owner name · Site" on someone else's piece in a picker. `ownerName` is read when the server supplies it. */
  const attributionOf = (p: ContentListItem): string | null => {
    if (!picking || !p.ownerIdentityId || mine.size === 0 || mine.has(p.ownerIdentityId)) return null;
    const who = p.ownerName;
    return who ? `${who} · ${p.siteName}` : p.siteName;
  };
  const tileProps = (p: ContentListItem) => ({ mode: mode ?? "browse", selected: isChosen(p), disabled: picking && p.can?.pick === false, attribution: attributionOf(p) });
  const brick = (p: ContentListItem) =>
    isFileItem(p) ? (
      <FileBrick key={p.key} item={listItemToFileLike(p)} mode={mode ?? "browse"} on={isChosen(p)} onActivate={(el) => activate(p, el)} badges={null} />
    ) : (
      <PieceBrick key={p.key} item={p} onOpen={activate} current={p.key === currentKey} {...tileProps(p)} />
    );
  const bricks = (list: ContentListItem[]) => <ul className="chn-bricks">{list.map(brick)}</ul>;
  const rows = (list: ContentListItem[]) => (
    <ul className="eac-c-rows">
      {list.map((p) =>
        isFileItem(p) ? (
          <FileRow key={p.key} item={listItemToFileLike(p)} mode={mode ?? "browse"} on={isChosen(p)} onActivate={(el) => activate(p, el)} />
        ) : (
          <PieceRow key={p.key} item={p} timeZone={timeZone} density={compact ? "compact" : "regular"} showSite={multiSite} onOpen={activate} current={p.key === currentKey} {...tileProps(p)} />
        )
      )}
    </ul>
  );

  const kindOptions = [{ value: "all" as ContentType | "all", label: "All" }, ...kinds.map((k) => ({ value: k as ContentType | "all", label: kindLabel(k) }))];
  const statusOptions = [{ value: "all" as ContentStatus | "all", label: "Any status" }, ...statuses.map((s) => ({ value: s as ContentStatus | "all", label: STATUS_WORD[s] }))];

  const nothing = remote ? !rs.loading && rs.items.length === 0 : shown.length === 0;
  const total = remote ? rs.items.length : filtered.length;
  const countText = remote
    ? rs.loading
      ? "Loading…"
      : countLabel
        ? countLabel(shown.length, total)
        : `${shown.length} ${shown.length === 1 ? "piece" : "pieces"}${rs.nextCursor ? " so far" : ""}${mode === "pickMany" ? ` · ${(picked ?? []).length} chosen` : ""}`
    : countLabel
      ? countLabel(shown.length, filtered.length)
      : `${shown.length} of ${filtered.length} ${filtered.length === 1 ? "piece" : "pieces"}${filtered.length !== pool.length ? ` (${pool.length} in all)` : ""}`;

  const scopeSeg =
    identities.length > 1 ? (
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
    ) : null;

  const searchBox =
    suggest && remote ? (
      <SuggestSearch
        placeholder={searchPlaceholder}
        value={st.q}
        onChange={(v) => set({ q: v })}
        suggest={{
          endpoint: suggest.endpoint,
          onPerson: (p) => {
            setNarrow({ scope: { kind: "person", userId: p.id }, name: p.name });
            set({ q: "" });
          },
          onOrg: (o) => {
            setNarrow({ scope: { kind: "org", orgId: o.id }, name: o.name });
            set({ q: "" });
          },
        }}
      />
    ) : (
      <SearchBox placeholder={searchPlaceholder} value={st.q} onChange={(v) => set({ q: v })} />
    );
  const narrowChip = narrow ? (
    <p className="eac-c-lib-narrow" role="status">
      Works by {narrow.name}{" "}
      <button type="button" className="chn-btn is-small" onClick={() => setNarrow(null)}>
        Show all
      </button>
    </p>
  ) : null;

  const sortSelect = (
    <label className="eac-c-select-label">
      Sort
      <select
        className="eac-c-select"
        value={st.sort}
        onChange={(e) => {
          setSortChosen(true);
          set({ sort: e.target.value as LibrarySort });
        }}
      >
        <option value="recent">Newest</option>
        <option value="next">Next up</option>
        <option value="title">A to Z</option>
      </select>
    </label>
  );

  const extraFilters = (
    <>
      {showViewToggle ? <SegGroup<ContentView> small label="Show" value={view} options={viewWords} onChange={pickView} /> : null}
      {saleKinds.length > 1 && !compact ? (
        <SegGroup<ContentSaleState | "all">
          small
          label="Sale"
          value={sale}
          options={[{ value: "all" as ContentSaleState | "all", label: "Any sale" }, ...saleKinds.map((s) => ({ value: s as ContentSaleState | "all", label: SALE_WORD[s] }))]}
          onChange={setSale}
        />
      ) : null}
      {stores.length > 1 ? (
        <label className="eac-c-select-label">
          Store
          <select className="eac-c-select" value={store} onChange={(e) => setStore(e.target.value)}>
            <option value="all">All stores</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.count})
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </>
  );

  return (
    <div
      className={`eac-c eac-c-lib${remote || view !== "published" ? " eac-c-media" : ""}${className ? ` ${className}` : ""}`}
      data-mode={mode}
      data-density={density}
      data-tile={tileSize === "large" ? "large" : undefined}
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
        {compact ? (
          <>
            <div className="eac-c-lib-bar">
              {searchBox}
            </div>
            <div className="eac-c-lib-bar">
              {extraFilters}
              {kinds.length > 0 && (
                <label className="eac-c-select-label">
                  Kind
                  <select className="eac-c-select" value={st.kind} onChange={(e) => set({ kind: e.target.value as ContentType | "all" })}>
                    {kindOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {statuses.length > 1 && (
                <label className="eac-c-select-label">
                  Status
                  <select className="eac-c-select" value={st.status} onChange={(e) => set({ status: e.target.value as ContentStatus | "all" })}>
                    {statusOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            {scopeSeg ? <div className="eac-c-lib-bar">{scopeSeg}</div> : null}
          </>
        ) : (
          <>
            <div className="eac-c-lib-bar">
              {searchBox}
              <div className="eac-c-lib-filters">
                {sortSelect}
                <ViewToggle value={st.view} options={[{ value: "bricks", label: "Bricks" }, { value: "list", label: "List" }]} onChange={(v) => set({ view: v })} />
              </div>
            </div>
            <div className="eac-c-lib-bar">
              {scopeSeg ?? <span />}
              <div className="eac-c-lib-filters">
                {extraFilters}
                <SegGroup small label="Kind" value={st.kind} options={kindOptions} onChange={(k) => set({ kind: k })} />
                {statuses.length > 1 && <SegGroup small label="Status" value={st.status} options={statusOptions} onChange={(s) => set({ status: s })} />}
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
          </>
        )}

        {narrowChip}
        {remote && rs.error ? (
          <p className="eac-c-lib-empty" role="alert">
            {rs.error}{" "}
            <button type="button" className="chn-btn is-small" onClick={rs.reload}>
              Try again
            </button>
          </p>
        ) : null}
        {remote && rs.missing.length > 0 ? (
          <p className="eac-c-media-error" role="status">
            Not everything was read: {rs.missing.join(", ")}.
          </p>
        ) : null}

        {remote && rs.loading && rs.items.length === 0 ? (
          <p className="eac-c-lib-empty" aria-busy="true">
            Opening…
          </p>
        ) : nothing ? (
          rs.error ? null : <p className="eac-c-lib-empty">{needle ? `Nothing matches “${st.q}”.` : "Nothing here yet."}</p>
        ) : listView ? (
          // Store headings also in compact (the hub card popup); site grouping stays off there (PM, 2026-11-26).
          groupBy !== "none" && (!compact || groupBy === "store") ? (
            [...groups.values()].map((g) => (
              <section key={`${g.identityId}|${g.title}`} className="eac-c-lib-group">
                <h3>
                  <strong>{g.title}</strong>
                  {groupBy === "site" && g.host && <small>{g.host}</small>}
                  {groupBy === "store" ? <small>{g.pieces.length}</small> : null}
                </h3>
                {rows(g.pieces)}
              </section>
            ))
          ) : remote || picking || compact || shown.some(isFileItem) ? (
            rows(shown)
          ) : (
            <PieceList items={shown} timeZone={timeZone} density="regular" showSite={multiSite} onOpen={activate} />
          )
        ) : groupBy !== "none" ? (
          [...groups.values()].map((g) => {
            const idm = identities.find((i) => i.id === g.identityId);
            return (
              <section key={`${g.identityId}|${g.title}`} className="eac-c-lib-group">
                <h3>
                  {idm ? <IdentityMark initials={idm.initials} kind={idm.kind} size={18} /> : null}
                  <strong>{g.title}</strong>
                  {groupBy === "site" && g.host && <small>{g.host}</small>}
                  {groupBy === "store" ? <small>{g.pieces.length}</small> : null}
                </h3>
                {bricks(g.pieces)}
              </section>
            );
          })
        ) : (
          bricks(shown)
        )}

        <CountLine>{countText}</CountLine>
        {remote ? (
          rs.nextCursor ? (
            <button type="button" className="chn-btn eac-c-lib-more" disabled={rs.loadingMore} onClick={rs.more}>
              {rs.loadingMore ? "Loading…" : "Show more"}
            </button>
          ) : null
        ) : (
          sorted.length > shown.length && (
            <button type="button" className="chn-btn eac-c-lib-more" onClick={() => setLimit((n) => n + pageSize)}>
              Show {Math.min(pageSize, sorted.length - shown.length)} more
            </button>
          )
        )}
      </div>
      {openItem && <PieceLightbox item={openItem} timeZone={timeZone} onClose={close} primary={primaryAction?.(openItem) ?? null} railSlot={railSlot?.(openItem)} actions={itemActions?.(openItem)} imagePick={mode === "pick" && pickPart === "image" ? { images: openItem.images?.length ? openItem.images : openItem.cover ? [openItem.cover] : [], onChoose: (image) => { onPick?.(openItem, { image }); close(); } } : undefined} />}
    </div>
  );
}
