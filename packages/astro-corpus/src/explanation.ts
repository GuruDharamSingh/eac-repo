/**
 * The optional explanation a reviewer attaches to a pick, rate or fix: why,
 * in their own words. Pure (no database) so the smoke test covers it; the
 * review path (studio.ts) and the export (export.ts) both use it.
 *
 *   text        1–2000 characters
 *   about       pick: winner | loser | both; rate and fix: answer
 *   quote       optional phrase copied from a shown answer; dropped when it
 *               is not found in one of them
 *   severity    optional: minor | major
 *   principles  rate and fix only: the pick reason chips. A pick keeps its
 *               chips in payload.reasons, so they are not repeated here.
 */

export const PICK_REASONS = ["more specific", "truer to the tradition", "better written", "less fatalistic", "more accurate"] as const;
export const EXPLAINED_ACTIONS = ["pick", "rate", "fix"] as const;
export const EXPLANATION_ABOUT = ["winner", "loser", "both", "answer"] as const;
export const EXPLANATION_SEVERITY = ["minor", "major"] as const;
export const EXPLANATION_MAX = 2000;
export const QUOTE_MAX = 300;

export interface Explanation {
  text: string;
  about: (typeof EXPLANATION_ABOUT)[number];
  quote?: string;
  severity?: (typeof EXPLANATION_SEVERITY)[number];
  principles?: string[];
}

export class ExplanationError extends Error {}

const ABOUT_FOR: Record<string, readonly string[]> = { pick: ["winner", "loser", "both"], rate: ["answer"], fix: ["answer"] };
const squash = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

/**
 * Validate and tidy an explanation. Returns undefined when there is none and
 * throws ExplanationError on anything malformed. `shownBodies` are the texts
 * the reviewer saw.
 */
export function cleanExplanation(raw: unknown, action: string, shownBodies: string[]): Explanation | undefined {
  if (raw === undefined || raw === null) return undefined;
  const about = ABOUT_FOR[action];
  if (!about) throw new ExplanationError(`An explanation can only go with ${EXPLAINED_ACTIONS.join(", ")}`);
  if (typeof raw !== "object" || Array.isArray(raw)) throw new ExplanationError("The explanation is not in the expected shape");
  const e = raw as Record<string, unknown>;

  const text = typeof e.text === "string" ? e.text.trim() : "";
  if (text.length < 1 || text.length > EXPLANATION_MAX) throw new ExplanationError(`The explanation must be 1–${EXPLANATION_MAX} characters`);
  if (typeof e.about !== "string" || !about.includes(e.about)) {
    throw new ExplanationError(`For a ${action}, the explanation is about: ${about.join(", ")}`);
  }
  const out: Explanation = { text, about: e.about as Explanation["about"] };

  if (e.severity !== undefined && e.severity !== null) {
    if (typeof e.severity !== "string" || !(EXPLANATION_SEVERITY as readonly string[]).includes(e.severity)) {
      throw new ExplanationError("Severity is minor or major");
    }
    out.severity = e.severity as Explanation["severity"];
  }

  if (e.quote !== undefined && e.quote !== null) {
    if (typeof e.quote !== "string") throw new ExplanationError("The quote must be text");
    const quote = e.quote.trim();
    if (quote.length > QUOTE_MAX) throw new ExplanationError(`The quote must be at most ${QUOTE_MAX} characters`);
    const needle = squash(quote);
    if (needle && shownBodies.some((b) => squash(b).includes(needle))) out.quote = quote;
  }

  if (e.principles !== undefined && e.principles !== null) {
    if (!Array.isArray(e.principles)) throw new ExplanationError("Principles must be a list");
    if (action !== "pick") {
      const known = PICK_REASONS as readonly string[];
      const principles = [...new Set(e.principles.filter((p): p is string => typeof p === "string" && known.includes(p)))];
      if (principles.length) out.principles = principles;
    }
  }
  return out;
}

/** The explanation stored on a review payload, if any (already cleaned when it was saved). */
export function explanationOf(payload: Record<string, unknown>): Explanation | undefined {
  const e = payload.explanation;
  return e && typeof e === "object" && typeof (e as { text?: unknown }).text === "string" ? (e as Explanation) : undefined;
}
