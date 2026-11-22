"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { Plugin } from "@puckeditor/core";

// ============================================================================
// A "Pages" tab for the editor's left rail: every page of the site, to move
// between without leaving the editor, and a box to start a new one.
//
// Puck edits one document at a time; this is the way between them. The panel
// only lists and links: where a page opens (`hrefOf`) and how the list is read
// (`list`) come from the host, so no server action is imported here. The
// browser's own "leave page?" prompt guards unpublished changes.
//
// Look: neutral inline styles by default. A host that already styles these
// parts (danamccool's `dm-hud` sheet) passes `classes` instead, and then only
// the structure comes from here.
// ============================================================================

export interface PanelPage {
  slug: string;
  title: string;
  /** The page as visitors see it. */
  href: string;
  /** A gallery kept for this page, if the host joins them. */
  gallery?: { id: string; title: string; itemCount?: number } | null;
}

export type PagesPanelSlot =
  | "root" | "spread" | "muted" | "error" | "list" | "card" | "cardBody" | "cardTitle" | "row" | "chip" | "btn";

export interface PagesPanelProps {
  /** Reads the pages. Throw (or reject) to show a message in place of the list. */
  list: () => Promise<PanelPage[]>;
  /** Where the editor opens a page. */
  hrefOf: (slug: string) => string;
  /** The slug being edited, if any. */
  current?: string;
  /** Heading. Default "Pages". */
  title?: string;
  /** A link beside the heading (e.g. the editor hub). Absent: none. */
  hubHref?: string;
  hubLabel?: string;
  /** This page is the landing page: listed first and called so. Default "home"; `null` for none. */
  landingSlug?: string | null;
  /** Offer a box that opens `hrefOf(<typed address>)`. Default true. */
  allowNew?: boolean;
  /** The host's own class for each part. When given, the default inline look is not applied. */
  classes?: Partial<Record<PagesPanelSlot, string>>;
}

const BASE: Record<PagesPanelSlot, CSSProperties> = {
  root: { display: "grid", gap: 10, padding: 16, fontFamily: "var(--puck-font-family, system-ui)", fontSize: 13 },
  spread: { display: "flex", justifyContent: "space-between", alignItems: "baseline" },
  muted: { color: "var(--puck-color-text-secondary, #5a5a5a)", fontSize: 12 },
  error: { color: "#b00020", margin: 0 },
  list: { listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 },
  card: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: 10, border: "1px solid var(--puck-color-grey-09, #dcdcdc)", borderRadius: 8 },
  cardBody: { minWidth: 0 },
  cardTitle: { fontWeight: 600 },
  row: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" },
  chip: { fontSize: 11, padding: "1px 6px", borderRadius: 999, border: "1px solid var(--puck-color-grey-09, #dcdcdc)" },
  btn: { fontSize: 12, padding: "3px 8px", border: "1px solid var(--puck-color-grey-09, #dcdcdc)", borderRadius: 6, color: "inherit", textDecoration: "none" },
};

export function PagesPanel({
  list, hrefOf, current, title = "Pages", hubHref, hubLabel = "Hub", landingSlug = "home", allowNew = true, classes,
}: PagesPanelProps) {
  const [pages, setPages] = useState<PanelPage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [fresh, setFresh] = useState("");

  useEffect(() => {
    let live = true;
    list().then(
      (p) => { if (live) setPages(p); },
      (e) => { if (live) setError(e instanceof Error ? e.message : "The pages did not load."); },
    );
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cls = (slot: PagesPanelSlot) => classes?.[slot];
  const sty = (slot: PagesPanelSlot, extra?: CSSProperties): CSSProperties | undefined =>
    classes ? extra : { ...BASE[slot], ...extra };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    // The landing page first, and called what it is: its stored title is often a name, which gives no hint it is the front door.
    return (pages ?? [])
      .map((p) => (landingSlug && p.slug === landingSlug ? { ...p, title: `Home — landing page (${p.title})` } : p))
      .filter((p) => !q || `${p.title} ${p.slug}`.toLowerCase().includes(q))
      .sort((a, b) => (landingSlug && a.slug === landingSlug ? -1 : landingSlug && b.slug === landingSlug ? 1 : 0));
  }, [pages, query, landingSlug]);

  const freshPath = fresh
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9/-]/g, "");

  return (
    <div className={cls("root")} style={sty("root")}>
      <div className={cls("spread")} style={sty("spread")}>
        <h2 style={classes ? undefined : { margin: 0, fontSize: 15 }}>{title}</h2>
        {hubHref ? (
          <a className={cls("muted")} style={sty("muted")} href={hubHref}>
            {hubLabel}
          </a>
        ) : null}
      </div>
      {error ? <p className={cls("error")} style={sty("error")}>{error}</p> : null}
      <input type="search" placeholder="Find a page" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Find a page" />
      {pages === null ? (
        error ? null : <p className={cls("muted")} style={sty("muted")}>Loading…</p>
      ) : (
        <ul className={cls("list")} style={sty("list")} data-grid>
          {shown.map((p) => (
            <li key={p.slug} className={cls("card")} style={sty("card")} data-current={p.slug === current ? "true" : "false"}>
              <div className={cls("cardBody")} style={sty("cardBody")}>
                <a className={cls("cardTitle")} style={{ ...sty("cardTitle"), display: "block", color: "inherit" }} href={hrefOf(p.slug)}>
                  {p.title}
                </a>
                <span className={cls("row")} style={sty("row", { marginTop: 2 })}>
                  <span className={cls("muted")} style={sty("muted")}>{p.href}</span>
                  {p.gallery ? (
                    <span className={cls("chip")} style={sty("chip")} data-tone="accent" title={`Gallery: ${p.gallery.title}`}>
                      {p.gallery.itemCount == null ? "gallery" : `gallery · ${p.gallery.itemCount}`}
                    </span>
                  ) : null}
                </span>
              </div>
              <div className={cls("row")} style={sty("row", { flexWrap: "nowrap" })}>
                {p.slug === current ? (
                  <span className={cls("chip")} style={sty("chip")}>editing</span>
                ) : (
                  <a className={cls("btn")} style={sty("btn")} href={hrefOf(p.slug)}>
                    Edit
                  </a>
                )}
                <a className={cls("btn")} style={sty("btn")} href={p.href} target="_blank" rel="noopener noreferrer" aria-label={`View ${p.title}`}>
                  ↗
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
      {allowNew ? (
        <form
          className={cls("row")}
          style={sty("row")}
          onSubmit={(e) => {
            e.preventDefault();
            if (freshPath) window.location.href = hrefOf(freshPath);
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
      ) : null}
    </div>
  );
}

const ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
  </svg>
);

export interface PagesPluginOptions extends Omit<PagesPanelProps, "title"> {
  /** The tab label (and the panel heading). Default "Pages". */
  label?: string;
}

/** The Pages tab, for `PuckEditor`'s `plugins`. Make it once (useMemo): the panel reads its pages when opened. */
export function pagesPlugin({ label = "Pages", ...panel }: PagesPluginOptions): Plugin {
  return {
    name: "eac-pages",
    label,
    icon: ICON,
    render: () => <PagesPanel {...panel} title={label} />,
  };
}
