import type { PieceSummaryView } from "@elkdonis/content/summary";
import type { ContentListItem } from "@elkdonis/content/model";
import type { GridCol, GridPieceRef, GridRow } from "../site/grid-data";
import type { Suggestion } from "../model";

/**
 * The Channel hub card's data (2026-11-15; docs/open/channel-convergence-2026-11-15 C B.2, F). Plain, serialisable
 * JSON: the face, the pop-up and /api/hub/channel all carry exactly this. Types only, so a client file may import it;
 * the reducer is ./server (`channelHubData`).
 */

/** A matrix dot: what the piece has on that outlet. */
export type HubDot = "failed" | "out" | "scheduled" | "planned" | "draft" | "none";

export interface ChannelHubMatrix {
  cols: Array<{ id: string; label: string; title: string; outlet: string }>;
  rows: Array<{ key: string; title: string; cells: HubDot[] }>;
}

export interface ChannelHubMove {
  id: string;
  kicker: string;
  title: string;
  reason: string | null;
  run: null | { id: string; input: Record<string, unknown>; label: string; busyLabel: string };
}

export interface ChannelHubPiece {
  key: string;
  title: string;
  kind: string;
  kindLabel: string;
  status: string;
  thumb: string | null;
  /** Mini marks, one per Board column. */
  marks: Array<{ id: string; label: string; state: HubDot }>;
  /** The row in the shared PieceList. */
  item: ContentListItem;
  /** The shared summary, ready to draw. */
  view: PieceSummaryView;
  identityId: string;
  suggestions: Suggestion[];
  moves: ChannelHubMove[];
  plan: { started: boolean; goal: string | null; steps: Array<{ index: number; text: string; done: boolean; on: string | null }> };
  /** The site pop-up's Edit: the quick form (`/channel?piece=<key>&edit=1`) where the site has one, else Studio. */
  editHref: string;
  /** Studio's form for the piece (handed off by the site; "" when the host gave no builder). */
  studioHref: string | null;
  /** Make into targets, as the site pop-up draws them. */
  makeInto: Array<{ to: string; label: string; href: string }>;
  /** `/channel?piece=<key>&tab=plan`. */
  channelHref: string;
}

export interface ChannelHubData {
  orgName: string;
  timeZone: string;
  /** The face's matrix: the top pieces by the Board's outlets. */
  matrix: ChannelHubMatrix;
  counts: { waiting: number; failed: number; pieces: number };
  /** The chart's two tables, built by the site Channel's own builders. */
  board: { cols: GridCol[]; rows: GridRow[] };
  week: { cols: GridCol[]; rows: GridRow[]; routineNames: string[]; label: string };
  pieceRefs: GridPieceRef[];
  pieces: ChannelHubPiece[];
}
