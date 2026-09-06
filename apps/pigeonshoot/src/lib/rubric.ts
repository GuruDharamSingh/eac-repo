/**
 * The rubric, and what the machine can say about a card.
 *
 * Two rules govern this file:
 *
 *  1. The criteria are DATA. Everything here reads pigeon_criteria; nothing
 *     hardcodes the list. Adding "shot in the rain, 2 points" is a row.
 *
 *  2. The machine proposes, the owner decides. auto_score is a provisional
 *     number computed from things that are actually checkable — how many
 *     angles were supplied, the aspect ratio, the resolution. It bands the
 *     card into a tier so it isn't unlabelled in the gallery, and that is all.
 *     Once the owner sets tier_slug, the card's rating is theirs.
 *
 * `auto_check` on a criterion names an evaluator below. A criterion naming an
 * evaluator that doesn't exist is SKIPPED, not an error — that lets the owner
 * add an aspirational criterion at /manage/rubric before anyone writes the
 * code for it, without breaking submission.
 */

import type { Criterion, Tier } from "@/lib/types";

/** What an auto evaluator gets to look at. */
export interface AutoFacts {
  /** One entry per uploaded photo. */
  images: Array<{
    role: "front" | "side" | "detail" | "context";
    width: number | null;
    height: number | null;
  }>;
}

type Evaluator = (facts: AutoFacts) => boolean;

const AUTO_CHECKS: Record<string, Evaluator> = {
  has_front: (f) => f.images.some((i) => i.role === "front"),
  has_side: (f) => f.images.some((i) => i.role === "side"),

  /**
   * Portrait, roughly card-shaped. 3:4 is 0.75; the tolerance is wide enough
   * to accept a phone's native 3:4 and a lightly cropped 2:3, and to reject
   * anything landscape.
   */
  aspect_3_4: (f) =>
    f.images.some((i) => {
      if (!i.width || !i.height) return false;
      const ratio = i.width / i.height;
      return ratio >= 0.6 && ratio <= 0.85;
    }),

  min_long_edge_1200: (f) =>
    f.images.some((i) => Math.max(i.width ?? 0, i.height ?? 0) >= 1200),
};

export interface AutoResult {
  /** Criterion keys the machine is confident about. */
  passed: string[];
  score: number;
  /** Total points available across ALL criteria — the denominator on the card. */
  max: number;
}

/**
 * Score the auto criteria for a card.
 *
 * `max` deliberately sums every active criterion, not just the automatic ones:
 * the provisional bar should read as "8 of a possible 24", so a card that has
 * only been machine-checked never looks finished.
 */
export function evaluateAuto(criteria: Criterion[], facts: AutoFacts): AutoResult {
  const passed: string[] = [];
  let score = 0;

  for (const c of criteria) {
    if (c.source !== "auto" || !c.autoCheck) continue;
    const check = AUTO_CHECKS[c.autoCheck];
    if (!check) continue; // criterion exists, evaluator doesn't yet — skip quietly
    if (check(facts)) {
      passed.push(c.key);
      score += c.points;
    }
  }

  const max = criteria.reduce((sum, c) => sum + c.points, 0);
  return { passed, score, max };
}

/**
 * Points a submitter's own tick-boxes are worth.
 *
 * These are NOT added to auto_score. They are recorded as claims for the owner
 * to confirm or reject at rating time — anyone can tick "the eye is sharp".
 * Only `submitter` criteria are accepted here; a client trying to tick an
 * `owner` criterion is silently ignored rather than rejected, since it can
 * only be a stale form or someone poking at the API.
 */
export function acceptSubmitterClaims(criteria: Criterion[], claimed: string[]): string[] {
  const allowed = new Set(
    criteria.filter((c) => c.source === "submitter").map((c) => c.key)
  );
  return [...new Set(claimed)].filter((k) => allowed.has(k));
}

/**
 * The provisional band for an unrated card. Highest tier whose min_score the
 * card clears; the lowest tier if it clears nothing.
 */
export function provisionalTier(tiers: Tier[], autoScore: number): Tier | null {
  if (tiers.length === 0) return null;
  const ordered = [...tiers].sort((a, b) => a.minScore - b.minScore);
  let match = ordered[0];
  for (const t of ordered) {
    if (autoScore >= t.minScore) match = t;
  }
  return match;
}

/** Look a tier up by slug, for cards the owner has actually rated. */
export function findTier(tiers: Tier[], slug: string | null): Tier | null {
  if (!slug) return null;
  return tiers.find((t) => t.slug === slug) ?? null;
}

/**
 * What a card's frame should look like right now, and whether that verdict is
 * the owner's or the machine's guess. The `provisional` flag is what the card
 * component uses to render an outline badge instead of a solid one — a
 * machine guess must never be mistakable for a human judgement.
 */
export function displayTier(
  tiers: Tier[],
  card: { tierSlug: string | null; autoScore: number }
): { tier: Tier | null; provisional: boolean } {
  const rated = findTier(tiers, card.tierSlug);
  if (rated) return { tier: rated, provisional: false };
  return { tier: provisionalTier(tiers, card.autoScore), provisional: true };
}
