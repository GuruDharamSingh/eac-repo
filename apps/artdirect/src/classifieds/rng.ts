/**
 * Deterministic randomness for the classifieds plane. Everything on the plane
 * is derived from integer coordinates and a seed, so a spot looks the same on
 * every visit and a URL hash can point at it.
 */

/**
 * The world seed. Every hash folds it in, so a different seed is a different
 * plane with the same rules (a "seed world"). Set once by the viewer before
 * any tile is generated; the default is world 0.
 */
let WORLD = 0;
export function setWorldSeed(seed: number): void {
  WORLD = seed | 0;
}
export function worldSeed(): number {
  return WORLD;
}

/** 32-bit integer hash of up to four integers (xxhash-style mixing). */
export function hash(a: number, b = 0, c = 0, d = 0): number {
  let h = ((a | 0) + Math.imul(WORLD, 0x27d4eb2f)) * 0x9e3779b1;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul((h + (b | 0)) ^ ((h + (b | 0)) >>> 13), 0xc2b2ae35);
  h = Math.imul((h + (c | 0)) ^ ((h + (c | 0)) >>> 16), 0x27d4eb2f);
  h = Math.imul((h + (d | 0)) ^ ((h + (d | 0)) >>> 15), 0x165667b1);
  return (h ^ (h >>> 13)) >>> 0;
}

/** hash → [0, 1). */
export function unit(a: number, b = 0, c = 0, d = 0): number {
  return hash(a, b, c, d) / 4294967296;
}

/** A small seeded PRNG (mulberry32) for composing one sheet. */
export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0;
  }
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }
  pick<T>(list: readonly T[]): T {
    return list[Math.floor(this.next() * list.length)];
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  /** Pick by weight: `[[item, weight], ...]`. */
  weighted<T>(entries: ReadonlyArray<readonly [T, number]>): T {
    let total = 0;
    for (const [, w] of entries) total += w;
    let r = this.next() * total;
    for (const [item, w] of entries) {
      r -= w;
      if (r <= 0) return item;
    }
    return entries[entries.length - 1][0];
  }
  shuffle<T>(list: readonly T[]): T[] {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * 2-D value noise in [0, 1): bilinear blend of hashed lattice values. `scale`
 * is the lattice spacing in cells; `salt` separates independent fields.
 */
export function noise(x: number, y: number, scale: number, salt: number): number {
  const fx = x / scale;
  const fy = y / scale;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = smooth(fx - x0);
  const ty = smooth(fy - y0);
  const v00 = unit(x0, y0, salt);
  const v10 = unit(x0 + 1, y0, salt);
  const v01 = unit(x0, y0 + 1, salt);
  const v11 = unit(x0 + 1, y0 + 1, salt);
  const a = v00 + (v10 - v00) * tx;
  const b = v01 + (v11 - v01) * tx;
  return a + (b - a) * ty;
}
