// ============================================================================
// Channel's registry vocabulary (2026-11-07). Client-safe: types and constants
// only, so the dock, the Channel UI and the server read one shape.
//
// Channel (arts-collective /channel; docs/open/channel.md) plans each piece's
// outlets: routines open slots, gaps become suggestions, plan.md holds the
// piece's steps. Its registry entries (catalogue ids `channel-*`) let the dock,
// the HTTP door and later an assistant advance the same board the pages show.
// docs/open/CHANNEL_REGISTRY_AND_BOARD_2026-11-07.md.
// ============================================================================
import type { ActionNextItem } from './types';

/** The outlets a channel row can name (`@elkdonis/services/channel` CHANNEL_OUTLETS, copied: services is not client-safe). */
export const CHANNEL_OUTLET_IDS = ['site', 'page', 'market', 'instagram', 'facebook', 'threads', 'youtube', 'video', 'writing', 'live', 'newsletter'] as const;
export type ChannelOutletId = (typeof CHANNEL_OUTLET_IDS)[number];

/** What a next move is, for its kicker and its order. */
export type ChannelMoveKind =
  /** A routine slot ahead, with or without a suggestion placed in it. */
  | 'slot'
  /** A suggestion placed by date (three days before the piece's own date). */
  | 'suggestion'
  /** A published piece missing from Instagram or Facebook, not placed in time. */
  | 'gap'
  /** A video, writing or letter after the piece, not placed in time. */
  | 'follow-up'
  /** An unticked step of the person's own in plan.md. */
  | 'step'
  /** A dated to-do for today or tomorrow. */
  | 'todo'
  /** A Channel draft: placed in the week, or not placed yet. */
  | 'draft'
  /** An undated note ("Your note" in the tray). */
  | 'note'
  /** A live delivery ahead. */
  | 'live'
  /** Getting set up: connect an account, set the org's channel, a first piece or post, a first routine (2026-11-07). */
  | 'setup';

/**
 * One next move on a channel's board: the row on Channel Home, the dock's
 * Channel part and `channel-next`'s status all carry this shape. `run` (from
 * ActionNextItem) is the registry entry that performs it; `open` says how the
 * Channel pages finish it in place; `href` is the address that gets there
 * from anywhere else.
 */
export interface ChannelNextMove extends ActionNextItem {
  kind: ChannelMoveKind;
  /** "Fri · Instagram slot", "Gap · Facebook", "Plan step · due today". */
  kicker: string;
  outlet: string | null;
  pieceKey: string | null;
  pieceTitle: string | null;
  /** The identity the move goes out under (`user:<id>` / `org:<id>`), when it has one. */
  identityId: string | null;
  open: null | { kind: 'sheet' | 'piece' | 'plan' | 'studio' | 'live' | 'queue'; label: string };
}

/** The channel entries the dock may perform (it never offers dismiss: that hides a gap for good). */
export const CHANNEL_DOCK_ACTIONS: readonly string[] = ['channel-suggestion-accept', 'channel-slot-fill', 'channel-plan-step'];
