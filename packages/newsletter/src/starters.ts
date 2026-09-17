import { BLOCKS_FOR_CHECK, type BlockMode, type BlockPalette, NEUTRAL_PALETTE } from './blocks';

// ============================================================================
// Starter layouts.
//
// ── What a starter IS ───────────────────────────────────────────────────────
//
// A list of block ids. Not a file of markup — a COMPOSITION. That is the whole
// design: "give me the layouts" and "give me the blocks the layouts are made
// of" are then the same request answered once, because a layout is literally
// its blocks in order. Change a block and every layout that uses it follows;
// there is no second copy to drift.
//
// ── Where the shapes came from ──────────────────────────────────────────────
//
// Nine layouts in ColorlibHQ/email-templates (MIT) were pulled apart and the
// recurring structures became the blocks above. The arrangements are what was
// taken. None of their colour or typography is here — every value comes from
// the palette, so the same starter serves an org that has chosen nothing and
// one that has chosen a brand. See NOTICE at the repository root.
//
// The names are what the letters DO, not what Colorlib called them: "Receipt",
// not "Northbound". An org picking a starter is choosing a job, not a brand.
// ============================================================================

export interface StarterLetter {
  id: string;
  /** What it is, in the drawer. */
  label: string;
  /** One line on when to reach for it. */
  hint: string;
  /** The blocks, in order. This IS the layout. */
  blocks: string[];
  /** Which document it suits. Omitted means both. */
  only?: BlockMode[];
}

export const STARTER_LETTERS: StarterLetter[] = [
  {
    id: 'digest',
    label: 'Digest',
    hint: 'Three things, counted, each with a source. The letter you send every week.',
    only: ['newsletter'],
    blocks: ['eac-issue-head', 'eac-prose', 'eac-button', 'eac-story-numbered', 'eac-postal-footer'],
  },
  {
    id: 'editorial',
    label: 'Editorial letter',
    hint: 'One long piece with a byline, then a few links worth the click.',
    only: ['newsletter'],
    blocks: ['eac-issue-head', 'eac-essay', 'eac-reads', 'eac-signoff', 'eac-postal-footer'],
  },
  {
    id: 'blog-index',
    label: 'Blog index',
    hint: 'What has been published lately, newest first, with a picture at the top.',
    only: ['newsletter'],
    blocks: ['eac-brandbar', 'eac-hero', 'eac-post-list', 'eac-postal-footer'],
  },
  {
    id: 'seasonal',
    label: 'Seasonal letter',
    hint: 'A picture, some reading, and one thing shown properly. For a turn of the year.',
    only: ['newsletter'],
    blocks: ['eac-brandbar', 'eac-hero', 'eac-post-list', 'eac-media-text', 'eac-postal-footer'],
  },
  {
    id: 'programme',
    label: 'Programme',
    hint: 'A gathering with several parts and the people running them.',
    only: ['newsletter'],
    blocks: ['eac-brandbar', 'eac-hero', 'eac-prose', 'eac-people', 'eac-cta-panel', 'eac-postal-footer'],
  },
  {
    id: 'invitation',
    label: 'Invitation',
    hint: 'One date, said loudly, with a way into the diary.',
    blocks: [
      'eac-brandbar', 'eac-datemark', 'eac-prose', 'eac-button',
      'eac-calendar-links', 'eac-people', 'eac-postal-footer',
    ],
  },
  {
    id: 'receipt',
    label: 'Receipt',
    hint: 'What was bought, what it cost, and how to follow it.',
    blocks: ['eac-brandbar', 'eac-prose', 'eac-order-meta', 'eac-lineitems', 'eac-postal-footer'],
  },
  {
    id: 'basket',
    label: 'Unfinished order',
    hint: 'What is still waiting, and the one button that finishes it.',
    blocks: ['eac-brandbar', 'eac-prose', 'eac-lineitems', 'eac-button', 'eac-postal-footer'],
  },
  {
    id: 'account',
    label: 'Account action',
    hint: 'A link that expires — a reset, a confirmation, an invitation to join.',
    blocks: [
      'eac-brandbar', 'eac-prose', 'eac-button', 'eac-security-note',
      'eac-raw-link', 'eac-postal-footer',
    ],
  },
];

/**
 * A starter, as markup.
 *
 * Every block is looked up rather than inlined, so a starter cannot contain a
 * stale copy of a block that has since been fixed. A block id that does not
 * resolve is skipped rather than throwing — a missing piece should cost that
 * piece, not the whole letter, and `checkStarters` is where the mismatch is
 * reported.
 */
export function renderStarter(
  starter: StarterLetter,
  palette: BlockPalette = NEUTRAL_PALETTE,
  mode: BlockMode = 'newsletter'
): string {
  return starter.blocks
    .map((id) => BLOCKS_FOR_CHECK.find((b) => b.id === id))
    .filter((b): b is NonNullable<typeof b> => Boolean(b))
    .map((b) => b.content(palette, mode).trim())
    .join('\n');
}

/** Every block id a starter names that no block answers to. */
export function unknownStarterBlocks(): { starter: string; missing: string[] }[] {
  const known = new Set(BLOCKS_FOR_CHECK.map((b) => b.id));
  return STARTER_LETTERS.map((s) => ({
    starter: s.id,
    missing: s.blocks.filter((id) => !known.has(id)),
  })).filter((r) => r.missing.length > 0);
}

/**
 * A starter that names a block the mode excludes.
 *
 * `eac-issue-head` is newsletter-only, so a starter carrying it must be too —
 * otherwise a template editor offers a layout whose first block it will not
 * register, and the letter opens missing its masthead.
 */
export function starterModeConflicts(): { starter: string; block: string }[] {
  const out: { starter: string; block: string }[] = [];
  for (const s of STARTER_LETTERS) {
    const modes: BlockMode[] = s.only ?? ['newsletter', 'template'];
    for (const id of s.blocks) {
      const block = BLOCKS_FOR_CHECK.find((b) => b.id === id);
      if (!block?.only) continue;
      for (const m of modes) {
        if (!block.only.includes(m)) out.push({ starter: s.id, block: id });
      }
    }
  }
  return out;
}
