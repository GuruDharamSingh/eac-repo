// ============================================================================
// The essay document: a ProseMirror/TipTap JSON tree, typed loosely.
//
// This package is the one place that knows the block vocabulary. The Studio's
// canvas edits this shape; `renderEssayHtml` turns it into the sanitised HTML
// every site already renders (docs/open/BLOCK_CANVAS_BRIEF_2026-09-27.md
// §3.2). No React, no DOM: it runs in a server action.
// ============================================================================

export interface EssayMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface EssayNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: EssayNode[];
  marks?: EssayMark[];
  text?: string;
}

export interface EssayDoc {
  type: 'doc';
  content?: EssayNode[];
}

/** The three widths a block may take. Nothing else exists (brief §6, rule 2). */
export type EssayWidth = 'content' | 'wide' | 'full';

/** Block node names the canvas adds beyond StarterKit. */
export const ESSAY_NODES = {
  image: 'essayImage',
  pullQuote: 'pullQuote',
  aside: 'aside',
  divider: 'divider',
  threadCard: 'threadCard',
  figureText: 'figureText',
  gallery: 'gallery',
} as const;

/** What a live card carries. Snapshot fields render as the fallback. */
export interface ThreadCardAttrs {
  threadId: string;
  /** `writing | meeting | event | workshop | artwork | post` — decides the card face. */
  kind: string;
  title: string;
  /** One line under the title: "Sun 18 Oct · 9:00 · Main hall" or "Oil on panel · 60 × 80 cm". */
  meta: string | null;
  href: string | null;
  coverImageUrl: string | null;
  /** Artwork: "1,800 CAD" or null; whether it is offered for sale. */
  price: string | null;
  forSale: boolean;
  view: 'card' | 'compact';
  width?: EssayWidth;
}

export interface RenderOptions {
  /**
   * `page`: the grid and `eac-` classes article.css styles.
   * `email`: single column, inline styles, live cards as plain links.
   */
  profile?: 'page' | 'email';
}
