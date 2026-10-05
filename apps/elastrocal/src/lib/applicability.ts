/**
 * Does a corpus statement apply to a chart?
 *
 * A statement's PLACEMENT keys (sign:, house:, aspect:, compat:, transit*:,
 * from its factor tags and its condition_keys) assert specific chart
 * configurations; general keys (planet:, zodiac:, realm:, aspect-type:) do
 * not and are never requirements.
 *
 * Placement keys are grouped by what they place:
 *   sign:<p>:… and house:<p>:…        → the point p      ("Pluto in the 8th or Scorpio")
 *   aspect:<a>:<b>:…                 → the pair a–b     ("Mars square or opposite Saturn")
 *   compat:<x>:<y>                   → the sign pair
 *   transit:<m>:<n>:…                → transiting m to natal n
 *   transit-sign:<m>:…, transit-house:<m>:… → the transiting point m
 * Within a group the keys are ALTERNATIVES (any one present satisfies it);
 * across groups they are REQUIREMENTS ("With Sun in Aquarius, Venus in
 * Aries…" needs both the Sun group and the Venus group). The group of the key
 * being looked at is satisfied by definition.
 *
 *   more     every group satisfied, and at least one OTHER group is (it names
 *            more of this chart: "also Sun in Taurus")
 *   applies  every group satisfied, nothing beyond the selected key's group
 *   other    some group is not satisfied: a combination this chart lacks
 */

import { FACTOR_BY_KEY } from "@elkdonis/astro-corpus";

export const PLACEMENT_KINDS = ["sign", "house", "aspect", "compat", "transit", "transit-sign", "transit-house"] as const;
const PLACEMENT = new Set<string>(PLACEMENT_KINDS);

export type Fit = "more" | "applies" | "other";
export const FIT_RANK: Record<Fit, number> = { more: 0, applies: 1, other: 2 };

export interface Applicability {
  fit: Fit;
  /** Other groups this chart satisfies: "Sun in Taurus", or "Sun square Mars (of: Sun square Mars / Sun opposite Mars)". */
  matched: string[];
  /** Unsatisfied groups: "Sun in Aquarius", "Mars in Leo or Sagittarius". */
  missing: string[];
  /** The selected key's own group lists alternatives: "Venus in Aries, Leo or Sagittarius". */
  alternatives: string | null;
}

export const isPlacementKey = (k: string) => PLACEMENT.has(k.slice(0, k.indexOf(":")));

/** The group a placement key belongs to (see above). */
export function placementGroup(k: string): string {
  const p = k.split(":");
  switch (p[0]) {
    case "sign":
    case "house":
      return `point:${p[1]}`;
    case "aspect":
      return `pair:${[p[1], p[2]].sort().join("|")}`;
    case "compat":
      return `compat:${[p[1], p[2]].sort().join("|")}`;
    case "transit":
      return `transit:${p[1]}|${p[2]}`;
    case "transit-sign":
    case "transit-house":
      return `moving:${p[1]}`;
    default:
      return k;
  }
}

const labelOf = (k: string) => FACTOR_BY_KEY.get(k)?.label ?? k;

/** "Mars in Aries", "Mars in Leo" → "Mars in Aries or Leo"; three or more → "Mars in Aries, Leo or Sagittarius". */
export function orLabel(keys: string[]): string {
  const labels = [...new Set(keys.map(labelOf))];
  if (labels.length === 1) return labels[0];
  // Longest common prefix on a word boundary.
  const words = labels.map((l) => l.split(" "));
  let n = 0;
  while (words.every((w) => w.length > n + 1 && w[n] === words[0][n])) n++;
  const prefix = words[0].slice(0, n).join(" ");
  const rest = words.map((w) => w.slice(n).join(" "));
  const list = rest.length === 2 ? `${rest[0]} or ${rest[1]}` : `${rest.slice(0, -1).join(", ")} or ${rest[rest.length - 1]}`;
  return prefix ? `${prefix} ${list}` : list;
}

/**
 * Applicability of one statement's placement keys, relative to the selected
 * key and the chart's key set. Without a chart, everything applies.
 */
export function applicability(placements: readonly string[], selectedKey: string | null, chart: ReadonlySet<string> | null): Applicability {
  const groups = new Map<string, string[]>();
  for (const k of new Set(placements)) {
    if (!isPlacementKey(k)) continue;
    const g = placementGroup(k);
    groups.set(g, [...(groups.get(g) ?? []), k]);
  }
  const selectedGroup = selectedKey && isPlacementKey(selectedKey) ? placementGroup(selectedKey) : null;
  const own = selectedGroup ? groups.get(selectedGroup) : undefined;
  const alternatives = own && own.length > 1 ? orLabel(own) : null;
  if (!chart) return { fit: "applies", matched: [], missing: [], alternatives };

  const matched: string[] = [];
  const missing: string[] = [];
  for (const [g, keys] of groups) {
    if (g === selectedGroup) continue;
    const present = keys.filter((k) => chart.has(k));
    if (present.length === 0) missing.push(orLabel(keys));
    else matched.push(keys.length > 1 ? `${labelOf(present[0])} (one of: ${orLabel(keys)})` : labelOf(present[0]));
  }
  return { fit: missing.length ? "other" : matched.length ? "more" : "applies", matched, missing, alternatives };
}
