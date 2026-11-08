// Site Builder: the data the face, pop-up and detail page draw, and the
// per-site declaration an app exports from site.ts. README "State management"
// + PLAN §3. Serializable.

export type PageKind = 'editor' | 'template';
export type SlotType = 'text' | 'url' | 'textarea' | 'rich' | 'image';

// ── the declaration (from the app's site.ts; in the shell, from the site template) ──

export interface CopySlotDeclaration {
  /** Stable within the page: "hero.image". */
  key: string;
  group: string;
  label: string;
  type: SlotType;
  /** Where it's stored: org_site_sections.section_key and the field inside its content jsonb. */
  section: string;
  field: string;
  hint?: string;
  rows?: number;
  placeholder?: string;
}

export interface TemplatePageDeclaration {
  /** '' = home. */
  path: string;
  title: string;
  slots: CopySlotDeclaration[];
  /** "Draws every event page", "Draws every page". */
  sharedLayoutFor?: string;
}

export type Look = 'paper' | 'framed' | 'gallery';

export interface SiteBuilderDeclaration {
  templatePages: TemplatePageDeclaration[];
  /** Until a shared look exists (smart-components §2.6), the site states it. */
  look: Look;
  /** New page "Start from" tiles this host offers (sunjay NEW_PAGE_STARTS → blank/services/writing). */
  pageStarts: Array<{ id: string; name: string; note: string }>;
  /** Path segments a new page may have (sunjay: 1, nested paths collide with /[feed]/[slug]). */
  maxDepth: number;
  /** Puck storage slug → site path, when the key isn't the address ('landing' → ''). */
  pathOf?: Record<string, string>;
  /** Editor documents that draw many pages (sunjay event-detail): listed with the accent note. */
  sharedLayouts?: Array<{ key: string; title: string; draws: string }>;
  /** Storage slugs never listed. */
  hidden?: string[];
  /**
   * The theme as the card states it. `colors` are the site's own defaults (its CSS);
   * `vars` names the site_themes variable that overrides each role, when the site
   * stores a theme (ifac --paper/--oxide…). Fonts are family names.
   */
  theme: {
    colors: ThemeColors;
    headingFont: string;
    bodyFont: string;
    vars?: Partial<Record<keyof ThemeColors, string>>;
  };
}

// ── loaded data ──

export interface CopySlot extends CopySlotDeclaration {
  value: string;
}

export interface SitePage {
  /** Stable id: the site path ('' = home). */
  id: string;
  title: string;
  /** '' = home, 'exhibitions/after-image' = nested. */
  path: string;
  depth: number;
  kind: PageKind;
  thumbnailUrl: string | null;
  updatedAt: string | null;
  /** null until site_page_meta exists (migration A). */
  updatedBy: string | null;
  /** Hub-only. null = the notes store isn't there yet (the textarea is hidden, not empty). */
  notes: string | null;
  linkPreview: string | null;
  sharedLayoutFor: string | null;
  copySlots: CopySlot[];
  /** Colour roles this page overrides (site_themes page_key ≠ ''). */
  exception: Partial<ThemeColors> | null;
}

export interface ThemeColors {
  paper: string;
  surface: string;
  ink: string;
  line: string;
  accent: string;
  accent2: string;
  frame: string;
}

export interface SiteThemeSummary {
  look: Look;
  headingFont: string;
  bodyFont: string;
  colors: ThemeColors;
}

export type OrgKind = 'artist' | 'collective' | 'services' | 'store' | 'gatherings' | 'writing';

export interface OrgIdentity {
  name: string;
  /** ≤ 120 */
  line: string;
  where: string;
  markUrl: string | null;
  markName: string | null;
  /** null until the kinds column exists (migration E). */
  primaryKind: OrgKind | null;
  alsoKinds: OrgKind[];
}

export interface SavedTemplate {
  id: string;
  name: string;
  description: string;
  fromPage: string;
  createdBy: string;
  createdAt: string;
  blockCount: number;
}

export interface SiteBuilderCan {
  editPages: boolean;
  createPages: boolean;
  editTheme: boolean;
  editIdentity: boolean;
  /** Store-backed features that are absent until their migration lands. */
  notes: boolean;
  savedTemplates: boolean;
  kinds: boolean;
}

export interface SiteBuilderFaceData {
  org: { name: string; mark: string; domain: string };
  pages: SitePage[];
  lastEdited: SitePage | null;
  theme: SiteThemeSummary;
  identity: OrgIdentity;
  can: SiteBuilderCan;
}

export interface SiteBuilderDetailData extends SiteBuilderFaceData {
  savedTemplates: SavedTemplate[];
  pageStarts: SiteBuilderDeclaration['pageStarts'];
}

// README copy, verbatim.
export const KIND_LEGEND: Record<PageKind, string> = {
  editor: 'Laid out block by block in the visual editor.',
  template: 'A fixed layout with copy slots you fill in here.',
};

export const LOOK_NOTE: Record<Look, { name: string; note: string }> = {
  paper: { name: 'Paper', note: 'Hairline rules around cards and panels. Quiet and bookish.' },
  framed: { name: 'Framed', note: 'A coloured frame around panels, galleries and the footer.' },
  gallery: { name: 'Gallery', note: 'No rules. Cards sit on the panel colour and images lead.' },
};

export const COLOUR_ROLE: Record<keyof ThemeColors, string> = {
  paper: 'Page background',
  surface: 'Panel background',
  ink: 'Text',
  line: 'Rules & borders',
  accent: 'Accent',
  accent2: 'Second accent',
  frame: 'Frame',
};

export const ORG_KINDS: Array<{ id: OrgKind; name: string; note: string }> = [
  { id: 'artist', name: 'Artist', note: 'One person’s work: a portfolio, a studio, commissions.' },
  { id: 'collective', name: 'Collective', note: 'A group whose members make, show or meet together.' },
  { id: 'services', name: 'Services', note: 'Sessions, lessons or work people book.' },
  { id: 'store', name: 'Store', note: 'Things for sale through the marketplace.' },
  { id: 'gatherings', name: 'Gatherings', note: 'Meetings, groups and events people come to.' },
  { id: 'writing', name: 'Writing', note: 'Articles, essays and reading lists.' },
];

/** README 1j: lowercase; apostrophes removed; other non-alphanumerics → '-'; trimmed. */
export function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * The registry entries the Site Builder card calls (its host door's allow-list),
 * with their inputs. Entries behind a pending migration are refused by the
 * server until it is applied; the UI hides them through `can.*`.
 *   site-section-save          { pageId, values: Record<slotKey, string> }    copy slots → org_site_sections
 *   site-page-create           { title, path, start: string, fromPath?, templateId? } → Puck page (sanitised)
 *   site-page-meta-save        { pageId, title?, notes?, linkPreview? }       needs migration 256 (can.notes)
 *   site-template-save         { fromPath, name }                             needs migration 257 (can.savedTemplates)
 *   site-identity-save         { name, line, where, markUrl?, primaryKind?, alsoKinds? } kinds need migration 260 (can.kinds)
 *   site-theme-exception-remove { pageId }                                    site_themes row for that page
 */
export const SITE_BUILDER_ACTIONS = [
  "site-section-save",
  "site-page-create",
  "site-page-meta-save",
  "site-template-save",
  "site-identity-save",
  "site-theme-exception-remove",
] as const;
