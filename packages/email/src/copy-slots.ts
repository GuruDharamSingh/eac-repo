import type { TemplateKey } from './template-store';

// ============================================================================
// Every sentence a letter says, as an addressable slot.
//
// ── What changed, and why ───────────────────────────────────────────────────
//
// copy.ts already held the network's words as named constants, which was most
// of the way here: the copy was data rather than JSX, and revising it was an
// edit to a paragraph. What it could not do was let an ORGANISATION revise it.
// An org's only lever was `bodyText` — one appended section per letter — so
// everything the letter actually said stayed the network's, and the only way
// to change a word of it was to abandon the letter and rebuild it from scratch
// in the layout editor.
//
// That is the wrong shape. Wanting "Confirm account" to read "Finish signing
// up" should not cost you the whole letter.
//
// So each block of copy is a SLOT with an id, and an org may override any of
// them. Same three layers as before, one rung finer:
//
//   1. the slot's own `value`          the network default, always present
//   2. config.copy[<slotId>]           this org's words for that one block
//   3. config.html                     this org's whole layout, as before
//
// ── One declaration, three readers ──────────────────────────────────────────
//
//   the templates   render slots instead of importing constants
//   the editor      lists a letter's slots, so an owner edits copy in place
//   the send path   resolves overrides once, per letter
//
// This mirrors merge-fields.ts deliberately: that file declares WHERE VALUES
// GO, this one declares WHAT TEXT IS THERE, and the editor reads both to show
// an owner a box per block with the tokens that block may use.
// ============================================================================

/** Paragraphs, not a blob: a prose slot renders each as its own <Text>. */
export type Paragraphs = readonly string[];

export type SlotKind =
  /** Several paragraphs of body copy. Edited as rich text. */
  | 'prose'
  /** One short line — a heading, a button, a preview snippet. Plain. */
  | 'line';

export interface CopySlot {
  /** Stable id. Namespaced by letter or by `network.` when it is shared. */
  id: string;
  /** What the editor calls it. */
  label: string;
  /** Where it appears in the letter, in a sentence. */
  hint: string;
  kind: SlotKind;
  /** The network's words. One entry for a `line`. */
  value: Paragraphs;
  /**
   * The `{tokens}` this block may use, by name.
   *
   * A subset of the letter's merge fields, because not every value is in
   * scope everywhere: `{org}` is available in the confirmation paragraph and
   * meaningless in the network manifesto, which is the same for every org.
   * The editor shows only these, so an owner cannot place a token that would
   * ship unfilled.
   */
  tokens?: string[];
}

// ── The network's own words ─────────────────────────────────────────────────
//
// Rewritten 2026-09-18 to be NEUTRAL. The previous copy was written in one
// group's voice — a specific study group's vocabulary, its reading of what the
// project was for, and a closing argument about hockey teams — and it went out
// over the name of every organisation on the network, most of which had never
// seen it. Copy that an org cannot change had better be copy an org would not
// object to. It is all overridable now, but the DEFAULT should not need
// overriding to be inoffensive.

const SLOTS: CopySlot[] = [
  {
    id: 'network.about',
    label: 'About the network',
    hint: 'A short description of the collective, at the foot of the signup letter.',
    kind: 'prose',
    value: [
      'Elkdonis Arts Collective is a network of independent arts organisations sharing one set of tools. Each group runs its own space, its own programme and its own membership; what they have in common is the platform underneath.',
      'We put the artist first and run as a not-for-profit. The aim is practical — give a group the means to organise, publish and sell without handing any of that to a service that will one day change its terms.',
      'Transparency, dialogue, keeping your word, consistency and accountability are the values we try to work by.',
    ],
  },
  {
    id: 'network.resources',
    label: 'What an account gives you',
    hint: 'What signing up actually provides. Follows the description above.',
    kind: 'prose',
    value: [
      'An account gives you access to the resources of the organisation you joined, hosted on the platform’s own servers. Depending on the group, that can include cloud storage and messaging through Nextcloud, a shared whiteboard, and email support.',
      'The platform is most useful when a group is doing something with it — running a regular meeting, publishing work, opening a shop, or simply keeping its files somewhere every member can reach.',
      'None of this is novel, and it is not meant to be. It is a set of ordinary tools, run by the people who use them, for groups who would rather not depend on someone else’s.',
    ],
  },

  // ── Signup ────────────────────────────────────────────────────────────────
  {
    id: 'signup.confirm',
    label: 'The confirmation',
    hint: 'The opening line of the signup letter.',
    kind: 'prose',
    tokens: ['org'],
    value: ['This confirms that you have created an account with {org}.'],
  },
  {
    id: 'signup.membership',
    label: 'What the account is',
    hint: 'Follows the confirm button: the membership, then the network it sits in.',
    kind: 'prose',
    tokens: ['org'],
    value: [
      'You are now a member of {org}.',
      'That membership also connects you to the wider network of Elkdonis Arts Collectives.',
    ],
  },
  {
    id: 'signup.by_purchase',
    label: 'When they joined by booking',
    hint: 'Shown only when the account was created by reserving a place or buying something.',
    kind: 'prose',
    value: [
      'You can now reach the materials for the organisation or event you joined.',
    ],
  },
  {
    id: 'signup.button',
    label: 'Button — confirm',
    hint: 'The main button, when there is an address to confirm.',
    kind: 'line',
    value: ['Confirm account'],
  },
  {
    id: 'signup.button_alt',
    label: 'Button — no confirmation needed',
    hint: 'The main button when the address is already confirmed.',
    kind: 'line',
    value: ['Enter the collective'],
  },
  {
    id: 'signup.heading_org',
    label: 'Heading — your own words',
    hint: 'Sits above whatever this organisation adds to the letter.',
    kind: 'line',
    tokens: ['org'],
    value: ['From {org}'],
  },
  {
    id: 'signup.heading_network',
    label: 'Heading — about the network',
    hint: 'Sits above the network description at the foot of the letter.',
    kind: 'line',
    value: ['About the collective'],
  },

  // ── Cloud account ─────────────────────────────────────────────────────────
  {
    id: 'provisioning.intro',
    label: 'The offer',
    hint: 'The whole body of the cloud-account letter, above the claim button.',
    kind: 'prose',
    tokens: ['org'],
    value: [
      'You can now claim your cloud account and storage, along with access to {org}’s team folder. Follow the link below to finish setting it up.',
    ],
  },

  // ── Reminders and bookings ────────────────────────────────────────────────
  {
    id: 'reminder.intro',
    label: 'Why they are getting this',
    hint: 'The opening line of the reminder.',
    kind: 'prose',
    tokens: ['thread', 'org', 'when'],
    value: ['{thread} is coming up, and you said you were interested.'],
  },
  {
    id: 'reminder.org_note',
    label: 'Closing line',
    hint: 'The last line of the reminder, under the details.',
    kind: 'prose',
    tokens: ['org'],
    // Replaces a line whose dictated source was garbled and which had sat as a
    // TODO reading only "This is part of {org}."
    value: ['This gathering is run by {org}.'],
  },
  {
    id: 'reminder.options',
    label: 'The opt-out note',
    hint: 'Offered wherever someone has just committed to attending something.',
    kind: 'line',
    value: [
      'A reminder is sent the day before. You can turn it off, or change when it arrives.',
    ],
  },
];

/** Every slot, by id. */
export const COPY_SLOTS: Record<string, CopySlot> = Object.fromEntries(
  SLOTS.map((slot) => [slot.id, slot])
);

/**
 * Which blocks each letter is made of, in the order they appear.
 *
 * Reading order, not declaration order — the editor draws a column of boxes
 * from this, and a column that does not match the letter beside it is worse
 * than no column at all.
 */
export const TEMPLATE_SLOTS: Record<string, string[]> = {
  welcome: [
    'signup.confirm',
    'signup.button',
    'signup.button_alt',
    'signup.by_purchase',
    'reminder.options',
    'signup.membership',
    'signup.heading_org',
    'signup.heading_network',
    'network.about',
    'network.resources',
  ],
  provisioning: ['provisioning.intro'],
  'rsvp-guest': ['signup.by_purchase', 'reminder.options'],
  reminder: ['reminder.intro', 'reminder.org_note'],
  'rsvp-owner': [],
  'meeting-trigger': [],
  newsletter: [],
  'contact-owner': [],
};

/** The blocks a letter offers the editor. */
export function copySlotsFor(key: TemplateKey | string): CopySlot[] {
  return (TEMPLATE_SLOTS[key] ?? [])
    .map((id) => COPY_SLOTS[id])
    .filter((slot): slot is CopySlot => Boolean(slot));
}

// ── Overrides ───────────────────────────────────────────────────────────────

/**
 * One org's words for one block.
 *
 * Both layers, for the same reason the letter's own body carries both: `text`
 * is what a template renders as paragraphs and what the plain-text part
 * carries, `html` is what it renders when the org wrote with formatting. `text`
 * is derived from `html`, never typed beside it.
 */
export interface CopyOverride {
  text?: string;
  html?: string;
}

export type CopyOverrides = Record<string, CopyOverride>;

/** Read `config.copy` defensively — it is JSONB an older row may not have. */
export function parseCopyOverrides(value: unknown): CopyOverrides {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: CopyOverrides = {};
  for (const [id, raw] of Object.entries(value as Record<string, unknown>)) {
    // Unknown ids are DROPPED rather than kept: a slot that no longer exists
    // is copy nothing will ever render, and keeping it would let a renamed
    // slot quietly go on storing words nobody sees.
    if (!COPY_SLOTS[id]) continue;
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const text = typeof r.text === 'string' ? r.text.slice(0, 8000) : undefined;
    const html = typeof r.html === 'string' ? r.html.slice(0, 24_000) : undefined;
    if (text?.trim() || html?.trim()) out[id] = { text, html };
  }
  return out;
}

/**
 * Fill `{name}` placeholders.
 *
 * Deliberately dumb — no expressions, no conditionals. This runs over copy an
 * organisation may have typed, and a template language in an email body is a
 * way to execute someone else's text. An unknown key is left as-is rather than
 * blanked, so a typo is visible in a test send instead of silently vanishing
 * the way an undefined SendGrid template variable does.
 */
export function fill(
  paragraphs: Paragraphs,
  values: Record<string, string | undefined>
): string[] {
  return paragraphs.map((paragraph) =>
    paragraph.replace(/\{(\w+)\}/g, (whole, key: string) => values[key] ?? whole)
  );
}

/** Split a free-typed override into paragraphs the way templates want. */
export function paragraphsOf(value: string | undefined): string[] {
  return (value ?? '')
    .split(/\n{2,}|\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * One block's paragraphs, resolved and filled.
 *
 * The org's words if it has any, the network's otherwise. Templates call this
 * instead of importing a constant, which is what makes every one of them
 * overridable without the template knowing that overriding exists.
 */
export function slotText(
  overrides: CopyOverrides | undefined,
  id: string,
  values: Record<string, string | undefined> = {}
): string[] {
  const own = overrides?.[id]?.text;
  const source = own?.trim() ? paragraphsOf(own) : (COPY_SLOTS[id]?.value ?? []);
  return fill(source, values);
}

/** The rich version of a block, when the org wrote one. */
export function slotHtml(
  overrides: CopyOverrides | undefined,
  id: string
): string | undefined {
  const html = overrides?.[id]?.html;
  return html?.trim() ? html : undefined;
}

/**
 * One block as a single line — a heading, a button, a note.
 *
 * Joined rather than truncated: somebody who types two lines into a button
 * label meant both words to appear, and silently dropping the second is the
 * kind of bug that only shows up in a real inbox.
 */
export function slotLine(
  overrides: CopyOverrides | undefined,
  id: string,
  values: Record<string, string | undefined> = {}
): string {
  return slotText(overrides, id, values).join(' ');
}
