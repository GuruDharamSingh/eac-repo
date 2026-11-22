import type { Block } from "@elkdonis/blocks";
import { LOCAL_SOURCES } from "./local";

// ============================================================================
// Where blocks come from: a registry of lazy imports, one per source.
//
// Each source loads on demand (dynamic import), so the canvas opens before the
// block code arrives and a source that fails to load shows an error row rather
// than taking the page down.
//
// Shared sets are importable cleanly: they are workspace packages that ship
// source. APP-LOCAL sets (apps/<app>/src/blocks) are NOT registered here yet:
// they import through their own app's "@/..." alias, their own server code and
// their own CSS, none of which resolves from this app. Those blocks come from
// blocks.json and show as "app-only" cards with their source path. To add one
// later: give the app a package export for its blocks (no "@/" imports, data
// via sample()), then add a source below with
//   load: async () => (await import("@elkdonis/<pkg>")).BLOCKS
// and, if it needs the app's CSS, scope it in a wrapper class (see scopeCss
// note in DEPLOY.md). Nothing in other apps is changed by this app.
// ============================================================================

export interface BlockSource {
  /** Matches the `app` of a catalogue entry. */
  app: string;
  label: string;
  pkg: string;
  load(): Promise<Block<never>[]>;
}

const BASE_SOURCES: BlockSource[] = [
  {
    app: "shared",
    label: "Shared blocks",
    pkg: "@elkdonis/blocks",
    async load() {
      const m = await import("@elkdonis/blocks");
      // Every catalogue the package ships, de-duplicated by id: the page set, the person and
      // featured sets, the store-panel set, and the featured-person block that sits in none.
      const all = [...m.SHARED_BLOCKS, ...m.PROFILE_PAGE_BLOCKS, ...m.FEATURED_PAGE_BLOCKS, ...m.STORE_PANEL_BLOCKS, m.featuredPerson as unknown as Block<never>];
      const seen = new Set<string>();
      return all.filter((b) => {
        if (!b || seen.has(b.def.id)) return false;
        seen.add(b.def.id);
        return true;
      });
    },
  },
  {
    app: "direct-edit",
    label: "Box blocks",
    pkg: "@elkdonis/direct-edit/puck/blocks",
    async load() {
      const m = await import("@elkdonis/direct-edit/puck/blocks");
      return m.BOX_BLOCKS as unknown as Block<never>[];
    },
  },
];

/** Package sets first, then real app-local blocks (registry/local: relative imports of apps/<app>/src/blocks, plus the record parts). */
export const SOURCES: BlockSource[] = [...BASE_SOURCES, ...LOCAL_SOURCES];
