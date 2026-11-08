// What a host supplies so the Site Builder entries can write its pages
// (2026-11-08, hub cards PLAN §3). The runners stay in the registry (audit,
// door, allow-list, site binding); the app-specific parts of a page are the
// host's: its Puck save pipeline (lane D: cleanBoxDoc + resolved-key strip),
// its reserved slugs, its starting documents and where its template pages'
// copy lives. Passed per call by the host's server action through
// performHubAction, so nothing is registered globally.

export interface SiteSlotTarget {
  key: string;
  /** org_site_sections.section_key and the field inside its content jsonb. */
  section: string;
  field: string;
  type: string;
}

export interface SiteBuilderAdapter {
  /** The app's template pages (its site.siteBuilder declaration): page id = path. */
  templatePages: ReadonlyArray<{ path: string; title: string; slots: ReadonlyArray<SiteSlotTarget> }>;
  /** Path segments a new page may have (sunjay 1: nested paths collide with /[feed]/[slug]). */
  maxDepth: number;
  /** The host's Puck save pipeline. Every doc the card writes goes through it. */
  sanitizeDoc(doc: unknown): unknown;
  /** Why a path can't be a new page (reserved, a feed, an app route), or null. */
  pathProblem(path: string): Promise<string | null>;
  /** A starting document for one of the host's pageStarts ids; null = unknown start. */
  startDoc(start: string, path: string, title: string): Promise<unknown | null>;
  loadPage(path: string): Promise<unknown | null>;
  savePage(path: string, doc: unknown): Promise<{ ok: boolean; error?: string }>;
  /** After a write: revalidate the host's caches for a path ('' = home; '*' = everything). */
  revalidate?(path: string): void;
}
