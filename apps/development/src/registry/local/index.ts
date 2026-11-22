import type { LocalSource } from "./util";

export type { LocalSource } from "./util";

// ============================================================================
// Registered sources of REAL blocks that are not in a shared package's catalogue: app-local block files imported
// by relative path (one module per app, see ./util.ts for the rules) and the record parts of @elkdonis/blocks.
// Apps listed in LOCAL_APPS draw their blocks live (with the app's scoped sheet under data-mock-app) and open in
// the sandbox. Blocks that cannot be imported stay mocks (registry/mocks).
// ============================================================================

export const LOCAL_SOURCES: LocalSource[] = [
  { app: "shared", label: "Record parts", pkg: "@elkdonis/blocks (record parts)", load: async () => (await import("./record-parts")).load() },
  { app: "art-auction", label: "Art auction", pkg: "apps/art-auction/src/blocks", load: async () => (await import("./art-auction")).load() },
  { app: "arts-collective", label: "Arts Collective", pkg: "apps/arts-collective/src/blocks", load: async () => (await import("./arts-collective")).load() },
  { app: "danamccool", label: "Dana McCool", pkg: "apps/danamccool/src/blocks", load: async () => (await import("./danamccool")).load() },
  { app: "hidden-enneagram", label: "Hidden Enneagram", pkg: "apps/hidden-enneagram/src/blocks", load: async () => (await import("./hidden-enneagram")).load() },
  { app: "katie-the-potter", label: "Katie the Potter", pkg: "apps/katie-the-potter/src/blocks", load: async () => (await import("./katie-the-potter")).load() },
  { app: "sunjay", label: "Sunjay", pkg: "apps/sunjay/src/blocks", load: async () => (await import("./sunjay")).load() },
];

/** Apps whose real blocks are drawn from local files (they get the data-mock-app wrapper). "shared" is excluded: package blocks. */
export const LOCAL_APPS = new Set(LOCAL_SOURCES.map((s) => s.app).filter((a) => a !== "shared"));
