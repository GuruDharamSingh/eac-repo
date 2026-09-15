"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * Choose images already in storage — the person's own folder, the org's
 * library, or both — to add to a gallery.
 *
 * The endpoint decides WHICH storage it lists and who may see it; this
 * component only renders what comes back. It accepts the two response shapes
 * already in the wild: `{ files: [...] }` (per-person listings, DavEntry) and
 * `{ items: [...] }` (the org media library). An optional `source` on each
 * entry ("user" | "org" | anything) becomes a filter tab, so a gallery can be
 * built from a mix of what the artist uploaded themselves and what the org
 * holds for them.
 *
 * Multi-select by design: a gallery is assembled from many files at once, and
 * a single-pick dialog repeated twenty times is how people give up.
 */

export interface LibraryEntry {
  url: string;
  name: string;
  source?: string;
}

export interface LibraryPickerProps {
  endpoint: string;
  /** Urls already in the gallery — shown but not selectable again. */
  existingUrls: Set<string>;
  onAdd: (entries: LibraryEntry[]) => void;
  onClose: () => void;
  /** Labels for the source tabs, keyed by the `source` value the endpoint returns. */
  sourceLabels?: Record<string, string>;
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif)$/i;

export function LibraryPicker({ endpoint, existingUrls, onAdd, onClose, sourceLabels }: LibraryPickerProps) {
  const [entries, setEntries] = useState<LibraryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [source, setSource] = useState<string>("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(endpoint);
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error ?? "Could not load the library");
        const raw: unknown[] = body.files ?? body.items ?? [];
        const list = raw
          .map((r) => r as Record<string, unknown>)
          .filter((r) => typeof r.url === "string" && !r.isFolder)
          .map((r) => ({
            url: String(r.url),
            name: String(r.name ?? r.filename ?? r.url),
            source: typeof r.source === "string" ? r.source : undefined,
          }))
          .filter((e) => {
            const mime = typeof (e as { mimeType?: unknown }).mimeType === "string" ? String((e as { mimeType?: unknown }).mimeType) : "";
            return mime.startsWith("image/") || IMAGE_EXT.test(e.name) || IMAGE_EXT.test(e.url);
          });
        if (!cancelled) setEntries(list);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load the library");
      }
    })();
    return () => { cancelled = true; };
  }, [endpoint]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const sources = useMemo(() => {
    const s = new Set<string>();
    for (const e of entries ?? []) if (e.source) s.add(e.source);
    return [...s];
  }, [entries]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (entries ?? []).filter((e) =>
      (source === "all" || e.source === source) &&
      (!q || e.name.toLowerCase().includes(q))
    );
  }, [entries, source, query]);

  function toggle(url: string) {
    if (existingUrls.has(url)) return;
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url); else next.add(url);
      return next;
    });
  }

  function add() {
    const chosen = (entries ?? []).filter((e) => picked.has(e.url));
    if (chosen.length) onAdd(chosen);
    onClose();
  }

  return (
    <div className="eac-lib" role="dialog" aria-modal="true" aria-label="Add from library" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="eac-lib-panel">
        <header className="eac-lib-head">
          <strong>Add from your files</strong>
          <input
            className="eac-lib-search"
            type="search"
            placeholder="Search by name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="button" className="eac-lib-x" onClick={onClose} aria-label="Close">✕</button>
        </header>

        {sources.length > 1 && (
          <nav className="eac-lib-tabs" aria-label="Where to look">
            <button type="button" className={source === "all" ? "is-on" : ""} onClick={() => setSource("all")}>All</button>
            {sources.map((s) => (
              <button key={s} type="button" className={source === s ? "is-on" : ""} onClick={() => setSource(s)}>
                {sourceLabels?.[s] ?? s}
              </button>
            ))}
          </nav>
        )}

        <div className="eac-lib-body">
          {error && <p className="eac-lib-msg">{error}</p>}
          {!error && entries === null && <p className="eac-lib-msg">Loading…</p>}
          {!error && entries !== null && shown.length === 0 && (
            <p className="eac-lib-msg">Nothing here yet. Upload an image and it will appear in your files.</p>
          )}
          <div className="eac-lib-grid">
            {shown.map((e) => {
              const inGallery = existingUrls.has(e.url);
              const on = picked.has(e.url);
              return (
                <button
                  key={e.url}
                  type="button"
                  className={`eac-lib-tile${on ? " is-picked" : ""}${inGallery ? " is-used" : ""}`}
                  onClick={() => toggle(e.url)}
                  disabled={inGallery}
                  title={inGallery ? `${e.name} — already in this gallery` : e.name}
                  aria-pressed={on}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={e.url} alt="" loading="lazy" />
                  <span className="eac-lib-name">{e.name}</span>
                  {on && <span className="eac-lib-check" aria-hidden>✓</span>}
                  {inGallery && <span className="eac-lib-check eac-lib-check--used" aria-hidden>in gallery</span>}
                </button>
              );
            })}
          </div>
        </div>

        <footer className="eac-lib-foot">
          <span className="eac-lib-count">{picked.size ? `${picked.size} selected` : "Select images to add"}</span>
          <button type="button" className="eac-lib-btn" onClick={onClose}>Cancel</button>
          <button type="button" className="eac-lib-btn eac-lib-btn--primary" onClick={add} disabled={picked.size === 0}>
            Add {picked.size || ""}
          </button>
        </footer>
      </div>
    </div>
  );
}
