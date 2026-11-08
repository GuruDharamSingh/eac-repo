// ============================================================================
// Content types: label, glyph, the surface frame kind, and which panels a type
// shows. Browser-safe.
//
// Pass 1 keeps Channel's own glyph table (lib/channel/model.ts PIECE_KINDS)
// so the piece view renders exactly as before. Moving the glyphs to cms-ui's
// kindMeta, as the proposal asks, is a visible change and waits for pass 3.
// ============================================================================

import type { ContentPanelId, ContentStatus, ContentType } from "./model";

export interface ContentTypeMeta {
  id: ContentType;
  label: string;
  glyph: string;
  /** The cms-ui SurfaceFrame kind the detail opens with. */
  surfaceKind: string;
  panels: ContentPanelId[];
}

export const CONTENT_TYPES: ContentTypeMeta[] = [
  { id: "artwork", label: "Artwork", glyph: "▣", surfaceKind: "product", panels: ["coverage", "plan"] },
  { id: "product", label: "Product", glyph: "▣", surfaceKind: "product", panels: ["coverage", "plan"] },
  { id: "writing", label: "Writing", glyph: "◉", surfaceKind: "post", panels: ["coverage", "plan"] },
  { id: "video", label: "Video", glyph: "▶", surfaceKind: "gallery", panels: ["coverage", "plan"] },
  { id: "series", label: "Series", glyph: "◈", surfaceKind: "series", panels: ["coverage", "plan"] },
  { id: "meeting", label: "Meeting", glyph: "◎", surfaceKind: "meeting", panels: ["coverage", "plan"] },
  { id: "event", label: "Event", glyph: "◆", surfaceKind: "event", panels: ["coverage", "plan"] },
  { id: "workshop", label: "Workshop", glyph: "◈", surfaceKind: "workshop", panels: ["coverage", "plan"] },
  { id: "questionnaire", label: "Questionnaire", glyph: "▤", surfaceKind: "questionnaire", panels: [] },
  { id: "poll", label: "Poll", glyph: "▥", surfaceKind: "poll", panels: [] },
];

export function typeMeta(type: ContentType): ContentTypeMeta {
  return CONTENT_TYPES.find((t) => t.id === type) ?? { id: type, label: type, glyph: "·", surfaceKind: type, panels: [] };
}

export function typeLabel(type: ContentType): string {
  return CONTENT_TYPES.find((t) => t.id === type)?.label ?? type;
}

export function typeGlyph(type: ContentType): string {
  return CONTENT_TYPES.find((t) => t.id === type)?.glyph ?? "·";
}

// ── what you can make: the kind strip ──────────────────────────────────────

export type CreateKindId = "post" | "meeting" | "series" | "artwork" | "questionnaire" | "poll";

export interface CreateKindMeta {
  id: CreateKindId;
  /** "Post": one word, the tile's name. */
  label: string;
  glyph: string;
  /** One short line under the label (the tile variant). */
  hint: string;
  /** How a piece of this kind is shown in the library. */
  type: ContentType;
  /** `primary` kinds lead the strip; `more` kinds sit in its secondary row. */
  row: "primary" | "more";
  /**
   * The Studio hand-off. `kind` is the value of the Studio's `?kind=`; null is
   * the Studio's default (the writing room). `ready` is whether the Studio has
   * a form for it today (packages/studio/src/kinds.ts, StudioApp extensions);
   * a kind that is not ready is drawn as "Soon" unless the host says otherwise.
   */
  studio: { kind: string | null; ready: boolean };
}

export const CREATE_KINDS: CreateKindMeta[] = [
  { id: "post", label: "Post", glyph: "◉", hint: "An article or a note", type: "writing", row: "primary", studio: { kind: null, ready: true } },
  { id: "meeting", label: "Gathering", glyph: "◎", hint: "A date, a place, a link", type: "meeting", row: "primary", studio: { kind: "gathering", ready: true } },
  { id: "series", label: "Series", glyph: "◈", hint: "Sessions that belong together", type: "series", row: "primary", studio: { kind: "series", ready: false } },
  { id: "artwork", label: "Artwork", glyph: "▣", hint: "A work, with its details", type: "artwork", row: "primary", studio: { kind: "artwork-form", ready: true } },
  { id: "questionnaire", label: "Questionnaire", glyph: "▤", hint: "Ask people several things", type: "questionnaire", row: "more", studio: { kind: "question", ready: false } },
  { id: "poll", label: "Poll", glyph: "▥", hint: "Ask one thing", type: "poll", row: "more", studio: { kind: "poll", ready: false } },
];

export function createKind(id: CreateKindId): CreateKindMeta {
  return CREATE_KINDS.find((k) => k.id === id) ?? CREATE_KINDS[0]!;
}

export interface StudioHandoff {
  /** The Studio's address on the host. Default "/studio". */
  base?: string;
  /** `?org=`: the org to make it for; omit for the person ("Just me"). */
  org?: string | null;
  /**
   * `focus=1`: ask for the Studio's focus mode. The Studio does not read this
   * yet (focus is its default for writing and a per-browser preference,
   * `studio:focus`); it is sent so the hand-off is ready when it does. Default true.
   */
  focus?: boolean;
  /**
   * The host's own Studio link builder (2026-11-08; the forms' `FormHost.studioHref`,
   * docs/open/publishing-forms-handoff/PLAN.md §10). When set it wins over `base`:
   * `/studio` is the Puck editor on several sites, and hidden-enneagram mounts the
   * authoring Studio at `/publish`. A function, so pass it from a client module.
   */
  href?: (o: StudioHrefRequest) => string;
}

/** What `StudioHandoff.href` is asked for. `studioKind` is the Studio's `?kind=` from CREATE_KINDS (null = writing). */
export interface StudioHrefRequest {
  kind: CreateKindId;
  studioKind: string | null;
  org: string | null;
  focus: boolean;
}

/**
 * Where a kind tile goes. Only what the Studio reads today is load-bearing:
 * `?kind=` (video, post [social posts], meeting, recording, wordart; anything
 * else falls back to writing) and `?org=`. Writing is the default and carries no `kind`.
 */
export function studioNewHref(kind: CreateKindId, o: StudioHandoff = {}): string {
  const meta = createKind(kind);
  if (o.href) return o.href({ kind, studioKind: meta.studio.kind, org: o.org ?? null, focus: o.focus !== false });
  const q = new URLSearchParams();
  if (meta.studio.kind) q.set("kind", meta.studio.kind);
  if (o.org) q.set("org", o.org);
  if (o.focus !== false) q.set("focus", "1");
  const qs = q.toString();
  return `${o.base ?? "/studio"}${qs ? `?${qs}` : ""}`;
}

/** The chip words for a status. */
export const STATUS_WORD: Record<ContentStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  live: "Live",
  published: "Published",
  archived: "Archived",
};
