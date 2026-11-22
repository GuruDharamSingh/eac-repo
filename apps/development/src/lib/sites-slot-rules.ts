// ============================================================================
// Slot rules of APP-LOCAL blocks, kept by hand (review of wave 2, item 1).
//
// What a slot takes (`allow` / `disallow`) is declared on the slot's setting in each block's own file. The shared and
// box blocks are imported by the server, so their rules are read from the declarations (./sites-contracts.ts). Another
// site's blocks are not imported here and the manifest holds slot NAMES only, so their rules are written down below,
// each with the line it was copied from. Every app-local slot in the manifest must have an entry (a rule, or `null`
// for "takes anything"): scripts/check-sites.mts fails when the manifest gains a slot this table does not mention.
// ============================================================================
import type { SlotRules } from "./sites-config";

export interface AppSlotEntry {
  allow?: readonly string[];
  disallow?: readonly string[];
  /** Where the rule was read, as path:line. */
  source: string;
}

/** "<block id>.<slot name>" -> its rule, or null when the slot takes any block (checked at the source line). */
export const APP_SLOT_RULES: Readonly<Record<string, AppSlotEntry | null>> = {
  "ktp-piece-row.pieces": { allow: ["ktp-piece"], source: "apps/katie-the-potter/src/blocks/piece-row.tsx:16" },
  "ktp-quick-landing.feature": { allow: ["ktp-piece"], source: "apps/katie-the-potter/src/blocks/quick-landing.tsx:48" },
  // apps/sunjay/src/blocks/layout-blocks.tsx:23: no allow list, takes any block.
  "pt-band.content": null,
};

/** The table as `stepConfigOf` rules. */
export function appSlotRules(): SlotRules {
  const out: Record<string, Record<string, { allow?: readonly string[]; disallow?: readonly string[] }>> = {};
  for (const [key, e] of Object.entries(APP_SLOT_RULES)) {
    if (!e) continue;
    const cut = key.indexOf(".");
    (out[key.slice(0, cut)] ??= {})[key.slice(cut + 1)] = { ...(e.allow ? { allow: e.allow } : {}), ...(e.disallow ? { disallow: e.disallow } : {}) };
  }
  return out;
}
