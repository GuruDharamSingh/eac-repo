/** The factor registry and its vocabulary as plain JSON, for pipelines outside this package. */

import { ASPECTS, BODIES, SIGNS } from "@elkdonis/astro";
import { FACTORS, HOUSE_REALMS, POINT_ORDER, registryCounts } from "./factors";

export function registryJson() {
  return {
    generated: new Date().toISOString(),
    keyGrammar: {
      sign: "sign:<point>:<sign>",
      house: "house:<body>:<1-12>",
      aspect: "aspect:<a>:<b>:<aspect>  (a before b in pointOrder)",
      transit: "transit:<transiting body>:<natal point>:<aspect>  (majors only)",
      "transit-sign": "transit-sign:<body>:<sign>",
      "transit-house": "transit-house:<body>:<1-12>",
      compat: "compat:<sign>:<sign>  (unordered, zodiac order)",
      planet: "planet:<point>",
      zodiac: "zodiac:<sign>",
      realm: "realm:<1-12>",
      "aspect-type": "aspect-type:<aspect>",
      element: "element:<fire|earth|air|water>",
      modality: "modality:<cardinal|fixed|mutable>",
      polarity: "polarity:<masculine|feminine>",
      "sign-house": "sign-house:<sign>:<1-12>  (a sign on a house)",
      placement: "placement:<body>:<sign>:<1-12>  (a body in a sign in a house)",
    },
    counts: registryCounts(),
    pointOrder: POINT_ORDER,
    points: [
      ...BODIES.map((b) => ({ key: b.key, name: b.name, glyph: b.glyph, group: b.group })),
      { key: "ascendant", name: "Ascendant", glyph: "AC", group: "angle" },
      { key: "midheaven", name: "Midheaven", glyph: "MC", group: "angle" },
    ],
    signs: SIGNS.map((s) => ({ key: s.key, name: s.name, glyph: s.glyph, element: s.element, modality: s.modality, rulers: s.rulers })),
    aspects: ASPECTS.map((a) => ({ key: a.key, name: a.name, glyph: a.glyph, angle: a.angle, orb: a.orb, major: a.major, nature: a.nature })),
    houses: HOUSE_REALMS,
    factors: FACTORS,
  };
}
