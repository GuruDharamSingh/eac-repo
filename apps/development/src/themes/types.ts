// Shapes for the /themes view (theme editor with site preview). Client-safe: types only.

export interface SiteVarRow {
  name: string;
  value: string;
  /** themes.json kind: color | hsl-triplet | background | font | length | shadow | timing | alias | other */
  kind: string;
  family: string;
}

export interface SiteFamily {
  id: string;
  count: number;
  description: string;
}

/** danamccool's own palette model: one role sets several variables; a role may follow another until set. */
export interface PaletteRole {
  key: string;
  label: string;
  group: string;
  vars: string[];
  fallback: string;
  follows?: string;
}

/** One block on a mock page: a registry block id, or a hand-kept markup snippet for code-drawn sections. */
export interface SiteBlockRef {
  id: string;
  kind?: "html";
  label?: string;
  html?: string;
}

export interface SitePage {
  slug: string;
  label: string;
  /** Where the order came from, shown under the page switcher. */
  source?: string;
  blocks: SiteBlockRef[];
}

export interface ThemeSite {
  id: string;
  label: string;
  /** How this site changes its look today (themes.json `editor`). */
  editor: string;
  vars: SiteVarRow[];
  families: SiteFamily[];
  roles: PaletteRole[];
  /** Font choices when the site has no SITE_STYLE schema (labels from themes.json schemaFonts). */
  fontChoices: { label: string; stack: string }[];
  /** The site's stylesheets scoped under [data-mock-app="theme-<id>"], with media queries turned into @container tp queries. */
  css: string;
  /** Header + footer markup around <div data-tp-slot>. */
  frame: string;
  pages: SitePage[];
  hasSchema: boolean;
  /** role id -> this site's variable for it (only roles the site has). */
  roleMap: Record<string, RoleBinding>;
}

/** L's theme vocabulary (theme-roles.json): one list of plain-language roles every site maps onto. */
export interface ThemeRoleDef {
  id: string;
  label: string;
  group: string;
  core: boolean;
  description: string;
}

/** What one site uses for one role: its own variable and that variable's value today. */
export interface RoleBinding {
  var: string;
  value: string;
  hex?: string;
}
