// Which block types the Sites door can CHECK a change against: every block in the manifest (the shared blocks,
// the editing boxes and each site's own blocks), 184 of them. Their contracts are built from the manifest
// (./sites-manifest.ts), so no block's file has to be importable here. A page may still hold a block type that is
// in no manifest: it is kept untouched, steps aimed at it are refused, and a page that holds one cannot be
// published from here (the door could not say what a change did to it). The same goes for a page that still uses
// Puck's old zone map.
//
// `blocks` are the shared and box blocks this server CAN import: their real declarations give the allow lists of
// slots (the manifest does not carry them) and a check that the manifest and the declarations agree.
import * as shared from "@elkdonis/blocks";
import type { Block } from "@elkdonis/blocks";
import { contractOf } from "@elkdonis/blocks/contract";
import { BOX_BLOCKS } from "@elkdonis/direct-edit/puck/blocks";
import { stepConfigOf, type SlotRules, type StepConfig } from "./sites-config";
import { appSlotRules } from "./sites-slot-rules";
import { contractFromDeclaration, manifestBlocks, manifestContracts, type DeclaredLike, type SiteContract } from "./sites-manifest";

let cached: { blocks: Block<never>[]; contracts: Record<string, SiteContract>; config: StepConfig } | null = null;

export function checkable(): { blocks: Block<never>[]; contracts: Record<string, SiteContract>; config: StepConfig } {
  if (!cached) {
    const all = [
      ...shared.SHARED_BLOCKS,
      ...shared.PROFILE_PAGE_BLOCKS,
      ...shared.FEATURED_PAGE_BLOCKS,
      ...shared.STORE_PANEL_BLOCKS,
      shared.featuredPerson,
      shared.recordHeader,
      shared.recordBody,
      shared.recordFacts,
      ...(BOX_BLOCKS as unknown as Block<never>[]),
    ] as unknown as Block<never>[];
    const seen = new Set<string>();
    const blocks = all.filter((b) => b && !seen.has(b.def.id) && (seen.add(b.def.id), true));

    // A slot's allow list is declared on its setting (`PropDef.allow`).
    const rules: Record<string, Record<string, { allow?: readonly string[] }>> = {};
    for (const b of blocks) {
      for (const p of b.def.props) {
        const allow = (p as { allow?: readonly string[] }).allow;
        if (p.kind === "slot" && allow?.length) (rules[b.def.id] ??= {})[p.name] = { allow };
      }
    }
    // The manifest covers every block; where this server can import the block, its own declaration wins (it knows a
    // select's options and a token's real type, which the manifest's static scan of other sites' blocks cannot).
    const contracts: Record<string, SiteContract> = { ...manifestContracts() };
    const declared = contractOf(blocks) as unknown as Record<string, DeclaredLike>;
    for (const [id, c] of Object.entries(declared)) contracts[id] = contractFromDeclaration(c);
    cached = { blocks, contracts, config: stepConfigOf(manifestBlocks(), { ...(appSlotRules() as object), ...(rules as object) } as SlotRules) };
  }
  return cached;
}

/** The block types on a page (nested ones included), in first-seen order. */
export function typesOnPage(doc: unknown): string[] {
  const out = new Set<string>();
  const walk = (list: unknown) => {
    if (!Array.isArray(list)) return;
    for (const n of list) {
      if (!n || typeof n !== "object" || typeof (n as { type?: unknown }).type !== "string") continue;
      out.add((n as { type: string }).type);
      const props = (n as { props?: Record<string, unknown> }).props ?? {};
      for (const v of Object.values(props)) if (Array.isArray(v)) walk(v);
    }
  };
  walk((doc as { content?: unknown } | null)?.content);
  return [...out];
}

/** Types on this page that are in no manifest. Empty means the page can be edited and published from here. */
export function unknownTypesOn(doc: unknown): string[] {
  const { contracts } = checkable();
  return typesOnPage(doc).filter((t) => !Object.prototype.hasOwnProperty.call(contracts, t));
}

/** True when the page still uses Puck's old zone map: its blocks there are not walked, so the door cannot vouch for it. */
export function hasLegacyZones(doc: unknown): boolean {
  const z = (doc as { zones?: unknown } | null)?.zones;
  return !!z && typeof z === "object" && Object.keys(z as object).length > 0;
}
