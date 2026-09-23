"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";

/**
 * Browse a media library: folders and pictures, a level at a time, with a
 * name search across the whole library.
 *
 * The library half of MediaPicker, split out so anything that picks pictures
 * from storage (the picker's tabs, a gallery's "add pictures") shares one
 * browser. It speaks to ONE endpoint and knows nothing about Nextcloud:
 *
 *   GET endpoint?path=<rel>&q=<search>
 *     → { path, items: [{ name, path, isFolder, url?, thumb? }], browsable: true }
 *
 * An endpoint that predates folders returns a flat `{ items | files: [{url,
 * name|filename}] }` and is shown as one flat grid, exactly as before — so the
 * apps still on the old listings keep working unchanged.
 *
 * Every picture tile can be DRAGGED. It carries MEDIA_DRAG_TYPE (and the URL
 * as text/uri-list), so a drop target anywhere in the same document — the
 * picker's own well, another block's field — can take it; see readMediaDrop.
 */

export const MEDIA_DRAG_TYPE = "application/x-eac-media";

export interface MediaBrowserItem {
  name: string;
  path: string;
  isFolder: boolean;
  url?: string;
  thumb?: string;
}

/** Put a picture on a drag. */
export function writeMediaDrag(e: DragEvent, item: { url: string; name?: string }) {
  e.dataTransfer.effectAllowed = "copy";
  e.dataTransfer.setData(MEDIA_DRAG_TYPE, JSON.stringify({ url: item.url, name: item.name ?? "" }));
  e.dataTransfer.setData("text/uri-list", item.url);
  e.dataTransfer.setData("text/plain", item.url);
}

/** Is this drag carrying a picture (or files) we can take? Safe during dragover. */
export function isMediaDrag(e: DragEvent): boolean {
  const types = Array.from(e.dataTransfer?.types ?? []);
  return types.includes(MEDIA_DRAG_TYPE) || types.includes("Files");
}

/** The picture a drop carries, or null. Only platform URLs are accepted. */
export function readMediaDrop(e: DragEvent): { url: string; name: string } | null {
  const raw = e.dataTransfer.getData(MEDIA_DRAG_TYPE);
  if (raw) {
    try {
      const v = JSON.parse(raw) as { url?: unknown; name?: unknown };
      if (typeof v.url === "string" && v.url.startsWith("/")) return { url: v.url, name: String(v.name ?? "") };
    } catch {
      /* fall through */
    }
  }
  const uri = e.dataTransfer.getData("text/uri-list").split("\n")[0]?.trim();
  if (uri && uri.startsWith("/api/media/")) return { url: uri, name: uri.split("/").pop() ?? "" };
  return null;
}

export interface MediaBrowserProps {
  endpoint: string;
  /** The picture currently chosen (single mode), highlighted. */
  value?: string;
  /** Single mode: a picture was clicked. */
  onPick?: (item: { url: string; name: string }) => void;
  /** Multi mode: the chosen URLs, and a toggle. */
  picked?: string[];
  onToggle?: (item: { url: string; name: string }) => void;
  /** Shown above the grid when empty. */
  emptyText?: string;
}

function withQuery(endpoint: string, params: Record<string, string>) {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v));
  const s = q.toString();
  return s ? `${endpoint}${endpoint.includes("?") ? "&" : "?"}${s}` : endpoint;
}

export function MediaBrowser({ endpoint, value, onPick, picked, onToggle, emptyText = "Nothing stored here yet." }: MediaBrowserProps) {
  const [path, setPath] = useState("");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<MediaBrowserItem[] | null>(null);
  const [browsable, setBrowsable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setItems(null);
    setError(null);
    try {
      const res = await fetch(withQuery(endpoint, { path, q: search }));
      const body = await res.json();
      if (mine !== seq.current) return;
      if (!res.ok) throw new Error(body?.error ?? "Could not load the library");
      const raw: Array<Record<string, unknown>> = body.items ?? body.files ?? [];
      setBrowsable(Boolean(body.browsable));
      setItems(
        raw
          .filter((r) => r.isFolder || typeof r.url === "string")
          .map((r) => ({
            name: String(r.name ?? r.filename ?? r.url ?? ""),
            path: String(r.path ?? r.url ?? r.name ?? ""),
            isFolder: Boolean(r.isFolder),
            url: typeof r.url === "string" ? r.url : undefined,
            thumb: typeof r.thumb === "string" ? r.thumb : typeof r.url === "string" ? r.url : undefined,
          }))
          // An old flat endpoint has no way into a folder; don't offer one.
          .filter((r) => body.browsable || !r.isFolder)
      );
    } catch (err) {
      if (mine !== seq.current) return;
      setItems([]);
      setError((err as Error).message);
    }
  }, [endpoint, path, search]);

  useEffect(() => {
    void load();
  }, [load]);

  // A new source starts at its top.
  useEffect(() => {
    setPath("");
    setQuery("");
    setSearch("");
  }, [endpoint]);

  // Search as you type, after a pause — each keystroke is a walk of the tree.
  useEffect(() => {
    const t = window.setTimeout(() => setSearch(query.trim()), 350);
    return () => window.clearTimeout(t);
  }, [query]);

  const crumbs = path ? path.split("/") : [];
  const folders = (items ?? []).filter((i) => i.isFolder);
  const pictures = (items ?? []).filter((i) => !i.isFolder && i.url);
  const chosen = new Set(picked ?? []);

  return (
    <div className="eac-browse">
      {browsable ? (
        <div className="eac-browse-bar">
          <input
            type="search"
            placeholder="Search every folder by name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search pictures by name"
          />
          {!search ? (
            <nav className="eac-browse-crumbs" aria-label="Folder">
              <button type="button" onClick={() => setPath("")} aria-current={!path ? "true" : undefined}>
                Top
              </button>
              {crumbs.map((c, i) => (
                <span key={i}>
                  <span aria-hidden="true">›</span>
                  <button
                    type="button"
                    onClick={() => setPath(crumbs.slice(0, i + 1).join("/"))}
                    aria-current={i === crumbs.length - 1 ? "true" : undefined}
                  >
                    {c}
                  </button>
                </span>
              ))}
            </nav>
          ) : (
            <p className="eac-picker-hint">
              {items ? `${pictures.length} found` : "Searching…"} for “{search}”
            </p>
          )}
        </div>
      ) : null}

      {items === null ? (
        <p className="eac-picker-hint">Loading…</p>
      ) : items.length === 0 ? (
        <p className="eac-picker-hint">{search ? "No picture by that name." : emptyText}</p>
      ) : (
        <>
          {folders.length ? (
            <ul className="eac-browse-folders">
              {folders.map((f) => (
                <li key={f.path}>
                  <button type="button" onClick={() => setPath(f.path)} title={f.name}>
                    <span aria-hidden="true" className="eac-browse-folder-icon" />
                    <span className="eac-browse-folder-name">{f.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {pictures.length ? (
            <>
              <p className="eac-picker-hint">
                {pictures.length} picture{pictures.length === 1 ? "" : "s"} — click to {onToggle ? "choose" : "use"}, or drag onto a
                picture well
              </p>
              <ul className="eac-picker-grid">
                {pictures.map((p) => {
                  const on = onToggle ? chosen.has(p.url!) : p.url === value;
                  return (
                    <li key={p.path}>
                      <button
                        type="button"
                        draggable
                        onDragStart={(e) => writeMediaDrag(e, { url: p.url!, name: p.name })}
                        onClick={() => (onToggle ? onToggle({ url: p.url!, name: p.name }) : onPick?.({ url: p.url!, name: p.name }))}
                        className={on ? "is-selected" : undefined}
                        aria-pressed={onToggle ? on : undefined}
                        title={search ? p.path : p.name}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.thumb ?? p.url} alt="" loading="lazy" draggable={false} />
                        {onToggle && on ? <span className="eac-browse-check" aria-hidden="true">✓</span> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}
        </>
      )}
      {error ? <p className="eac-picker-error">{error}</p> : null}
    </div>
  );
}
