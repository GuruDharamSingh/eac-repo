import type { SurfaceKind, SurfaceSize } from "./types";

// ============================================================================
// What each kind looks like at a glance: a glyph, a one-word label, and the
// width its surface opens at. The glyphs match the compose catalogue's, so the
// mark someone picked when making a thing is the mark they see on its face and
// on its masthead.
// ============================================================================

export interface KindMeta {
  label: string;
  glyph: string;
  size: SurfaceSize;
}

const KINDS: Record<SurfaceKind, KindMeta> = {
  post: { label: "Writing", glyph: "◉", size: "standard" },
  event: { label: "Event", glyph: "◆", size: "wide" },
  meeting: { label: "Meeting", glyph: "◎", size: "wide" },
  workshop: { label: "Workshop", glyph: "◈", size: "wide" },
  service: { label: "Service", glyph: "◇", size: "wide" },
  product: { label: "Product", glyph: "▣", size: "wide" },
  questionnaire: { label: "Questionnaire", glyph: "▤", size: "standard" },
  poll: { label: "Poll", glyph: "▥", size: "standard" },
  calendar: { label: "Calendar", glyph: "▦", size: "wide" },
  gallery: { label: "Gallery", glyph: "▧", size: "wide" },
  board: { label: "Board", glyph: "▥", size: "wide" },
  forum: { label: "Forum", glyph: "☰", size: "wide" },
  compose: { label: "Compose", glyph: "✎", size: "standard" },
  // Compact on purpose: a definition is one sentence, opened over the thing
  // being written rather than replacing it.
  define: { label: "Define", glyph: "§", size: "compact" },
  neutral: { label: "", glyph: "•", size: "standard" },
};

export function kindMeta(kind: string | null | undefined): KindMeta {
  return KINDS[(kind ?? "neutral") as SurfaceKind] ?? KINDS.neutral;
}

/** Narrow an arbitrary string to a kind the stylesheet has an accent for. */
export function asSurfaceKind(kind: string | null | undefined): SurfaceKind {
  return kind && kind in KINDS ? (kind as SurfaceKind) : "neutral";
}
