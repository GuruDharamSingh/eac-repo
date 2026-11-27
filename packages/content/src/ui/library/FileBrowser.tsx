"use client";

import * as React from "react";
import type { ContentListItem } from "../../model";
import { PieceLightbox, type PieceLightboxAction } from "../PieceLightbox";
import { CountLine, SearchBox, SegGroup, ViewToggle } from "./bar";
import { FileBrick, FileRow } from "./file-tiles";
import { fileToListItem, folderItemToListItem } from "./file-model";
import { EMPTY_LISTING, KIND_WORD, acceptsFile, kindOf, noun, parseListing, readStore, withQuery, writeStore, type FolderItem, type KindFilter, type Listing } from "./file-utils";
import { FolderChips, PathBar, useFolderHistory, type FolderSource } from "./folder-nav";
import { UploadButton, useDropZone, useUpload, type LibraryUpload } from "./upload";

// ============================================================================
// FileBrowser: the files view of ContentLibrary with `folders` (CONTRACT §7).
//
// This is MediaLibrary's body, moved here (2026-11-26) and built from the shared parts in this folder:
//   bar 1  search · upload · Grid | List          (ContentLibrary: search · sort · view)
//   bar 2  sources as the scope toggle · kind     (ContentLibrary: scope · kind · status)
//   path   Back / Forward / Up and breadcrumbs    (the hub Files card's navigation)
//   body   folders as a row of chips, then files as bricks or rows
//   box    a file opens a lightbox (browse), or is picked on click (pick)
//
// Each source is one endpoint the server decides the root of from the session. It reads
//
//   GET endpoint?path=&q=&<params>
//     { path, browsable: true, items: [{ name, path, isFolder, url?, thumb?,
//       mimeType?, size?, lastModified?, shortcut?: { source, path } }] }
//
// and, unchanged, FileBrowser's `{ files: [...] }` (folders opened by name) and the flat
// `{ items | files: [{ url, name }] }` of the first library routes (one run of files, no folders).
// A source with no endpoint of its own is read from `endpoint?source=<key>` (the folders route, §5).
// What a pick MEANS (link, or copy into the destination) is the host's attach route's decision: this
// reports which source and path were chosen, as a ContentListItem (`store: "file"`, `file.source`, `file.path`).
// ============================================================================

export interface FileBrowserProps {
  sources: FolderSource[];
  /** The folders route for sources without an endpoint of their own. */
  endpoint?: string;
  mode?: "browse" | "pick" | "pickMany";
  value?: string;
  picked?: string[];
  onPick?: (item: ContentListItem) => void;
  onToggle?: (item: ContentListItem) => void;
  accept?: string;
  upload?: LibraryUpload;
  onUploaded?: (item: ContentListItem) => void;
  /** browse: return true when the host has opened its own frame; the lightbox is then skipped. */
  onOpen?: (item: ContentListItem) => boolean | void;
  /** browse: the lightbox's lead button for a file ("Use as cover", "Attach to this stop"). */
  primaryAction?: (item: ContentListItem) => PieceLightboxAction | null;
  railSlot?: (item: ContentListItem) => React.ReactNode;
  itemActions?: (item: ContentListItem) => PieceLightboxAction[];
  header?: React.ReactNode;
  rememberAs?: string;
  defaultView?: "grid" | "list";
  initialSource?: string;
  emptyText?: string;
  className?: string;
  density?: "full" | "compact";
}

export function FileBrowser({
  sources,
  endpoint,
  mode = "browse",
  value,
  picked,
  onPick,
  onToggle,
  accept = "*",
  upload,
  onUploaded,
  onOpen,
  primaryAction,
  railSlot,
  itemActions,
  header,
  rememberAs = "eac-mlib",
  defaultView = "grid",
  initialSource,
  emptyText = "This folder is empty.",
  className,
  density,
}: FileBrowserProps) {
  const nav = useFolderHistory(sources, initialSource, rememberAs);
  const { source, path, pos, history } = nav;

  const [view, setView] = React.useState<"grid" | "list">(defaultView);
  const [kind, setKind] = React.useState<KindFilter>("all");
  const [query, setQuery] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [listing, setListing] = React.useState<Listing | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [reload, setReload] = React.useState(0);
  const [open, setOpen] = React.useState<{ raw: FolderItem | null; item: ContentListItem } | null>(null);
  const opener = React.useRef<HTMLElement | null>(null);
  const seq = React.useRef(0);

  // The remembered view.
  React.useEffect(() => {
    const v = readStore(rememberAs, "view");
    if (v === "grid" || v === "list") setView(v);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Search as you type, after a pause: each search walks the source's tree.
  React.useEffect(() => {
    const t = window.setTimeout(() => setSearch(query.trim()), 350);
    return () => window.clearTimeout(t);
  }, [query]);

  React.useEffect(() => {
    if (!source) return;
    const mine = ++seq.current;
    setListing(null);
    setError(null);
    const url = source.endpoint
      ? withQuery(source.endpoint, { ...(source.params ?? {}), path, q: search })
      : withQuery(endpoint ?? "", { source: source.key, ...(source.params ?? {}), path, q: search });
    fetch(url)
      .then(async (r) => {
        const body = (await r.json().catch(() => ({}))) as Record<string, unknown>;
        if (mine !== seq.current) return;
        if (!r.ok) {
          setError(typeof body.error === "string" ? body.error : r.status === 403 ? "You can't open this folder." : "Could not open this folder.");
          setListing(EMPTY_LISTING);
          return;
        }
        setListing(parseListing(body));
        if (!search) writeStore(rememberAs, `path:${source.key}`, path);
      })
      .catch(() => {
        if (mine !== seq.current) return;
        setError("Could not reach the files.");
        setListing(EMPTY_LISTING);
      });
  }, [source, path, search, reload, rememberAs, endpoint]);

  const upl = useUpload({
    upload,
    accept,
    onUploaded: (f) => {
      const made = fileToListItem(f, { source: "upload", path: f.path, sourceLabel: "Upload" });
      onUploaded?.(made);
      if (mode === "pick") onPick?.(made);
      if (mode === "pickMany") onToggle?.(made);
      setReload((n) => n + 1);
    },
  });
  const takesDrops = mode !== "browse" || Boolean(upload);
  const drop = useDropZone({
    enabled: takesDrops,
    onTile: (tile) => {
      // A tile dragged from another library on the page: picked as it is.
      const made = fileToListItem({ url: tile.url, name: tile.name }, { source: "drop", path: "", sourceLabel: "" });
      if (mode === "pick") onPick?.(made);
      else if (mode === "pickMany") onToggle?.(made);
    },
    onFile: (f) => void upl.run(f),
  });

  if (!source) return null;

  const clearSearch = () => {
    setQuery("");
    setSearch("");
  };
  function go(next: { source: string; path: string }) {
    if (nav.go(next)) clearSearch();
  }
  function switchSource(key: string) {
    const s = sources.find((x) => x.key === key);
    if (!s || key === source!.key) return;
    go({ source: key, path: readStore(rememberAs, `path:${key}`) ?? s.startPath ?? "" });
  }
  function openFolder(item: FolderItem) {
    if (item.shortcut) go(item.shortcut);
    else go({ source: source!.key, path: listing?.ownPaths ? item.path : path ? `${path}/${item.name}` : item.name });
  }
  function saveView(v: "grid" | "list") {
    setView(v);
    writeStore(rememberAs, "view", v);
  }
  const asItem = (item: FolderItem): ContentListItem =>
    folderItemToListItem(item, {
      source: source!.key,
      path: listing?.ownPaths ? item.path : path ? `${path}/${item.name}` : item.name,
      sourceLabel: source!.label,
    });

  function closeBox() {
    setOpen(null);
    requestAnimationFrame(() => opener.current?.focus());
  }
  function activate(raw: FolderItem, el: HTMLElement) {
    const li = asItem(raw);
    if (mode === "pick") onPick?.(li);
    else if (mode === "pickMany") onToggle?.(li);
    else {
      if (onOpen?.(li) === true) return;
      opener.current = el;
      setOpen({ raw, item: li });
    }
  }

  const all = (listing?.items ?? []).filter((i) => i.isFolder || acceptsFile(accept, i));
  const kindsHere = [...new Set(all.filter((i) => !i.isFolder).map(kindOf))];
  const files = all.filter((i) => !i.isFolder && (kind === "all" || kindOf(i) === kind));
  const folders = search ? [] : all.filter((i) => i.isFolder);
  const chosen = new Set(mode === "pickMany" ? picked ?? [] : mode === "pick" && value ? [value] : []);
  const up = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";

  const tile = (item: FolderItem) => ({
    item,
    mode,
    on: chosen.has(item.url!),
    searching: Boolean(listing?.search),
    onActivate: (el: HTMLElement) => activate(item, el),
  });

  const lead = open && primaryAction ? primaryAction(open.item) : null;

  return (
    <div
      className={`eac-c eac-c-lib eac-c-media${drop.dragging ? " is-dragging" : ""}${className ? ` ${className}` : ""}`}
      data-mode={mode}
      data-density={density}
      onKeyDown={(e) => {
        if (open && e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          closeBox();
        }
      }}
      {...drop.handlers}
    >
      <div className="eac-c-lib-content" inert={open ? true : undefined}>
        {header}
        <div className="eac-c-lib-bar">
          <SearchBox
            placeholder={listing?.searchable || query ? `Search ${source.label} by name` : "Search needs a folder library"}
            disabled={!listing?.searchable && !query}
            value={query}
            onChange={setQuery}
          />
          <div className="eac-c-lib-filters">
            <UploadButton upload={upload} accept={accept} busy={upl.busy} inputRef={upl.inputRef} onFile={(f) => void upl.run(f)} />
            <ViewToggle value={view} options={[{ value: "grid", label: "Grid" }, { value: "list", label: "List" }]} onChange={saveView} />
          </div>
        </div>

        <div className="eac-c-lib-bar">
          {sources.length > 1 ? <SegGroup label="Where to look" value={source.key} options={sources.map((s) => ({ value: s.key, label: s.label }))} onChange={switchSource} /> : <span />}
          {kindsHere.length > 1 ? (
            <div className="eac-c-lib-filters">
              <SegGroup<KindFilter>
                small
                label="Kind"
                value={kind}
                options={[{ value: "all" as KindFilter, label: "All" }, ...(Object.keys(KIND_WORD) as Array<Exclude<KindFilter, "all">>).filter((k) => kindsHere.includes(k)).map((k) => ({ value: k as KindFilter, label: KIND_WORD[k] }))]}
                onChange={setKind}
              />
            </div>
          ) : null}
        </div>

        <PathBar
          sourceLabel={source.label}
          path={path}
          pos={pos}
          historyLength={history.length}
          canUp={Boolean(path) && Boolean(listing?.navigable)}
          searching={search ? `${listing ? noun(files.length, "file", "files") + " found" : "Searching…"} for “${search}”` : undefined}
          onBack={() => nav.setPos((p) => Math.max(0, p - 1))}
          onForward={() => nav.setPos((p) => Math.min(history.length - 1, p + 1))}
          onUp={() => go({ source: source.key, path: up })}
          onCrumb={(to) => go({ source: source.key, path: to })}
        />

        {drop.dragging ? <p className="eac-c-media-dropnote">{mode === "browse" ? "Drop to upload here" : "Drop to use this file"}</p> : null}

        {listing === null ? (
          <p className="eac-c-lib-empty">Opening…</p>
        ) : error ? (
          <p className="eac-c-lib-empty">{error}</p>
        ) : folders.length === 0 && files.length === 0 ? (
          <p className="eac-c-lib-empty">{search ? "Nothing by that name." : kind !== "all" ? `No ${KIND_WORD[kind as Exclude<KindFilter, "all">].toLowerCase()} here.` : emptyText}</p>
        ) : (
          <>
            <FolderChips folders={folders} onOpen={openFolder} />
            {files.length === 0 ? null : view === "grid" ? (
              <ul className="chn-bricks">
                {files.map((item) => (
                  <FileBrick key={item.path} {...tile(item)} />
                ))}
              </ul>
            ) : (
              <ul className="eac-c-rows">
                {files.map((item) => (
                  <FileRow key={item.path} {...tile(item)} />
                ))}
              </ul>
            )}
          </>
        )}

        {listing && (folders.length > 0 || files.length > 0) ? (
          <CountLine>
            {[folders.length ? noun(folders.length, "folder", "folders") : "", files.length ? noun(files.length, "file", "files") : ""].filter(Boolean).join(" · ")}
            {mode === "pick" && files.length ? " · click to use, or drag onto a picture well" : ""}
            {mode === "pickMany" ? ` · ${chosen.size} chosen` : ""}
          </CountLine>
        ) : null}
        {upl.error ? (
          <p className="eac-c-media-error" role="alert">
            {upl.error}
          </p>
        ) : null}
      </div>

      {open ? <PieceLightbox item={open.item} timeZone="UTC" onClose={closeBox} primary={lead} railSlot={railSlot ? railSlot(open.item) : undefined} actions={itemActions?.(open.item)} /> : null}
    </div>
  );
}
