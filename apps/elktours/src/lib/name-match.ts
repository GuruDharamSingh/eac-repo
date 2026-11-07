// CONTRACT: place-name matching helpers (pure; used by scripts/enrich-place-links.mts and scripts/classify-places.mts).

const STOP = new Set(["le", "la", "les", "l", "de", "du", "des", "d", "the", "of", "a", "et", "and", "en", "au", "aux", "no", "n"]);

export function normName(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\bst\b/g, "saint")
    .replace(/\bste\b/g, "sainte")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w && !STOP.has(w))
    .join(" ");
}

function bigrams(s: string): string[] {
  const t = s.replace(/ /g, "");
  const out: string[] = [];
  for (let i = 0; i < t.length - 1; i++) out.push(t.slice(i, i + 2));
  return out;
}

/**
 * Similarity of a place title (a) and a candidate name (b), 0..1. Whole-name containment
 * counts one way only (the candidate's whole name inside the title); a title inside a longer
 * candidate name, an address-style candidate ("67 rue ...") or merely similar spelling stays
 * below the 0.8 confidence line unless the spelling is near-identical (dice >= 0.9).
 */
export function similarity(a: string, b: string): number {
  const x = normName(a);
  const y = normName(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const wx = new Set(x.split(" "));
  const wy = new Set(y.split(" "));
  const inter = [...wx].filter((w) => wy.has(w)).length;
  const labelInTitle = [...wy].every((w) => wx.has(w));
  const titleInLabel = [...wx].every((w) => wy.has(w));
  const contScore = labelInTitle ? (wy.size >= 2 ? 0.9 : 0.85) : titleInLabel ? 0.7 : (inter / Math.min(wx.size, wy.size)) * 0.6;
  const A = bigrams(x);
  const B = bigrams(y);
  const pool = new Map<string, number>();
  for (const g of B) pool.set(g, (pool.get(g) ?? 0) + 1);
  let hit = 0;
  for (const g of A) {
    const n = pool.get(g) ?? 0;
    if (n > 0) {
      hit++;
      pool.set(g, n - 1);
    }
  }
  const dice = A.length + B.length ? (2 * hit) / (A.length + B.length) : 0;
  if (/^\d/.test(y) && !/^\d/.test(x)) return Math.min(Math.max(dice, contScore), 0.6);
  if (labelInTitle) return Math.max(dice, contScore);
  return Math.min(Math.max(dice, contScore), dice >= 0.9 ? 1 : 0.75);
}

export function distM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const x = (lng2 - lng1) * Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180));
  return Math.round(Math.sqrt(x * x + (lat2 - lat1) ** 2) * 111_320);
}
