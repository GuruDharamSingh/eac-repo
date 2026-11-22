import type { ComponentType } from "react";

/**
 * A mock tile for an app-local block (one that needs its app's providers, server data or "@/"
 * aliases). "real" = the real presentational component (a package component, or the app's own
 * file imported by relative path) drawn with invented data. "static" = a copy of the block's markup
 * and class names, with the block's CSS scoped under [data-mock-app="<scope>"].
 */
export type MockKind = "real" | "static";

export interface MockEntry {
  kind: MockKind;
  /** Lazy: the module's default export is a React component taking no props. */
  load(): Promise<{ default: ComponentType }>;
  /** The wrapper's data-mock-app value (default: the block's app). */
  scope?: string;
  /** One line on what is real and what is invented, shown on the tile. */
  note?: string;
}

/** Block id -> mock, for one app. */
export type AppMocks = Record<string, MockEntry>;
