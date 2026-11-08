// ============================================================================
// Content types: label, glyph, the surface frame kind, and which panels a type
// shows. Browser-safe.
//
// Pass 1 keeps Channel's own glyph table (lib/channel/model.ts PIECE_KINDS)
// so the piece view renders exactly as before. Moving the glyphs to cms-ui's
// kindMeta, as the proposal asks, is a visible change and waits for pass 3.
// ============================================================================

import type { ContentPanelId, ContentType } from "./model";

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
