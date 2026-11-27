/**
 * Pure overlap helpers, safe in the browser (no database). See lib/slot-overlaps.ts for the notices built on them.
 */

/** The pair of slot ids in storage order (smaller first), as booking_clash_dismissals keeps it. */
export function pairOf(x: string, y: string): [string, string] {
  return x < y ? [x, y] : [y, x];
}

/** Pairs of overlapping slots of one guide, from slots already listed. Touching ends do not overlap. */
export function overlappingPairs<T extends { id?: string; guideUserId: string | null; startsAt: string | Date; endsAt: string | Date }>(slots: readonly T[]): Array<[T, T]> {
  const byGuide = new Map<string, T[]>();
  for (const s of slots) {
    if (!s.id || !s.guideUserId) continue;
    byGuide.set(s.guideUserId, [...(byGuide.get(s.guideUserId) ?? []), s]);
  }
  const out: Array<[T, T]> = [];
  for (const list of byGuide.values()) {
    const sorted = [...list].sort((p, q) => new Date(p.startsAt).getTime() - new Date(q.startsAt).getTime());
    for (let i = 0; i < sorted.length; i++) {
      const end = new Date(sorted[i]!.endsAt).getTime();
      for (let j = i + 1; j < sorted.length && new Date(sorted[j]!.startsAt).getTime() < end; j++) out.push([sorted[i]!, sorted[j]!]);
    }
  }
  return out;
}
