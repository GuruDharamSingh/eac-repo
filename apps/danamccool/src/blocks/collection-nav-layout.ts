// ============================================================================
// Where each Collections navigator tile sits — shared by the block (server)
// and its Arrange window (editor), so both place tiles identically.
//
// The grid is the Gallery grid's: 12 columns, rows as tall as a column is
// wide (so w === h is a square at any width), measured in whole cells.
// A block's `layout` prop is JSON: { [tileKey]: { x, y, w, h, fx?, fy?, zoom? } }.
// A tile with no entry is placed after the arranged ones, `perRow` across.
// ============================================================================

export const COLS = 12;

export interface Place {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Focal point in the tile, 0–100 % (CSS object-position). */
  fx?: number;
  fy?: number;
  /** 1 = fill the tile, up to 4. */
  zoom?: number;
}

export interface TileRow {
  image?: unknown;
  label?: unknown;
  link?: unknown;
  key?: unknown;
}

const int = (v: unknown, lo: number, hi: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : undefined;
const num = (v: unknown, lo: number, hi: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : undefined;

/**
 * Each tile's key for the layout: its stored `key`, or its position for a row
 * saved before it had one. A copied row carries its original's key, so a
 * repeat is told apart by its position.
 */
export function tileKeys(tiles: TileRow[]): string[] {
  const seen = new Set<string>();
  return tiles.map((t, i) => {
    const own = typeof t.key === "string" && t.key ? t.key : `i${i}`;
    const k = seen.has(own) ? `${own}#${i}` : own;
    seen.add(k);
    return k;
  });
}

/** The stored layout, cleaned; anything malformed is dropped. */
export function parseLayout(raw: unknown): Record<string, Place> {
  let obj: unknown = raw;
  if (typeof raw === "string") {
    try {
      obj = raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }
  if (!obj || typeof obj !== "object") return {};
  const out: Record<string, Place> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (!v || typeof v !== "object") continue;
    const r = v as Record<string, unknown>;
    const w = int(r.w, 1, COLS);
    const h = int(r.h, 1, 24);
    const x = int(r.x, 0, COLS - 1);
    const y = int(r.y, 0, 500);
    if (w === undefined || h === undefined || x === undefined || y === undefined) continue;
    const fx = num(r.fx, 0, 100);
    const fy = num(r.fy, 0, 100);
    const zoom = num(r.zoom, 1, 4);
    out[k.slice(0, 64)] = {
      x: Math.min(x, COLS - w),
      y,
      w,
      h,
      ...(fx !== undefined ? { fx } : {}),
      ...(fy !== undefined ? { fy } : {}),
      ...(zoom !== undefined ? { zoom } : {}),
    };
  }
  return out;
}

/** Every tile's place: its saved one, or the next free square after the arranged ones. */
export function placeTiles(keys: string[], layout: Record<string, Place>, perRow: number): Place[] {
  const across = [2, 3, 4, 6].includes(perRow) ? perRow : 3;
  const size = COLS / across;
  const bottom = keys.reduce((m, k) => (layout[k] ? Math.max(m, layout[k]!.y + layout[k]!.h) : m), 0);
  let n = 0;
  return keys.map((k) => {
    const saved = layout[k];
    if (saved) return saved;
    const place = { x: (n % across) * size, y: bottom + Math.floor(n / across) * size, w: size, h: size };
    n += 1;
    return place;
  });
}

/** `across` equal squares, in the given order — the Arrange window's reset. */
export function squares(keys: string[], across: number): Record<string, Place> {
  const size = COLS / across;
  return Object.fromEntries(
    keys.map((k, n) => [k, { x: (n % across) * size, y: Math.floor(n / across) * size, w: size, h: size }])
  );
}
