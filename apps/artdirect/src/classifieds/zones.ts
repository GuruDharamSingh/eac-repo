/**
 * Zones: the unit of generation and rendering. The plane is cut into rows
 * of varying height, and each row into zones of varying width, offset from
 * the rows above and below like brickwork. A zone keeps one column grid for
 * its whole extent, so column rules run for pages and the seams between
 * grids are staggered and infrequent rather than a lattice of tiles.
 *
 * Everything is hashed from the row and zone index, so a lookup by world
 * coordinate is a short walk from the origin and the same for everyone.
 */
import { unit } from "./rng";

export interface Zone {
  /** Row and index within the row. */
  r: number;
  k: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

const H_MIN = 1100, H_MAX = 2600;
const W_MIN = 1000, W_MAX = 3200;

function rowHeight(r: number): number {
  return Math.round(H_MIN + unit(r, 7001) * (H_MAX - H_MIN));
}
/** Top y of row r (row 0 starts at 0). */
export function rowTop(r: number): number {
  let y = 0;
  if (r >= 0) for (let q = 0; q < r; q++) y += rowHeight(q);
  else for (let q = -1; q >= r; q--) y -= rowHeight(q);
  return y;
}
export function rowAt(y: number): number {
  let r = 0;
  if (y >= 0) {
    let top = 0;
    while (top + rowHeight(r) <= y) { top += rowHeight(r); r++; }
  } else {
    let top = 0;
    while (top > y) { r--; top -= rowHeight(r); }
  }
  return r;
}

function zoneWidth(r: number, k: number): number {
  return Math.round(W_MIN + unit(r, k, 7003) * (W_MAX - W_MIN));
}
/** Left x of zone k in row r; zone 0 starts at a row-specific offset so seams stagger. */
export function zoneLeft(r: number, k: number): number {
  let x = -Math.round(unit(r, 7005) * 2500);
  if (k >= 0) for (let q = 0; q < k; q++) x += zoneWidth(r, q);
  else for (let q = -1; q >= k; q--) x -= zoneWidth(r, q);
  return x;
}
export function zoneIndexAt(r: number, x: number): number {
  let k = 0;
  let left = zoneLeft(r, 0);
  if (x >= left) {
    while (left + zoneWidth(r, k) <= x) { left += zoneWidth(r, k); k++; }
  } else {
    while (left > x) { k--; left -= zoneWidth(r, k); }
  }
  return k;
}

export function zone(r: number, k: number): Zone {
  return { r, k, x: zoneLeft(r, k), y: rowTop(r), w: zoneWidth(r, k), h: rowHeight(r) };
}

export function zoneAt(x: number, y: number): Zone {
  const r = rowAt(y);
  return zone(r, zoneIndexAt(r, x));
}

/** Every zone that touches the world rectangle. */
export function zonesIn(x0: number, y0: number, x1: number, y1: number, cap = 60): Zone[] {
  const out: Zone[] = [];
  const r0 = rowAt(y0), r1 = rowAt(y1);
  for (let r = r0; r <= r1; r++) {
    const k0 = zoneIndexAt(r, x0), k1 = zoneIndexAt(r, x1);
    for (let k = k0; k <= k1; k++) {
      out.push(zone(r, k));
      if (out.length >= cap) return out;
    }
  }
  return out;
}
