// ============================================================================
// The small Puck config the structure steps need (lane DEV, wave 2). THE ONE MODULE THAT BUILDS IT.
//
// The door's insert, move, copy and remove run on Puck's own reducer, which wants a config: for each block
// its slots (as slot fields, with the allow and disallow lists that say what a place takes) and its default
// settings. Nothing else of Puck's config matters to a structure step (the door puts every block that was
// already on the page back as the original, byte for byte), so this builds only that, from the manifest.
//
// Pure data, no React, no Puck import, no database. `rules` carries allow and disallow lists the manifest
// does not hold (the shared blocks declare `allow` on a slot's setting; the app reads those from the real
// declarations and hands them in).
// ============================================================================

export interface StepConfigBlock {
  id: string;
  /** Names of the block's slots. */
  slots: readonly string[];
  settings: ReadonlyArray<{ name: string; kind: string; default?: unknown }>;
}

export type SlotRules = Readonly<Record<string, Readonly<Record<string, { allow?: readonly string[]; disallow?: readonly string[] }>>>>;

export interface StepConfig {
  components: Record<string, { fields: Record<string, { type: "slot"; allow?: string[]; disallow?: string[] }>; defaultProps: Record<string, unknown> }>;
}

const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

export function stepConfigOf(blocks: readonly StepConfigBlock[], rules: SlotRules = {}): StepConfig {
  const components: StepConfig["components"] = {};
  for (const b of blocks) {
    const fields: StepConfig["components"][string]["fields"] = {};
    const slots = new Set<string>(b.slots);
    for (const s of b.settings) if (s.kind === "slot") slots.add(s.name);
    for (const slot of slots) {
      const rule = own(rules, b.id) && own(rules[b.id]!, slot) ? rules[b.id]![slot]! : undefined;
      fields[slot] = { type: "slot", ...(rule?.allow?.length ? { allow: [...rule.allow] } : {}), ...(rule?.disallow?.length ? { disallow: [...rule.disallow] } : {}) };
    }
    const defaultProps: Record<string, unknown> = {};
    for (const s of b.settings) if (s.kind !== "slot" && s.default !== undefined) defaultProps[s.name] = structuredClone(s.default);
    components[b.id] = { fields, defaultProps };
  }
  return { components };
}
