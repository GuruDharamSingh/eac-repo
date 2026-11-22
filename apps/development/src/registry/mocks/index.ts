import type { AppMocks, MockEntry } from "./types";
import { MOCKS as sunjay } from "./sunjay";
import { MOCKS as hiddenEnneagram } from "./hidden-enneagram";
import { MOCKS as artAuction } from "./art-auction";
import { MOCKS as katie } from "./katie-the-potter";
import { MOCKS as danamccool } from "./danamccool";
import { MOCKS as elktours } from "./elktours";

export type { AppMocks, MockEntry, MockKind } from "./types";

// ============================================================================
// Mock registry: app -> block id -> mock. Each per-app index holds only small
// closures (`() => import("./x")`), so this file is cheap to load; a mock's
// code and CSS arrive when its tile is near the viewport.
// To add an app: create mocks/<app>/index.ts exporting `MOCKS: AppMocks` and add one line here.
// ============================================================================

export const MOCKS: Record<string, AppMocks> = {
  sunjay,
  "hidden-enneagram": hiddenEnneagram,
  "art-auction": artAuction,
  "katie-the-potter": katie,
  danamccool,
  elktours,
};

export function mockFor(app: string, id: string): MockEntry | undefined {
  return MOCKS[app]?.[id];
}
