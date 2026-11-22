import type { Block } from "@elkdonis/blocks";

// ============================================================================
// Real app-local blocks, imported by RELATIVE PATH from apps/<app>/src/blocks (never through that app's "@/"
// alias, which would resolve to this app). Only block files whose import chain is plain relative files and
// packages are listed (blocks.json: importability "app-local" with no "@/" imports); the chain was checked for
// server-only code, "@/" aliases and database imports.
//
// Each per-app module in this folder exports `load()`: the blocks of that app that can be drawn here, each with
// representative props. A block that has its own sample() keeps it; where the world (src/sample) says more, an
// override is merged over it.
// ============================================================================

/** Wraps a block so its sample() is its own, with `over` merged on top (over may be a function for fresh values). */
export function withSample(block: unknown, over?: Record<string, unknown> | (() => Record<string, unknown>)): Block<never> {
  const b = block as Block<Record<string, unknown>>;
  return {
    ...b,
    sample: () => {
      let own: Record<string, unknown> = {};
      try {
        own = (b.sample?.() as Record<string, unknown> | undefined) ?? {};
      } catch {
        own = {};
      }
      const extra = typeof over === "function" ? over() : (over ?? {});
      return { ...own, ...extra };
    },
  } as unknown as Block<never>;
}

/** A source of real blocks for one app. `scope` is the wrapper's data-mock-app value (the app's scoped sheets). */
export interface LocalSource {
  app: string;
  label: string;
  /** Shown in an error row if the load fails. */
  pkg: string;
  load(): Promise<Block<never>[]>;
}
