/**
 * The Rosicrucian keyword engine as a candidate generator.
 *
 * For a planet in a sign it gives the character keywords; for a planet in a
 * house, the circumstance keywords (readPlacement, steps 4 and 7 of the
 * book's method). Aspects are not read here: the book's aspect reading
 * depends on both planets' signs and houses, which a bare aspect factor does
 * not have.
 */

import { isPlanet, readPlacement } from "@elkdonis/astro/keywords";
import { FACTOR_BY_KEY } from "./factors";

export const ENGINE_SOURCE_SLUG = "engine:rosicrucian-keywords";
export const ENGINE_TRADITION = "rosicrucian";

export function engineText(factorKey: string): string | null {
  const f = FACTOR_BY_KEY.get(factorKey);
  if (!f) return null;
  const planet = f.parts.point;
  if (!planet || !isPlanet(planet)) return null;

  if (f.kind === "sign" && f.parts.sign) {
    const r = readPlacement({ planet, sign: f.parts.sign, house: 1 });
    const text = r.character.map((u) => u.plain).join(" ").trim();
    return text || null;
  }
  if (f.kind === "house" && f.parts.house) {
    // The house reading does not depend on the sign; any sign will do.
    const r = readPlacement({ planet, sign: "aries", house: f.parts.house });
    const text = r.circumstances.map((u) => u.plain).join(" ").trim();
    return text || null;
  }
  return null;
}
