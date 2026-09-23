"use client";

import { useEffect, useMemo, useState } from "react";
import { listPagesForHud, type HudPage } from "@/lib/hud-actions";

// ============================================================================
// Pages — every page of the site, to move between without leaving the editor.
//
// Puck edits one document at a time; this is the way between them. Opening a
// page loads it in the editor (`/studio/<path>`), and the browser's own
// "leave page?" prompt stands guard over unpublished changes on the page you
// are leaving. A new page is just an address: open it and it starts empty.
//
// Pages that ARE galleries say so, with how many works — the page list and
// the Galleries index describe the same site from two sides.
// ============================================================================

export function PagesPanel({ current }: { current?: string }) {
  const [pages, setPages] = useState<HudPage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [fresh, setFresh] = useState("");

  useEffect(() => {
    listPagesForHud().then((res) => ("error" in res ? setError(res.error) : setPages(res.pages)));
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    // The landing page first, and called what it is — its stored title is
    // her name, which gave no hint that it was the front door.
    return (pages ?? [])
      .map((p) => (p.slug === "home" ? { ...p, title: `Home — landing page (${p.title})` } : p))
      .filter((p) => !q || `${p.title} ${p.slug}`.toLowerCase().includes(q))
      .sort((a, b) => (a.slug === "home" ? -1 : b.slug === "home" ? 1 : 0));
  }, [pages, query]);

  const freshPath = fresh
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9/-]/g, "");

  return (
    <div className="dm-hud dm-hud-stack">
      <div className="dm-hud-spread">
        <h2>Pages</h2>
        <a className="dm-hud-muted" href="/hub">
          Hub
        </a>
      </div>
      {error ? <p className="dm-hud-error">{error}</p> : null}
      <input type="search" placeholder="Find a page" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Find a page" />
      {pages === null ? (
        <p className="dm-hud-muted">Loading…</p>
      ) : (
        <ul className="dm-hud-list" data-grid>
          {shown.map((p) => (
            <li key={p.slug} className="dm-hud-card" data-current={p.slug === current ? "true" : "false"}>
              <div className="dm-hud-card-body">
                <a className="dm-hud-card-title" style={{ display: "block", color: "inherit" }} href={`/studio/${p.slug}`}>
                  {p.title}
                </a>
                <span className="dm-hud-row" style={{ marginTop: 2 }}>
                  <span className="dm-hud-muted">{p.href}</span>
                  {p.gallery ? (
                    <span className="dm-hud-chip" data-tone="accent" title={`Gallery: ${p.gallery.title}`}>
                      gallery · {p.gallery.itemCount}
                    </span>
                  ) : null}
                </span>
              </div>
              <div className="dm-hud-row" style={{ flexWrap: "nowrap" }}>
                {p.slug === current ? (
                  <span className="dm-hud-chip">editing</span>
                ) : (
                  <a className="dm-hud-btn" href={`/studio/${p.slug}`}>
                    Edit
                  </a>
                )}
                <a className="dm-hud-btn" href={p.href} target="_blank" rel="noopener noreferrer" aria-label={`View ${p.title}`}>
                  ↗
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
      <form
        className="dm-hud-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (freshPath) window.location.href = `/studio/${freshPath}`;
        }}
      >
        <input
          type="text"
          placeholder="New page address, e.g. exhibitions/2026"
          value={fresh}
          onChange={(e) => setFresh(e.target.value)}
          aria-label="New page address"
          style={{ flex: 1, width: "auto" }}
        />
        <button type="submit" disabled={!freshPath}>
          Start
        </button>
      </form>
    </div>
  );
}
