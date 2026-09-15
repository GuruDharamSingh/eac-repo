/**
 * Step 1: is the aspect harmonious or inharmonious?
 *
 * The book settles the sextile, trine (harmonious), square and opposition
 * (inharmonious) outright, and says the conjunction "is the same as the
 * trine or the square depending on whether the conjunction is harmonious or
 * inharmonious", referring to Heindel's Simplified Scientific Astrology
 * pp. 98–99 for which is which. Heindel's rule of thumb there is by the
 * planets: Sun, Venus and Jupiter are benefic in conjunction; Saturn, Mars,
 * Uranus and Neptune adverse; Moon and Mercury take the nature of their
 * companion. Pluto was not in Heindel's table — its keywords in the 1998
 * edition are overwhelmingly forceful, so it is treated as a malefic here.
 *
 * A benefic conjunct a malefic is "mixed": the book's binary has no place
 * for it, so the reading uses the inharmonious verb family (a Saturn
 * conjunction does obstruct) but lets the benefic keep its positive
 * keywords — the planet that softens the contact is described as softening
 * it. `PAIR_OVERRIDES` records the few mixed pairs Heindel reads outright.
 *
 * Minor aspects (semi-square, sesquisquare: inharmonious; quincunx,
 * semi-sextile: no keyword verbs in the book) get a nature so a reading
 * can be attempted, but the reading marks them as outside the book's system.
 */

import type { AspectKey } from "../types";
import type { PlanetKey } from "./lexicon";

export type Nature = "harmonious" | "inharmonious";

export interface AspectNature {
  nature: Nature;
  /** True when a benefic meets a malefic in conjunction: inharmonious verbs, but the benefic keeps its positive words. */
  mixed: boolean;
  /** The planet that keeps its positive set in a mixed conjunction. */
  softenedBy?: PlanetKey;
  /** The book's own statement of what the nature means for the person. */
  meaning: string;
  /** The opposition's affinity note, when it applies. */
  note?: string;
  /** False for the minor aspects the book does not cover. */
  inSystem: boolean;
}

const BENEFIC: PlanetKey[] = ["sun", "venus", "jupiter"];
const MALEFIC: PlanetKey[] = ["mars", "saturn", "uranus", "neptune", "pluto"];

/** Heindel's readings of specific conjunctions that the benefic/malefic rule alone would call mixed. */
const PAIR_OVERRIDES: Array<[PlanetKey, PlanetKey, Nature]> = [
  ["jupiter", "saturn", "harmonious"], // "steadying" — Saturn's caution and Jupiter's expansion balance
  ["jupiter", "mars", "harmonious"], // enthusiasm and enterprise, well-directed energy
  ["jupiter", "uranus", "harmonious"], // originality with breadth
  ["sun", "uranus", "harmonious"], // independence and originality (Heindel reads it as strengthening)
  ["sun", "saturn", "inharmonious"], // outright adverse in Heindel
  ["venus", "saturn", "inharmonious"],
  ["venus", "mars", "inharmonious"], // passion without restraint
  ["venus", "neptune", "harmonious"], // musical, artistic — Heindel is warm to it
  ["sun", "neptune", "inharmonious"],
  ["sun", "mars", "inharmonious"], // energy, but rash — adverse on balance
];

export const HARMONIOUS_MEANING = "good judgment is used in all matters ruled by this aspect";
export const INHARMONIOUS_MEANING = "the person goes to extremes in the activities indicated by this aspect";

export function aspectNature(type: AspectKey, a: PlanetKey, b: PlanetKey): AspectNature {
  switch (type) {
    case "sextile":
    case "trine":
      return { nature: "harmonious", mixed: false, meaning: HARMONIOUS_MEANING, inSystem: true };
    case "square":
      return { nature: "inharmonious", mixed: false, meaning: INHARMONIOUS_MEANING, inSystem: true };
    case "opposition":
      return {
        nature: "inharmonious",
        mixed: false,
        meaning: INHARMONIOUS_MEANING,
        note:
          "The opposition brings into play two directly opposite signs, the two poles of one department of nature; " +
          "their affinity makes it less inharmonious than a square, and in advanced egos it may become an aspect of great power.",
        inSystem: true,
      };
    case "conjunction":
      return conjunctionNature(a, b);
    case "semisquare":
    case "sesquisquare":
      return { nature: "inharmonious", mixed: false, meaning: INHARMONIOUS_MEANING, inSystem: false };
    default:
      // quincunx, semisextile: no verbs in the book; read gently as a weak harmonious contact.
      return { nature: "harmonious", mixed: false, meaning: HARMONIOUS_MEANING, inSystem: false };
  }
}

function conjunctionNature(a: PlanetKey, b: PlanetKey): AspectNature {
  const override = PAIR_OVERRIDES.find(([x, y]) => (x === a && y === b) || (x === b && y === a));
  const base = { mixed: false, inSystem: true };
  if (override) {
    const nature = override[2];
    return { ...base, nature, meaning: nature === "harmonious" ? HARMONIOUS_MEANING : INHARMONIOUS_MEANING };
  }
  const aB = BENEFIC.includes(a);
  const bB = BENEFIC.includes(b);
  const aM = MALEFIC.includes(a);
  const bM = MALEFIC.includes(b);
  if (aM || bM) {
    if (aB || bB) {
      return {
        nature: "inharmonious",
        mixed: true,
        softenedBy: aB ? a : b,
        meaning: `${INHARMONIOUS_MEANING}, though the benefic planet in the conjunction tempers it`,
        inSystem: true,
      };
    }
    return { ...base, nature: "inharmonious", meaning: INHARMONIOUS_MEANING };
  }
  // benefics and neutrals only
  return { ...base, nature: "harmonious", meaning: HARMONIOUS_MEANING };
}

/**
 * Keywords of the aspects. The book: harmonious aspects take "verbs which
 * express reinforcement, assistance, ease and cooperation"; the square
 * "obstruction, inharmony, strife, struggle or detraction". Its worked
 * example also uses "bring", "gain", "enhance", "help" for the sextile.
 * Each verb has a third-person form and a gerund for the frames that need one.
 */
export interface AspectVerb {
  base: string;
  third: string;
  gerund: string;
}

const v = (base: string, third: string, gerund: string): AspectVerb => ({ base, third, gerund });

export const ASPECT_VERBS: Record<Nature, AspectVerb[]> = {
  harmonious: [
    v("reinforce", "reinforces", "reinforcing"),
    v("assist", "assists", "assisting"),
    v("enhance", "enhances", "enhancing"),
    v("help", "helps", "helping"),
    v("bring", "brings", "bringing"),
    v("ease", "eases", "easing"),
    v("cooperate with", "cooperates with", "cooperating with"),
    v("gain", "gains", "gaining"),
  ],
  inharmonious: [
    v("obstruct", "obstructs", "obstructing"),
    v("detract from", "detracts from", "detracting from"),
    v("disturb", "disturbs", "disturbing"),
    v("strive against", "strives against", "striving against"),
    v("hinder", "hinders", "hindering"),
    v("bring strife into", "brings strife into", "bringing strife into"),
    v("struggle with", "struggles with", "struggling with"),
    v("unsettle", "unsettles", "unsettling"),
  ],
};
