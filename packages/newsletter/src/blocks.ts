// ============================================================================
// The EAC email block library — the newsletter editor's half of the suite.
//
// @elkdonis/email draws the network's letters in React. This draws the SAME
// shapes as drag-and-drop blocks, so an organisation that wants to lay out its
// own email is composing with the house vocabulary rather than starting from a
// blank page and inventing a second visual language.
//
// Every block is a <table> with inline styles. Not a stylistic choice — it is
// the only layout mail clients agree on: no flex, no grid, no class selectors,
// no shorthand `background`, no `rem`. The preset inlines what CSS remains via
// juice on export, but a block that relies on a class would still lose its
// layout in Outlook, which renders through Word.
//
// The palette is a parameter rather than a constant because the suite's
// templates default to the dark card, and a block library in a different
// palette would quietly produce emails that do not match the ones the network
// sends around them.
// ============================================================================

export interface BlockPalette {
  cardBg: string;
  bodyBg: string;
  textPrimary: string;
  textBody: string;
  textMuted: string;
  boxBg: string;
  boxBorder: string;
  accent: string;
  gold: string;
  headerFont: string;
  bodyFont: string;
}

// ── Whose colours are these? ─────────────────────────────────────────────────
//
// The two palettes below are INNERGATHERING'S — navy, gold, Brothers and
// Basteleur. They were written when the suite served one organisation and they
// are not the network's look, because the network does not have one yet.
//
// So a starter layout must not bake them in. `NEUTRAL_PALETTE` is what an
// unthemed org gets: greys, system faces, one restrained accent. It is
// deliberately plain — a starter should read as "yours to colour", not as
// somebody else's brand you have to strip out first.
//
// `paletteFor()` turns the three roles an org already stores on its email
// identity (accent / onAccent / ink — see EmailPalette in @elkdonis/email)
// into the eleven a block needs. Three is what a person can choose; eleven is
// what a layout needs. Deriving the rest is what keeps those two facts apart.

/**
 * The default. No organisation's colours, on purpose.
 *
 * System faces rather than the collective's: a webfont that fails to load in
 * Gmail (which strips @font-face) falls back to something, and the something
 * should be what the layout was designed against.
 */
export const NEUTRAL_PALETTE: BlockPalette = {
  cardBg: '#ffffff',
  bodyBg: '#f4f4f5',
  textPrimary: '#18181b',
  textBody: '#3f3f46',
  textMuted: '#71717a',
  boxBg: '#fafafa',
  boxBorder: '#e4e4e7',
  accent: '#18181b',
  gold: '#71717a',
  headerFont: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
  bodyFont: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
};

/** The same, on a dark ground. */
export const NEUTRAL_DARK_PALETTE: BlockPalette = {
  cardBg: '#18181b',
  bodyBg: '#09090b',
  textPrimary: '#fafafa',
  textBody: '#d4d4d8',
  textMuted: '#a1a1aa',
  boxBg: '#232326',
  boxBorder: '#3f3f46',
  accent: '#fafafa',
  gold: '#a1a1aa',
  headerFont: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
  bodyFont: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
};

export interface PaletteChoice {
  /** The org's colour — rules, headings, button fills. */
  accent?: string | null;
  /** Ink that sits ON the accent. Must clear 4.5:1 against it. */
  onAccent?: string | null;
  /** Body ink. */
  ink?: string | null;
  /** Which ground the letter sits on. */
  ground?: 'light' | 'dark';
  /** Display face, if the org has one. Falls back to the system stack. */
  headerFont?: string | null;
  bodyFont?: string | null;
}

/**
 * An org's few choices, expanded into the eleven a layout needs.
 *
 * Only what the org actually set is honoured; everything else comes from the
 * neutral ground. That is what lets someone pick one colour and get a coherent
 * letter rather than a half-recoloured one.
 *
 * `onAccent` is NOT derived, because deriving it is how the recurring contrast
 * bug in this repo happens — white on a light accent. If an org sets a pale
 * accent and no ink to go on it, the button keeps the neutral pairing rather
 * than guessing.
 */
export function paletteFor(choice: PaletteChoice = {}): BlockPalette {
  const base = choice.ground === 'dark' ? NEUTRAL_DARK_PALETTE : NEUTRAL_PALETTE;
  const hex = (v: string | null | undefined) =>
    typeof v === 'string' && /^#[0-9a-f]{3,8}$/i.test(v.trim()) ? v.trim() : undefined;

  const accent = hex(choice.accent);
  return {
    ...base,
    ...(accent ? { accent, gold: accent } : {}),
    ...(hex(choice.ink) ? { textBody: hex(choice.ink)! } : {}),
    ...(choice.headerFont ? { headerFont: choice.headerFont } : {}),
    ...(choice.bodyFont ? { bodyFont: choice.bodyFont } : {}),
  };
}

/**
 * The ink to put ON the accent, for a filled button.
 *
 * Returns the org's own choice when it made one; otherwise picks black or
 * white by the accent's luminance — the one derivation that is safe to make,
 * because it is measured rather than assumed.
 */
export function onAccentFor(palette: BlockPalette, chosen?: string | null): string {
  if (typeof chosen === 'string' && /^#[0-9a-f]{3,8}$/i.test(chosen.trim())) return chosen.trim();
  const h = palette.accent.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  // 0.179 is where #000 and #fff give equal contrast against the colour.
  return L > 0.179 ? '#000000' : '#ffffff';
}

/** InnerGathering's dark card. Mirrors getEmailPalette(true) in @elkdonis/email. */
export const DARK_BLOCK_PALETTE: BlockPalette = {
  cardBg: '#141a2e',
  bodyBg: '#05070d',
  textPrimary: '#fdf0d0',
  textBody: '#d9d2c2',
  textMuted: '#b79a55',
  boxBg: '#1c2440',
  boxBorder: '#333f6b',
  accent: '#c9a84c',
  gold: '#b79a55',
  headerFont: "'Brothers', 'Cinzel', Georgia, serif",
  bodyFont: "'Basteleur', 'Cormorant Garamond', Georgia, serif",
};

/** InnerGathering's parchment variant. Mirrors getEmailPalette(false). */
export const LIGHT_BLOCK_PALETTE: BlockPalette = {
  cardBg: '#fffdf8',
  bodyBg: '#efe9db',
  textPrimary: '#01124E',
  textBody: '#374238',
  textMuted: '#8f763c',
  boxBg: '#f4f7ff',
  boxBorder: '#dce6ff',
  accent: '#022278',
  gold: '#b79a55',
  headerFont: "'Brothers', 'Cinzel', Georgia, serif",
  bodyFont: "'Basteleur', 'Cormorant Garamond', Georgia, serif",
};

// ── Columns that stack, without a media query ────────────────────────────────
//
// Adapted from Cerberus (MIT, © 2017 Ted Goas) — its "hybrid" pattern. The
// problem it solves: Gmail honours media queries, Outlook does not, and the
// picture row was three 90px thumbnails on a phone.
//
// The trick is that `width:100%` fights `max-width` and `min-width` at
// different container sizes, with no query involved:
//
//   wide container   each column is capped at `max` → they sit side by side
//   narrow container `min` is larger than the share available → they wrap
//
// Outlook sees neither, so it gets a real table through conditional comments,
// which it is the only client to read.
//
// `font-size:0` on the parent is not decoration: inline-blocks are inline, so
// the whitespace BETWEEN them in the source renders as a space and pushes the
// last column onto its own line. Each column resets it.
//
// See NOTICE at the repository root.

interface StackOptions {
  /**
   * Width a column is capped at when there is room.
   *
   * This is what does the stacking. Each column is `width:100%` — it wants the
   * whole parent — and `max-width` is the only thing keeping them side by
   * side. So `max × columns` must fit the content width (520px inside the
   * card), and on a phone `width:100%` resolves smaller than two columns'
   * worth and they wrap on their own.
   */
  max: number;
  /**
   * A readability FLOOR, below the cap — not a wrap trigger.
   *
   * It stops a column becoming unreadably thin if it ever lands in a container
   * narrower than this. Setting it above `max` would pin every column to the
   * floor and break the side-by-side layout, which is what happened the first
   * time.
   */
  min: number;
}

function stackRow(cells: string[], o: StackOptions): string {
  const col = (inner: string, i: number) => `
      ${i === 0 ? '' : `<!--[if mso]></td><td width="${o.max}" valign="top"><![endif]-->`}
      <div style="display:inline-block;margin:0 -1px;width:100%;min-width:${o.min}px;max-width:${o.max}px;vertical-align:top;font-size:14px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td>${inner}</td></tr></table>
      </div>`;
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td style="font-size:0;text-align:left;">
    <!--[if mso]><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td width="${o.max}" valign="top"><![endif]-->
${cells.map(col).join('\n')}
    <!--[if mso]></td></tr></table><![endif]-->
  </td></tr>
</table>`;
}

// ── Thread cards, by kind ────────────────────────────────────────────────────
//
// A workshop and a blog post are not the same object and should not wear the
// same card. A gathering's whole point is WHEN and WHERE — those lines are the
// reason someone reads it. A piece of writing has neither; what it has is a
// cover, a standfirst and a date it was published, and rendering it in the
// gathering shape leaves two empty lines where the time should be.
//
// Two shapes rather than one per kind: the distinction that matters is whether
// the thing HAPPENS or was WRITTEN, and a shape per kind would be eight
// near-identical templates drifting apart. A kind the network adds later falls
// into one or the other by its own nature.

export type ThreadCardShape = 'gathering' | 'writing';

/** Kinds that happen at a time and a place. Everything else was written. */
const GATHERING_KINDS = new Set(['meeting', 'workshop', 'event', 'service']);

export function shapeForKind(kind?: string | null): ThreadCardShape {
  return kind && GATHERING_KINDS.has(kind) ? 'gathering' : 'writing';
}

/** What a card can show. The union of both shapes' needs. */
export interface ThreadCardFields {
  id: string;
  title: string;
  kind?: string | null;
  when?: string | null;
  where?: string | null;
  summary?: string | null;
  url?: string | null;
  orgName?: string | null;
  /** Writing only: the cover image, when the thread has one. */
  coverUrl?: string | null;
  /** Writing only: when it was published, already formatted. */
  published?: string | null;
}

const ENT: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
};
const e = (v: string) => v.replace(/[&<>"']/g, (c) => ENT[c]!);

/**
 * One card's markup.
 *
 * The single place this shape exists. The block's palette version, the
 * editor's insert-already-linked version and the send-time resolver all have
 * to agree on the `data-eac-thread-field` names, and three copies of that
 * agreement is how a card ends up looking right in the editor and arriving
 * unfilled.
 *
 * `tokens` swaps the values for `{meetingTitle}`-style placeholders, which is
 * what a TEMPLATE card needs — there the thread differs per recipient.
 */
export function threadCardMarkup(
  data: Partial<ThreadCardFields>,
  p: BlockPalette,
  opts: { shape?: ThreadCardShape; tokens?: boolean; empty?: boolean } = {}
): string {
  const shape = opts.shape ?? shapeForKind(data.kind);
  const t = opts.tokens;
  const id = opts.empty ? '' : (data.id ?? '');
  const label = opts.empty
    ? ''
    : [data.title, data.kind, data.when ?? data.published].filter(Boolean).join(' · ');

  const val = (real: string | null | undefined, token: string, blank = '') =>
    t ? token : opts.empty ? blank : e(real ?? '');

  const box = `background:${p.boxBg};border:1px solid ${p.boxBorder};margin:24px 0;`;
  const body = `font-family:${p.bodyFont};`;
  const kicker = `font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${p.textMuted};padding-bottom:6px;`;
  const title = `${body}font-family:${p.headerFont};font-size:19px;line-height:1.3;color:${p.textPrimary};padding-bottom:8px;`;
  const line = `${body}font-size:14px;color:${p.textBody};`;
  const blurb = `${body}font-size:14px;line-height:1.6;color:${p.textBody};padding-bottom:10px;`;
  const link = `${body}color:${p.accent};font-size:14px;text-decoration:underline;`;

  const open = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" data-eac-thread="${e(id)}"${label ? ` data-eac-thread-label="${e(label)}"` : ''} data-eac-shape="${shape}" style="${box}">`;

  if (shape === 'writing') {
    // A cover only when there is one: an empty <img> in a mail client is a
    // broken-image icon, not a blank space.
    const cover =
      data.coverUrl || t || opts.empty
        ? `<tr><td style="padding:0;"><img data-eac-thread-field="cover" src="${t ? '{coverImageUrl}' : e(data.coverUrl ?? '')}" alt="" width="600" style="display:block;width:100%;max-width:100%;height:auto;border:0;" /></td></tr>`
        : '';
    return `${open}
  ${cover}
  <tr><td style="padding:18px 20px;">
    <div data-eac-thread-field="kind" style="${kicker}">${val(
      [data.kind, data.orgName].filter(Boolean).join(' · '),
      '{threadKind} · {orgName}',
      'Pick something to feature'
    )}</div>
    <div data-eac-thread-field="title" style="${title}">${val(data.title, '{meetingTitle}', 'Nothing linked yet')}</div>
    <div data-eac-thread-field="summary" style="${blurb}">${val(data.summary, '{summary}')}</div>
    <div data-eac-thread-field="date" style="${line}padding-bottom:12px;">${val(data.published, '{when}')}</div>
    <a data-eac-thread-field="url" href="${t ? '{threadUrl}' : e(data.url ?? '#')}" style="${link}">Read it</a>
  </td></tr>
</table>`;
  }

  return `${open}
  <tr><td style="padding:18px 20px;">
    <div data-eac-thread-field="kind" style="${kicker}">${val(
      [data.kind, data.orgName].filter(Boolean).join(' · '),
      '{threadKind} · {orgName}',
      'Pick something to feature'
    )}</div>
    <div data-eac-thread-field="title" style="${title}">${val(data.title, '{meetingTitle}', 'Nothing linked yet')}</div>
    <div data-eac-thread-field="summary" style="${blurb}">${val(data.summary, '{summary}')}</div>
    <div data-eac-thread-field="when" style="${line}">${val(data.when, '{when}')}</div>
    <div data-eac-thread-field="where" style="${line}padding-bottom:12px;">${val(data.where, '{location}')}</div>
    <a data-eac-thread-field="url" href="${t ? '{threadUrl}' : e(data.url ?? '#')}" style="${link}">Navigate back to view details</a>
  </td></tr>
</table>`;
}

/** The category these blocks appear under in the editor's panel. */
export const EAC_CATEGORY = 'Elkdonis';

/**
 * The two documents these blocks serve.
 *
 * The same "Thread card" means opposite things in each: in a TEMPLATE the
 * thread differs per recipient, so the card carries `{meetingTitle}` tokens
 * that fill at send; in a NEWSLETTER the author is pointing at one specific
 * thing, so the card carries a link to it and is filled from that row. A
 * single content string cannot be both, and guessing wrong either mails a
 * literal "{meetingTitle}" or pins one workshop into every confirmation.
 */
export type BlockMode = 'newsletter' | 'template';

interface BlockDef {
  id: string;
  label: string;
  /** One line of help, shown as the block's title attribute. */
  hint: string;
  /**
   * The documents this block belongs in. Omitted means both.
   *
   * An "Issue masthead" or a contents list is meaningless in a TEMPLATE — an
   * RSVP confirmation is one letter about one thing, not an issue with
   * contents. Offering them there would be offering furniture for a room that
   * does not exist.
   */
  only?: BlockMode[];
  content: (p: BlockPalette, mode: BlockMode) => string;
}

// A cell that carries the body face, repeated on every text cell because
// inheritance through <table> is unreliable in Outlook.
const cell = (p: BlockPalette, extra = '') =>
  `font-family:${p.bodyFont};${extra}`;

const BLOCKS: BlockDef[] = [
  {
    id: 'eac-prose',
    label: 'Paragraph',
    hint: 'Body copy in the collective’s reading face.',
    content: (p) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td style="${cell(p, `font-size:15px;line-height:1.75;color:${p.textBody};padding:0 0 16px;`)}">
    Write here. Keep it to what a person would actually say out loud — the
    letters in this suite are long because they mean something, not because
    they are padded.
  </td></tr>
</table>`,
  },

  {
    id: 'eac-heading',
    label: 'Section label',
    hint: 'The small gold rule-line above a new section.',
    content: (p) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td style="${cell(p, `font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.13em;text-transform:uppercase;color:${p.gold};padding:0 0 14px;`)}">
    About the collective
  </td></tr>
</table>`,
  },

  {
    id: 'eac-profile-card',
    label: 'Profile card',
    hint: 'Who the account is — name, handle, address.',
    content: (p) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${p.boxBg};border:1px solid ${p.boxBorder};margin:24px 0;">
  <tr>
    <td width="72" valign="top" style="padding:18px 0 18px 20px;">
      <img src="https://elkdonis-arts.org/email/avatar-placeholder.png" alt="" width="44" height="44" style="display:block;border-radius:22px;border:1px solid ${p.gold};" />
    </td>
    <td valign="top" style="padding:18px 20px 18px 0;">
      <div style="${cell(p, `font-family:${p.headerFont};font-size:17px;line-height:1.3;color:${p.textPrimary};padding-bottom:3px;`)}">Their Name</div>
      <div style="${cell(p, `font-size:13px;color:${p.textMuted};padding-bottom:2px;`)}">@handle</div>
      <div style="${cell(p, `font-size:13px;color:${p.textBody};`)}">them@example.com</div>
    </td>
  </tr>
</table>`,
  },

  {
    id: 'eac-thread-card',
    label: 'Gathering card',
    hint: 'A workshop, meeting or event — when and where it is.',
    content: (p, mode) =>
      threadCardMarkup({}, p, { shape: 'gathering', tokens: mode === 'template', empty: true }),
  },

  {
    id: 'eac-writing-card',
    label: 'Blog card',
    hint: 'A post or a piece of writing — cover, standfirst, and when it went up.',
    content: (p, mode) =>
      threadCardMarkup({}, p, { shape: 'writing', tokens: mode === 'template', empty: true }),
  },

  // ── Letter furniture ──────────────────────────────────────────────────────
  //
  // The thirteen blocks above are sentences. These are the parts that make a
  // LETTER: something to open with, one thing to lead on, a map of what is
  // inside, a change of pace, a digest, a look, an ask, and a signature. They
  // are what the kit was missing — you could write a paragraph but not compose
  // an issue.

  {
    id: 'eac-issue-head',
    label: 'Issue masthead',
    hint: 'How the letter opens — what it is, and when.',
    only: ['newsletter'],
    content: (p) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
  <tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${p.gold};padding-bottom:10px;">Letter N&ordm; 4</td></tr>
  <tr><td style="${cell(p, `font-family:${p.headerFont};font-size:30px;line-height:1.2;color:${p.textPrimary};padding-bottom:10px;`)}">What we are working on this season</td></tr>
  <tr><td style="${cell(p, `font-size:14px;letter-spacing:0.04em;color:${p.textMuted};padding-bottom:16px;`)}">October 2026 &middot; Amrit Canada</td></tr>
  <tr><td style="${cell(p, `font-size:16px;line-height:1.7;color:${p.textBody};padding-bottom:20px;`)}">One paragraph to say what this letter is for. Keep it to what you would say if you handed it to someone in person.</td></tr>
  <tr><td style="border-top:1px solid ${p.boxBorder};font-size:0;line-height:0;">&nbsp;</td></tr>
</table>`,
  },

  {
    id: 'eac-feature',
    label: 'Lead feature',
    hint: 'The one thing this letter is really about. Full width, with a picture.',
    content: (p, mode) => {
      const t = mode === 'template';
      return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" data-eac-thread="" data-eac-shape="feature" style="margin:0 0 30px;">
  <tr><td style="padding-bottom:14px;">
    <img data-eac-thread-field="cover" src="${t ? '{coverImageUrl}' : 'https://elkdonis-arts.org/email/placeholder.png'}" alt="" width="600" style="display:block;width:100%;max-width:100%;height:auto;border:0;" />
  </td></tr>
  <tr><td data-eac-thread-field="kind" style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${p.gold};padding-bottom:8px;">${t ? '{threadKind} &middot; {orgName}' : 'The lead'}</td></tr>
  <tr><td data-eac-thread-field="title" style="${cell(p, `font-family:${p.headerFont};font-size:26px;line-height:1.25;color:${p.textPrimary};padding-bottom:10px;`)}">${t ? '{meetingTitle}' : 'Nothing linked yet'}</td></tr>
  <tr><td data-eac-thread-field="summary" style="${cell(p, `font-size:16px;line-height:1.7;color:${p.textBody};padding-bottom:14px;`)}">${t ? '{summary}' : 'A sentence or two on why it matters.'}</td></tr>
  <tr><td><a data-eac-thread-field="url" href="${t ? '{threadUrl}' : '#'}" style="${cell(p, `color:${p.accent};font-size:15px;text-decoration:underline;`)}">Read the whole thing</a></td></tr>
</table>`;
    },
  },

  {
    id: 'eac-contents',
    label: 'In this letter',
    hint: 'A map of what is below, so a reader can decide before scrolling.',
    only: ['newsletter'],
    content: (p) => {
      const row = (n: string, text: string, last = false) => `
  <tr>
    <td width="34" valign="top" style="${cell(p, `font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:0.1em;color:${p.gold};padding:9px 0;`)}">${n}</td>
    <td valign="top" style="${cell(p, `font-size:15px;line-height:1.5;color:${p.textBody};padding:9px 0;${last ? '' : `border-bottom:1px solid ${p.boxBorder};`}`)}">${text}</td>
  </tr>`;
      return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${p.boxBg};border:1px solid ${p.boxBorder};margin:0 0 28px;">
  <tr><td style="padding:18px 20px 4px;">
    <div style="${cell(p, `font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${p.textMuted};padding-bottom:4px;`)}">In this letter</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${row('01', 'What we have been making')}
      ${row('02', 'Three gatherings before the end of the month')}
      ${row('03', 'A note on the new studio', true)}
    </table>
  </td></tr>
</table>`;
    },
  },

  {
    id: 'eac-quote',
    label: 'Quote',
    hint: 'A line worth slowing down for — from a member, a teaching, a review.',
    content: (p) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:30px 0;">
  <tr>
    <td width="26" valign="top" style="${cell(p, `font-family:${p.headerFont};font-size:38px;line-height:0.9;color:${p.gold};padding-top:4px;`)}">&ldquo;</td>
    <td style="${cell(p, `font-family:${p.headerFont};font-size:20px;line-height:1.55;color:${p.textPrimary};padding-bottom:10px;`)}">
      The work is not to become someone else. It is to stop leaving.
    </td>
  </tr>
  <tr>
    <td></td>
    <td style="${cell(p, `font-size:13px;letter-spacing:0.06em;color:${p.textMuted};`)}">&mdash; Who said it, and where</td>
  </tr>
</table>`,
  },

  {
    id: 'eac-agenda',
    label: "What's coming",
    hint: 'Several dated things at a glance. Link each row to its own thread.',
    only: ['newsletter'],
    content: (p) => {
      const row = (last = false) => `
  <tr data-eac-thread="" data-eac-shape="agenda">
    <td width="74" valign="top" style="padding:12px 14px 12px 0;${last ? '' : `border-bottom:1px solid ${p.boxBorder};`}">
      <div data-eac-thread-field="when" style="${cell(p, `font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.45;letter-spacing:0.06em;text-transform:uppercase;color:${p.gold};`)}">Date</div>
    </td>
    <td valign="top" style="padding:12px 0;${last ? '' : `border-bottom:1px solid ${p.boxBorder};`}">
      <div style="${cell(p, `font-size:15px;line-height:1.45;color:${p.textPrimary};`)}"><a data-eac-thread-field="url" href="#" style="color:${p.textPrimary};text-decoration:none;"><span data-eac-thread-field="title">Nothing linked yet</span></a></div>
      <div data-eac-thread-field="where" style="${cell(p, `font-size:13px;line-height:1.5;color:${p.textMuted};padding-top:2px;`)}"></div>
    </td>
  </tr>`;
      return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
  <tr><td style="${cell(p, `font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${p.textMuted};padding-bottom:6px;border-bottom:1px solid ${p.gold};`)}">What&rsquo;s coming</td></tr>
  <tr><td>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${row()}${row()}${row(true)}
    </table>
  </td></tr>
</table>`;
    },
  },

  {
    id: 'eac-gallery',
    label: 'Picture row',
    hint: 'Three images across on a screen, stacked on a phone. Delete a cell for two.',
    content: (p) => {
      const pic = `
        <img src="https://elkdonis-arts.org/email/placeholder.png" alt="" width="170" style="display:block;width:100%;max-width:100%;height:auto;border:0;" />
        <div style="${cell(p, `font-size:12px;line-height:1.45;color:${p.textMuted};padding:6px 0 14px;`)}">What this is</div>`;
      // 3 x 170 = 510, inside the card's 520 of content. On a phone the
      // parent is ~240, so one 170px column fits per line and they stack.
      return stackRow([pic, pic, pic], { max: 170, min: 140 });
    },
  },

  {
    id: 'eac-cta-panel',
    label: 'Ask panel',
    hint: 'One thing you want the reader to do, with room to say why.',
    content: (p) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${p.boxBg};border:1px solid ${p.gold};margin:30px 0;">
  <tr><td align="center" style="padding:28px 26px;">
    <div style="${cell(p, `font-family:${p.headerFont};font-size:21px;line-height:1.3;color:${p.textPrimary};padding-bottom:8px;`)}">Come and sit with us</div>
    <div style="${cell(p, `font-size:15px;line-height:1.65;color:${p.textBody};padding-bottom:18px;`)}">A line on what this is and who it is for. Two sentences at most &mdash; the button is the point.</div>
    <a href="https://example.org" style="background-color:${p.accent};color:${onAccentFor(p)};font-family:${p.headerFont};font-size:14px;text-transform:uppercase;letter-spacing:0.1em;padding:13px 28px;text-decoration:none;display:inline-block;">Take a place</a>
  </td></tr>
</table>`,
  },

  {
    id: 'eac-signoff',
    label: 'Sign-off',
    hint: 'Who the letter is from. A letter that nobody signed reads as a circular.',
    content: (p) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:30px 0 0;">
  <tr>
    <td width="56" valign="top" style="padding:0 14px 0 0;">
      <img src="https://elkdonis-arts.org/email/avatar-placeholder.png" alt="" width="42" height="42" style="display:block;border-radius:21px;border:1px solid ${p.gold};" />
    </td>
    <td valign="middle">
      <div style="${cell(p, `font-family:${p.headerFont};font-size:17px;line-height:1.3;color:${p.textPrimary};`)}">&mdash; Their Name</div>
      <div style="${cell(p, `font-size:13px;color:${p.textMuted};padding-top:2px;`)}">for the collective</div>
    </td>
  </tr>
</table>`,
  },

  {
    id: 'eac-spacer',
    label: 'Space',
    hint: 'Breathing room. Margins are the first thing a mail client throws away.',
    content: () => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td height="28" style="height:28px;font-size:0;line-height:0;">&nbsp;</td></tr>
</table>`,
  },

  // ── Harvested from Colorlib ───────────────────────────────────────────────
  //
  // Structures lifted from ColorlibHQ/email-templates (MIT) — nine layouts
  // pulled apart into the shapes they are actually made of. What was taken is
  // the ARRANGEMENT; every colour and face comes from the palette, so the same
  // block serves an org that has chosen nothing and one that has chosen a
  // brand. See NOTICE at the repository root.

  {
    id: 'eac-brandbar',
    label: 'Brand bar',
    hint: 'The name at the top, with optional links beside it.',
    content: (p) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-bottom:1px solid ${p.boxBorder};margin:0 0 26px;">
  <tr>
    <td style="${cell(p, `font-family:${p.headerFont};font-size:19px;letter-spacing:0.02em;color:${p.textPrimary};padding:0 0 14px;`)}">Your organisation</td>
    <td align="right" style="${cell(p, `font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:${p.textMuted};padding:0 0 14px;`)}">
      <a href="https://example.org" style="color:${p.textMuted};text-decoration:none;">Home</a> &nbsp;
      <a href="https://example.org" style="color:${p.textMuted};text-decoration:none;">About</a> &nbsp;
      <a href="https://example.org" style="color:${p.textMuted};text-decoration:none;">Contact</a>
    </td>
  </tr>
</table>`,
  },

  {
    id: 'eac-hero',
    label: 'Hero',
    hint: 'A picture, a headline and one thing to do. How a letter opens when it opens loudly.',
    content: (p) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 30px;">
  <tr><td style="padding-bottom:18px;">
    <img src="https://elkdonis-arts.org/email/placeholder.png" alt="" width="600" style="display:block;width:100%;max-width:100%;height:auto;border:0;" />
  </td></tr>
  <tr><td style="${cell(p, `font-family:${p.headerFont};font-size:28px;line-height:1.22;color:${p.textPrimary};padding-bottom:12px;`)}">A headline worth the picture</td></tr>
  <tr><td style="${cell(p, `font-size:16px;line-height:1.7;color:${p.textBody};padding-bottom:20px;`)}">Two sentences under it. What this is, and why someone should care before they decide whether to read on.</td></tr>
  <tr><td><a href="https://example.org" style="background-color:${p.accent};color:${onAccentFor(p)};font-family:${p.headerFont};font-size:14px;letter-spacing:0.06em;padding:13px 26px;text-decoration:none;display:inline-block;">Read more</a></td></tr>
</table>`,
  },

  {
    id: 'eac-post-list',
    label: 'Article list',
    hint: 'Dated pieces with a line each. The shape of a blog index.',
    content: (p) => {
      const row = (last = false) => `
  <tr><td style="padding:16px 0;${last ? '' : `border-bottom:1px solid ${p.boxBorder};`}">
    <div style="${cell(p, `font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:${p.textMuted};padding-bottom:6px;`)}">18 Feb 2026 &middot; Category</div>
    <div style="${cell(p, `font-family:${p.headerFont};font-size:18px;line-height:1.3;padding-bottom:6px;`)}"><a href="https://example.org" style="color:${p.textPrimary};text-decoration:none;">The title of the piece</a></div>
    <div style="${cell(p, `font-size:14px;line-height:1.6;color:${p.textBody};`)}">One or two lines that say what it is about, so a reader can choose.</div>
  </td></tr>`;
      return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
  <tr><td style="${cell(p, `font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${p.textMuted};border-bottom:1px solid ${p.accent};padding-bottom:7px;`)}">Recently</td></tr>
  ${row()}${row()}${row(true)}
</table>`;
    },
  },

  {
    id: 'eac-story-numbered',
    label: 'Numbered stories',
    hint: 'A counted digest — three things, each with where it came from.',
    content: (p) => {
      const row = (n: string, last = false) => `
  <tr><td style="padding:16px 0;${last ? '' : `border-bottom:1px solid ${p.boxBorder};`}">
    <div style="${cell(p, `font-family:ui-monospace,Menlo,monospace;font-size:11px;letter-spacing:0.1em;color:${p.accent};padding-bottom:6px;`)}">${n} &middot; topic</div>
    <div style="${cell(p, `font-family:${p.headerFont};font-size:17px;line-height:1.35;padding-bottom:6px;`)}"><a href="https://example.org" style="color:${p.textPrimary};text-decoration:none;">What happened, said plainly</a></div>
    <div style="${cell(p, `font-size:14px;line-height:1.6;color:${p.textBody};padding-bottom:8px;`)}">A couple of lines on why it matters, in your own words rather than the source's.</div>
    <div style="${cell(p, `font-size:12px;color:${p.textMuted};`)}">Where it came from &middot; 11 min</div>
  </td></tr>`;
      return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
  <tr><td style="${cell(p, `font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${p.textMuted};border-bottom:1px solid ${p.accent};padding-bottom:7px;`)}">Three things</td></tr>
  ${row('01')}${row('02')}${row('03', true)}
</table>`;
    },
  },

  {
    id: 'eac-essay',
    label: 'Essay',
    hint: 'One long piece with a byline — the letter that is mostly writing.',
    content: (p) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 30px;">
  <tr><td style="${cell(p, `font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${p.accent};padding-bottom:10px;`)}">The essay</td></tr>
  <tr><td style="${cell(p, `font-family:${p.headerFont};font-size:27px;line-height:1.22;color:${p.textPrimary};padding-bottom:10px;`)}">The thing you actually wanted to say</td></tr>
  <tr><td style="${cell(p, `font-size:13px;color:${p.textMuted};padding-bottom:18px;`)}">By someone &middot; 7 min read</td></tr>
  <tr><td style="${cell(p, `font-size:16px;line-height:1.75;color:${p.textBody};padding-bottom:14px;`)}">The first paragraph carries the weight. Say the thing, then explain it &mdash; a letter is not an article and nobody scrolled here for a warm-up.</td></tr>
  <tr><td style="${cell(p, `font-size:16px;line-height:1.75;color:${p.textBody};padding-bottom:18px;`)}">The second paragraph earns the first. Keep going for as long as it is still true and stop when it is not.</td></tr>
  <tr><td><a href="https://example.org" style="${cell(p, `color:${p.accent};font-size:15px;text-decoration:underline;`)}">Continue reading &rarr;</a></td></tr>
</table>`,
  },

  {
    id: 'eac-reads',
    label: 'Worth your time',
    hint: 'Links with a line each on why. Better than a bare list of titles.',
    content: (p) => {
      const row = (last = false) => `
  <tr><td style="padding:13px 0;${last ? '' : `border-bottom:1px solid ${p.boxBorder};`}">
    <div style="${cell(p, `font-size:15px;line-height:1.45;padding-bottom:4px;`)}"><a href="https://example.org" style="color:${p.textPrimary};text-decoration:none;">The title of the thing</a></div>
    <div style="${cell(p, `font-size:13px;line-height:1.55;color:${p.textMuted};`)}">One line on why it is worth the click.</div>
  </td></tr>`;
      return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${p.boxBg};border:1px solid ${p.boxBorder};margin:0 0 28px;">
  <tr><td style="padding:16px 20px;">
    <div style="${cell(p, `font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${p.textMuted};padding-bottom:2px;`)}">Worth your time</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${row()}${row()}${row(true)}</table>
  </td></tr>
</table>`;
    },
  },

  {
    id: 'eac-lineitems',
    label: 'Items & total',
    hint: 'What was ordered and what it came to. For receipts and invoices.',
    content: (p) => {
      const row = (last = false) => `
  <tr>
    <td style="${cell(p, `font-size:15px;line-height:1.4;color:${p.textPrimary};padding:12px 0;${last ? '' : `border-bottom:1px solid ${p.boxBorder};`}`)}">
      An item<br><span style="font-size:13px;color:${p.textMuted};">Variant &middot; Qty 1</span>
    </td>
    <td align="right" valign="top" style="${cell(p, `font-size:15px;color:${p.textPrimary};padding:12px 0;${last ? '' : `border-bottom:1px solid ${p.boxBorder};`}`)}">$0.00</td>
  </tr>`;
      return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 26px;">
  <tr>
    <td style="${cell(p, `font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${p.textMuted};border-bottom:1px solid ${p.accent};padding-bottom:7px;`)}">Items</td>
    <td align="right" style="${cell(p, `font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${p.textMuted};border-bottom:1px solid ${p.accent};padding-bottom:7px;`)}">Price</td>
  </tr>
  ${row()}${row(true)}
  <tr>
    <td style="${cell(p, `font-family:${p.headerFont};font-size:16px;color:${p.textPrimary};padding:14px 0 0;`)}">Total</td>
    <td align="right" style="${cell(p, `font-family:${p.headerFont};font-size:16px;color:${p.textPrimary};padding:14px 0 0;`)}">$0.00</td>
  </tr>
</table>`;
    },
  },

  {
    id: 'eac-order-meta',
    label: 'Reference line',
    hint: 'An order or booking number, when it was placed, and how to follow it.',
    content: (p) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${p.boxBg};border:1px solid ${p.boxBorder};margin:0 0 26px;">
  <tr><td style="padding:16px 20px;">
    <div style="${cell(p, `font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${p.textMuted};padding-bottom:5px;`)}">Reference</div>
    <div style="${cell(p, `font-family:ui-monospace,Menlo,monospace;font-size:17px;color:${p.textPrimary};padding-bottom:3px;`)}">#0000-0000</div>
    <div style="${cell(p, `font-size:13px;color:${p.textMuted};padding-bottom:14px;`)}">placed 14 March 2026</div>
    <a href="https://example.org" style="background-color:${p.accent};color:${onAccentFor(p)};font-family:${p.headerFont};font-size:13px;letter-spacing:0.05em;padding:10px 20px;text-decoration:none;display:inline-block;">Track it</a>
  </td></tr>
</table>`,
  },

  {
    id: 'eac-datemark',
    label: 'When it is',
    hint: 'A date big enough to read at a glance. For one gathering.',
    content: (p) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${p.accent};margin:0 0 26px;">
  <tr>
    <td width="118" align="center" valign="middle" style="padding:20px 0;border-right:1px solid ${p.boxBorder};">
      <div style="${cell(p, `font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:${p.accent};`)}">March</div>
      <div style="${cell(p, `font-family:${p.headerFont};font-size:42px;line-height:1.05;color:${p.textPrimary};`)}">22</div>
      <div style="${cell(p, `font-size:12px;color:${p.textMuted};`)}">2026</div>
    </td>
    <td valign="middle" style="padding:20px;">
      <div style="${cell(p, `font-size:15px;color:${p.textPrimary};padding-bottom:4px;`)}">11:00 a.m. &middot; 90 minutes</div>
      <div style="${cell(p, `font-size:14px;color:${p.textMuted};`)}">Where it happens, and whether there is a room online</div>
    </td>
  </tr>
</table>`,
  },

  {
    id: 'eac-calendar-links',
    label: 'Add to calendar',
    hint: 'The three links that put it in someone’s diary.',
    content: (p) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 26px;">
  <tr><td style="${cell(p, `font-size:13px;color:${p.textMuted};`)}">
    <a href="https://example.org" style="color:${p.accent};text-decoration:none;">+ Google</a> &nbsp;&middot;&nbsp;
    <a href="https://example.org" style="color:${p.accent};text-decoration:none;">+ Apple</a> &nbsp;&middot;&nbsp;
    <a href="https://example.org" style="color:${p.accent};text-decoration:none;">+ Outlook</a>
  </td></tr>
</table>`,
  },

  {
    id: 'eac-people',
    label: 'People',
    hint: 'Who is involved — portrait, name, what they do. Stacks on a phone.',
    content: (p) => {
      const one = `
        <img src="https://elkdonis-arts.org/email/avatar-placeholder.png" alt="" width="64" style="display:block;width:64px;max-width:100%;height:auto;border-radius:32px;border:0;" />
        <div style="${cell(p, `font-family:${p.headerFont};font-size:16px;color:${p.textPrimary};padding:10px 0 2px;`)}">Their name</div>
        <div style="${cell(p, `font-size:13px;line-height:1.5;color:${p.textMuted};padding-bottom:14px;`)}">What they do, in a few words</div>`;
      return stackRow([one, one, one], { max: 170, min: 140 });
    },
  },

  {
    id: 'eac-security-note',
    label: 'Expiry note',
    hint: 'How long a link is good for, and what to do when it is not.',
    content: (p) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
  <tr><td style="${cell(p, `font-size:14px;line-height:1.65;color:${p.textMuted};`)}">
    This link expires in <span style="color:${p.textPrimary};">1 hour</span>. If it does, you can
    <a href="https://example.org" style="color:${p.accent};">ask for a new one</a>. If you did not
    request this, nothing has changed and you can ignore this letter.
  </td></tr>
</table>`,
  },

  {
    id: 'eac-raw-link',
    label: 'Link, written out',
    hint: 'The URL in full, for a client that eats buttons. Worth having on anything that must be clicked.',
    content: (p) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
  <tr><td style="${cell(p, `font-size:13px;color:${p.textMuted};padding-bottom:6px;`)}">Or paste this into your browser:</td></tr>
  <tr><td style="${cell(p, `font-family:ui-monospace,Menlo,monospace;font-size:12px;line-height:1.5;color:${p.textBody};background:${p.boxBg};border:1px solid ${p.boxBorder};padding:10px 12px;word-break:break-all;`)}">https://example.org/a/very/long/link?token=0000</td></tr>
</table>`,
  },

  {
    id: 'eac-media-text',
    label: 'Picture and words',
    hint: 'An image beside a paragraph. Stacks on a phone.',
    content: (p) => {
      const pic = `<img src="https://elkdonis-arts.org/email/placeholder.png" alt="" width="250" style="display:block;width:100%;max-width:100%;height:auto;border:0;" />`;
      const words = `
        <div style="${cell(p, `font-family:${p.headerFont};font-size:18px;line-height:1.3;color:${p.textPrimary};padding-bottom:8px;`)}">A heading</div>
        <div style="${cell(p, `font-size:15px;line-height:1.7;color:${p.textBody};padding-bottom:10px;`)}">The paragraph that goes with the picture.</div>
        <a href="https://example.org" style="${cell(p, `color:${p.accent};font-size:14px;text-decoration:underline;`)}">Read more</a>`;
      return stackRow([pic, words], { max: 250, min: 200 });
    },
  },

  {
    id: 'eac-postal-footer',
    label: 'Postal footer',
    hint: 'Address, unsubscribe, preferences. Bulk mail is required by law to carry an address.',
    content: (p) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:30px 0 0;">
  <tr><td style="border-top:1px solid ${p.boxBorder};font-size:0;line-height:0;padding-bottom:18px;">&nbsp;</td></tr>
  <tr><td style="${cell(p, `font-size:12px;line-height:1.65;color:${p.textMuted};padding-bottom:8px;`)}">
    Your Organisation &middot; 000 Street Name &middot; City, Province, Country
  </td></tr>
  <tr><td style="${cell(p, `font-size:12px;line-height:1.65;color:${p.textMuted};`)}">
    You are receiving this because you signed up.
    <a href="https://example.org" style="color:${p.textMuted};">Unsubscribe</a> &middot;
    <a href="https://example.org" style="color:${p.textMuted};">Email preferences</a>
  </td></tr>
</table>`,
  },

  {
    id: 'eac-detail-box',
    label: 'Detail box',
    hint: 'An inset panel — a time, a username, anything that must not be missed.',
    content: (p) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${p.boxBg};border:1px solid ${p.gold};margin:22px 0;">
  <tr><td align="center" style="padding:20px;">
    <div style="${cell(p, `font-size:22px;line-height:1.25;color:${p.textPrimary};`)}">Begins in 3 hours</div>
    <div style="${cell(p, `font-size:14px;color:${p.textMuted};padding-top:8px;`)}">Saturday, 3 October, 7:00 p.m. EDT</div>
  </td></tr>
</table>`,
  },

  {
    id: 'eac-button',
    label: 'Button',
    hint: 'The one action the letter is asking for.',
    content: (p) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:30px 0 8px;">
  <tr><td align="center">
    <a href="https://example.org" style="background-color:${p.accent};color:${onAccentFor(p)};font-family:${p.headerFont};font-size:14px;text-transform:uppercase;letter-spacing:0.1em;padding:14px 30px;text-decoration:none;display:inline-block;">
      Confirm your email
    </a>
  </td></tr>
</table>`,
  },

  {
    id: 'eac-link-list',
    label: 'Link list',
    hint: 'Secondary links, stacked so they stay tappable on a phone.',
    content: (p) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:14px 0;">
  <tr><td style="${cell(p, 'padding:0 0 6px;')}"><a href="https://arts-collective.com" style="color:${p.accent};font-size:14px;">View the full network</a></td></tr>
  <tr><td style="${cell(p, 'padding:0 0 6px;')}"><a href="https://elkdonis-arts.org" style="color:${p.accent};font-size:14px;">Investigate Elkdonis Arts</a></td></tr>
</table>`,
  },

  {
    id: 'eac-divider',
    label: 'Divider',
    hint: 'A hairline between sections.',
    content: (p) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:30px 0 26px;">
  <tr><td style="border-top:1px solid ${p.boxBorder};font-size:0;line-height:0;">&nbsp;</td></tr>
</table>`,
  },

  {
    id: 'eac-image',
    label: 'Image',
    hint: 'Full-width, with a caption. Always give it alt text.',
    content: (p) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0;">
  <tr><td>
    <img src="https://elkdonis-arts.org/email/placeholder.png" alt="" width="520" style="display:block;width:100%;max-width:100%;height:auto;" />
  </td></tr>
  <tr><td style="${cell(p, `font-size:12px;color:${p.textMuted};padding-top:6px;`)}">What this picture is.</td></tr>
</table>`,
  },

  {
    id: 'eac-two-column',
    label: 'Two columns',
    hint: 'Side by side on a screen, one above the other on a phone.',
    content: (p) => {
      const body = `font-family:${p.bodyFont};font-size:15px;line-height:1.75;color:${p.textBody};padding-bottom:14px;`;
      // 2 x 250 = 500, inside 520. Below ~500 only one fits per line.
      return stackRow(
        [`<div style="${body}">Left.</div>`, `<div style="${body}">Right.</div>`],
        { max: 250, min: 200 }
      );
    },
  },

  {
    id: 'eac-footer-note',
    label: 'Footer note',
    hint: 'Why this email arrived. Every letter owes the reader this.',
    content: (p) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 0;">
  <tr><td style="border-top:1px solid ${p.boxBorder};font-size:0;line-height:0;padding-bottom:20px;">&nbsp;</td></tr>
  <tr><td style="${cell(p, `font-size:12px;line-height:1.6;color:${p.textMuted};`)}">
    You are receiving this because you signed up with this organization on the
    Elkdonis Arts Collective.
  </td></tr>
</table>`,
  },

  {
    id: 'eac-nfp-note',
    label: 'Not-for-profit note',
    hint: 'The standing line about what this project is.',
    content: (p) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:14px 0 0;">
  <tr><td style="${cell(p, `font-size:12px;line-height:1.6;color:${p.textMuted};`)}">
    Elkdonis Arts is a not-for-profit and a collective exercise in providing
    open resources. We’re continuing to grow what we offer — thank you for your
    patience and interest in our work.
  </td></tr>
</table>`,
  },
];

/**
 * Register the library on a GrapesJS editor.
 *
 * Typed structurally rather than against GrapesJS's own types: this module is
 * imported by the server-side template resolver too, and pulling the editor's
 * types in would drag `document` into a Node build.
 */
export function registerEacEmailBlocks(
  editor: {
    BlockManager: {
      add: (id: string, def: Record<string, unknown>) => unknown;
    };
  },
  palette: BlockPalette = DARK_BLOCK_PALETTE,
  mode: BlockMode = 'newsletter'
): void {
  for (const block of BLOCKS) {
    if (block.only && !block.only.includes(mode)) continue;
    editor.BlockManager.add(block.id, {
      label: block.label,
      category: EAC_CATEGORY,
      attributes: { title: block.hint },
      content: block.content(palette, mode).trim(),
    });
  }
}

/**
 * The raw definitions, for the check script.
 *
 * Exported rather than re-derived so the checks run against exactly what the
 * editor registers — a second list would be a second thing to keep true.
 */
export const BLOCKS_FOR_CHECK: ReadonlyArray<{
  id: string;
  only?: BlockMode[];
  content: (p: BlockPalette, mode: BlockMode) => string;
}> = BLOCKS;

/** The ids, for a caller that wants to reorder or hide some. */
export const EAC_BLOCK_IDS = BLOCKS.map((b) => b.id);
