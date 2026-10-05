/**
 * The fixed test set: questions whose owner-written answers are the standard a
 * model is scored against, and which are never used for training.
 *
 * Membership is `astro_questions.meta.evalSet = EVAL_SET` (set by
 * scripts/eval-set.ts). A fixed, stratified set replaced the earlier random
 * 10% split so that testing can start after ~150 answers instead of ~1,500
 * (decision, 2026-09-26). The set only grows; a question never leaves it.
 */

export const EVAL_SET = "v1";

/** How many curated questions of each pattern the set takes (150 in all). */
export const EVAL_ALLOCATION: Record<string, number> = {
  realm: 24,
  planet: 8,
  zodiac: 8,
  "aspect-type": 6,
  "sign-cusp": 6,
  "planet-sign": 12,
  "planet-house": 12,
  "planet-sign-house": 12,
  aspect: 14,
  "aspect-one-sign": 10,
  "aspect-two-signs": 12,
  "placed-aspect": 14,
  full: 12,
};
