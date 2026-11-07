// ============================================================================
// The layout grid a sheet (or a list of cards) is placed on (pass 3). Each
// sheet chooses its own: how many columns, the gutter between them, and the
// baseline row height that row spans count in. Blocks store their size as a
// span in these units, so changing the grid rescales every stored span to keep
// the page looking the same (scaleSpan), and a block that never changed its
// size keeps following its template.
// ============================================================================

import type { Decl } from "./style";

export interface GridSpec { cols: number; gap: number; row: number }

/** Column counts a sheet may choose (which ones a member is offered depends on the freedom level). */
export const GRID_COLS = [4, 6, 8, 12, 16, 24] as const;
/** The 6-column sheet every page had before pass 3: templates are written in these units. */
export const GRID_DEFAULT: GridSpec = { cols: 6, gap: 10, row: 34 };
export const GRID_BOUNDS = { gap: [0, 40], row: [8, 80] } as const;
/** Row spans are capped so a block is never taller than this (px, in rows of the sheet's grid). */
export const MAX_SPAN_PX = 900;

export const gridOf = (g: Partial<GridSpec> | undefined | null): GridSpec => ({ ...GRID_DEFAULT, ...(g || {}) });
export const sameGrid = (a: GridSpec, b: GridSpec) => a.cols === b.cols && a.gap === b.gap && a.row === b.row;
export const maxRows = (g: GridSpec) => Math.max(2, Math.floor((MAX_SPAN_PX + g.gap) / (g.row + g.gap)));

/** The same visual size on another grid: columns by proportion, rows by height. */
export function scaleSpan(span: readonly [number, number], from: GridSpec, to: GridSpec): [number, number] {
  const c = Math.max(1, Math.min(to.cols, Math.round((span[0] * to.cols) / from.cols)));
  const hPx = span[1] * from.row + (span[1] - 1) * from.gap;
  const r = Math.max(1, Math.min(maxRows(to), Math.round((hPx + to.gap) / (to.row + to.gap))));
  return [c, r];
}

/** CSS for the sheet element. */
export function gridDecls(g: GridSpec): Decl[] {
  return [
    ["grid-template-columns", `repeat(${g.cols}, minmax(0, 1fr))`],
    ["grid-auto-rows", `minmax(${g.row}px, auto)`],
    ["gap", `${g.gap}px`],
  ];
}

/** Server-side: an allowed column count and gutter / row height in bounds, else undefined. */
export function cleanGrid(v: unknown): GridSpec | undefined {
  if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
  const g = v as Record<string, unknown>;
  const cols = typeof g.cols === "number" && (GRID_COLS as readonly number[]).includes(g.cols) ? g.cols : null;
  const n = (x: unknown, [lo, hi]: readonly [number, number]) => (typeof x === "number" && isFinite(x) ? Math.round(Math.max(lo, Math.min(hi, x))) : null);
  const gap = n(g.gap, GRID_BOUNDS.gap), row = n(g.row, GRID_BOUNDS.row);
  if (cols === null || gap === null || row === null) return undefined;
  return { cols, gap, row };
}

/** How many columns / rows a size in px covers on a grid whose column step is `step` px (column + gutter). */
export const spanOfPx = (sizePx: number, step: number, gap: number, max: number, round: (n: number) => number = Math.round) =>
  Math.max(1, Math.min(max, round((sizePx + gap) / step)));
