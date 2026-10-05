// ============================================================================
// The Studio's contract with its host.
//
// The Studio is the third layer of authoring on the network (brief:
// docs/open/STUDIO_BRIEF_2026-09-27.md). The org sites keep their writing
// desk for a quick piece, the compose surface keeps quick posts, and this is
// where a person manages everything they have made. It has no data access of
// its own: the host binds server actions and passes them in, the same rule
// WritingDesk follows, so the package can sit in arts-collective today and in
// ArtDirect later without knowing which.
//
// Kinds are registered, not hard-coded: the shell renders its tab row from
// `StudioKind[]` and a kind that is not yet built appears as a tab that says
// so. Writing is the first kind wired up.
// ============================================================================

import type { EssayDoc, ThreadCardAttrs } from '@elkdonis/utils/essay';

export type StudioKindId =
  | 'writing'
  | 'artwork'
  | 'event'
  | 'meeting'
  | 'workshop'
  | 'service'
  | 'question'
  | 'video';

export interface StudioKind {
  id: StudioKindId;
  label: string;
  /** What one of them is called: "piece", "work", "event". */
  noun: string;
  /** False renders the tab but not an editor behind it. */
  ready: boolean;
  /** A kind with its own page (Video: /studio/video) links there instead of opening an editor here. */
  href?: string;
}

/** An org the person may act for. `oad` is "Just me": the directory. */
export interface StudioOrg {
  orgId: string;
  name: string;
  slug: string;
}

export interface StudioViewer {
  userId: string;
  displayName: string;
  /** Person slug on the directory; null when the profile has none yet. */
  slug: string | null;
}

export interface StudioPieceSummary {
  id: string;
  slug: string;
  title: string;
  lede: string | null;
  coverImageUrl: string | null;
  status: 'draft' | 'published';
  publishedAt: string | null;
  updatedAt: string;
  readingMinutes: number | null;
  series: string | null;
}

export interface StudioPiece extends StudioPieceSummary {
  authorId: string;
  orgId: string;
  bodyHtml: string;
  /** The essay canvas's document when the piece was last saved from it. */
  bodyDoc: EssayDoc | null;
  bodyFormat: 'html' | 'md' | 'mdx' | 'doc';
  layout: StudioLayout | null;
  /** Published as: a pen name or an org identity; null = the author's own name. */
  byline: { userId: string; name: string } | null;
  seo: { title: string | null; description: string | null; imageUrl: string | null; noindex: boolean } | null;
}

export interface StudioIdentity {
  id: string;
  name: string;
  relation: 'self' | 'pseudonym' | 'organization';
}

export type StudioLayout = 'essay' | 'feature' | 'note' | 'announcement' | 'document';
export const STUDIO_LAYOUTS: Array<{ id: StudioLayout; label: string; hint: string }> = [
  { id: 'essay', label: 'Essay', hint: 'Cover above the title, a drop cap' },
  { id: 'feature', label: 'Feature', hint: 'Cover across the page, a large title' },
  { id: 'note', label: 'Note', hint: 'No cover, a small title' },
  { id: 'announcement', label: 'Announcement', hint: 'Title on a coloured band' },
  { id: 'document', label: 'Document', hint: 'The plain page' },
];

export interface StudioListing {
  orgs: Array<{ orgId: string; name: string }>;
  selected: string[];
  homeOrgId: string;
}

export interface StudioPatch {
  title?: string;
  lede?: string | null;
  bodyHtml?: string;
  /** From the canvas; wins over bodyHtml and is rendered on the server. */
  bodyDoc?: EssayDoc;
  coverImageUrl?: string | null;
  layout?: StudioLayout | null;
  series?: string | null;
  /** The identity id to publish as; null = own name. The host validates it. */
  bylineId?: string | null;
  seo?: { title?: string | null; description?: string | null; imageUrl?: string | null; noindex?: boolean } | null;
  status?: 'draft' | 'published';
}

export type StudioResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { value?: undefined } : { value: T }))
  | { ok: false; error: string };

/**
 * Everything the shell can do to the world. Server actions, bound by the
 * host; every one re-checks the session and the row it touches.
 */
export interface StudioActions {
  /** `orgId` null = everything the person has written; else what that org's site shows. */
  listPieces(orgId: string | null): Promise<StudioPieceSummary[]>;
  loadPiece(id: string): Promise<{ post: StudioPiece; listing: StudioListing } | null>;
  startPiece(orgId: string, title: string): Promise<StudioResult<{ id: string }>>;
  savePiece(id: string, patch: StudioPatch): Promise<StudioResult<StudioPiece>>;
  removePiece(id: string): Promise<StudioResult>;
  setListing(id: string, orgIds: string[]): Promise<StudioResult>;
  /** The account's acting identities: self, pen names, orgs it may speak for. */
  listIdentities(): Promise<StudioIdentity[]>;
  /** The author's series, most recent first. */
  listSeries(): Promise<Array<{ name: string; count: number }>>;
  /** The canvas's card picker: the writer's own things of one kind, by title. */
  searchThreads(kind: string, q: string): Promise<Array<Omit<ThreadCardAttrs, 'view'>>>;
}

export interface StudioUpload {
  /** POST multipart: `file` plus `fields`; the response carries `{ url }`. */
  endpoint: string;
  /** Extra fields; `orgSlug` is added by the shell from the acting org. */
  fields?: Record<string, string>;
}

export interface StudioLinks {
  /** Where "←" goes. */
  hubHref: string;
  /**
   * Where a piece reads on the directory, without the trailing slug:
   * `<ARTDIRECT_URL>/<person slug>/writing`. A string, not a function, because
   * the host is a server component and React cannot pass a function to this
   * client shell. Null when the person has no directory slug yet.
   */
  pieceBase: string | null;
  /**
   * Media libraries the drawer browses and drags from. `mine` is the person's
   * own storage; `org` has `:org` replaced by the acting org's slug and is
   * offered when the acting org is not the directory.
   */
  library?: { mine?: string; org?: string };
}
