import type { FormKindId } from './contract';

// ============================================================================
// Studio ↔ Channel for the form kinds (2026-11-11, docs/open/MAKE_INTO_CARRY_2026-11-11.md §1).
// Pure: no React, so both the extension wrapper (focus.tsx) and AfterPublish use it.
// ============================================================================

/** The personal org ("Just me"); the same id as StudioShell's PERSONAL_ORG_ID. */
export const PERSONAL_ORG = 'oad';

/**
 * How Channel keys an item of this form kind, or null when Channel does not list the kind.
 * Channel's pieces are threads of kinds writing, post, meeting, reading_group, series,
 * workshop and event, plus artwork (apps/arts-collective/src/lib/channel/load.ts THREAD_KINDS,
 * read 2026-11-11). Offerings (`service` threads) are not among them, so they get no link.
 */
export function channelStoreOf(kind: FormKindId): 'thread' | 'artwork' | null {
  if (kind === 'artwork') return 'artwork';
  if (kind === 'meeting' || kind === 'post') return 'thread';
  return null;
}
