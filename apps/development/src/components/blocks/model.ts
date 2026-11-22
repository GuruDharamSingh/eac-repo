import { slotNames, toDefaultProps, type Block } from "@elkdonis/blocks";
import type { CatalogEntry } from "@/lib/types";
import { SOURCES } from "@/registry/sources";
import { mockFor, type MockEntry } from "@/registry/mocks";
import { LOCAL_APPS } from "@/registry/local";

/** What one tile is. */
export interface Item {
  entry: CatalogEntry;
  /** Present when this app can import and draw the block. */
  block?: Block<never>;
  /** Why it is not drawn: app-only (not importable) or a load error. */
  why?: string;
  /** An app-local block drawn as a mock (sample data, not the live block). */
  mock?: MockEntry;
}

const SHARED_ALIASES = /(^|[^a-z])(shared|blocks|direct-edit|box)([^a-z]|$)/i;

/** Joins the catalogue (blocks.json) to the blocks loaded from the registry, by id. */
export function buildItems(catalog: CatalogEntry[], loaded: Map<string, { block: Block<never>; app: string }>, sourceErrors: Record<string, string>): Item[] {
  const items: Item[] = [];
  const used = new Set<string>();
  for (const entry of catalog) {
    const hit = loaded.get(entry.id);
    const sharedLike = SHARED_ALIASES.test(entry.app) || (entry.pkg ?? "").startsWith("@elkdonis/") || (entry.source ?? "").startsWith("packages/");
    // Real app-local blocks (registry/local) are loaded by relative import, so they are live although importable is "app-only".
    const localHit = !!hit && LOCAL_APPS.has(hit.app) && entry.app === hit.app;
    if (hit && ((entry.importable !== "app-only" && sharedLike) || localHit)) {
      used.add(entry.id);
      items.push({ entry: { ...entry, app: hit.app }, block: hit.block });
    } else {
      const err = sourceErrors[entry.app];
      const inPackage = (entry.source ?? "").startsWith("packages/");
      items.push({
        entry,
        mock: mockFor(entry.app, entry.id),
        why: err ?? entry.blocker ?? (inPackage ? "A package block that its package does not export from its index yet, so the registry cannot load it. Export it (and give it a sample()) to draw it here." : "App-local block: it imports from its own app (aliases, server code, CSS) and cannot be imported from here."),
      });
    }
  }
  // Loaded blocks the catalogue did not list still get a tile (derived from their own declaration).
  for (const [id, { block, app }] of loaded) {
    if (used.has(id)) continue;
    const def = block.def;
    items.push({
      entry: {
        key: `${app}:${id}`,
        id,
        label: def.label,
        app,
        category: def.category,
        description: def.description,
        dataDriven: def.dataDriven,
        interactive: def.interactive,
        propCount: def.props.length,
        parts: def.parts ? Object.keys(def.parts) : [],
        pkg: SOURCES.find((s) => s.app === app)?.pkg,
      },
      block,
    });
  }
  // The catalogue can list one block twice (re-exported, or declared in two files): one tile each key.
  const seen = new Set<string>();
  return items.filter((i) => (seen.has(i.entry.key) ? false : (seen.add(i.entry.key), true)));
}

/** The props a tile draws: declared defaults, the block's own sample rows, empty slots, then edits. */
export function nodeProps(block: Block<never>, edits?: Record<string, unknown>): Record<string, unknown> {
  const def = block.def;
  let sample: Record<string, unknown> = {};
  if (block.sample) {
    try {
      const s = (block.sample as () => unknown)();
      if (s && typeof s === "object") sample = s as Record<string, unknown>;
    } catch {
      sample = {};
    }
  }
  const slots: Record<string, unknown> = {};
  for (const name of slotNames(def)) slots[name] = [];
  return { ...toDefaultProps(def), ...sample, ...slots, ...(edits ?? {}) };
}

export function tileData(block: Block<never>, edits?: Record<string, unknown>) {
  return {
    root: { props: {} },
    content: [{ type: block.def.id, props: { ...nodeProps(block, edits), id: `dev-${block.def.id}` } }],
  };
}

/** Left-to-right order of columns: shared first, then the box blocks, then apps alphabetically. */
export function appRank(app: string): number {
  if (app === "shared") return 0;
  if (app === "direct-edit") return 1;
  return 2;
}
