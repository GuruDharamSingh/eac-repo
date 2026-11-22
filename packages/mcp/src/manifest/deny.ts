/**
 * Which blocks an assistant may NOT read or change (policy of 2026-11-20, Justin: "unblock pages from sites").
 *
 * Before: an assistant saw shared blocks marked `memberSafe` and nothing else, so almost every real page, built from a
 * site's own blocks, read as placeholders and every proposal was refused. Now the rule is the other way round: a block is
 * readable (and a step may be aimed at it) unless this module names it. Most sites hold no important live data and are not
 * launched, so openness is the better default; what stays closed is what could carry a secret, a private address, a
 * person, or free markup. This is the ONLY place that decides; the manifest builder asks it for every block, and the tools
 * read the result (`agent.read`). It is pure: no database, no React.
 *
 * Two parts, both applied:
 *  (a) by id: `contact-form` (a form that sends to an address the owner set) is closed whatever its declaration says.
 *      `box` and the canvas/box blocks are NOT closed: their declared settings are slots and a tag (no CSS or HTML field;
 *      their look lives under `morph`, which only the look door writes), so there is nothing in them to protect.
 *  (b) by declaration, from what the block says it holds:
 *      - a setting whose name or label has one of the words email, recipient, token, key, secret, webhook, password, api
 *        (whole words: "capital" is not "api"; "emailLabel" is "email label");
 *      - a setting bound to a person or a private record (`binds` person, user or guide);
 *      - a setting that is raw markup or script (named html, css, script, embed, iframe, markup);
 *      - no declaration: the manifest knows no settings for the block, so nobody could say what it holds.
 *      - a setting the manifest could not resolve (kind "unresolved"): the declaration is incomplete, so fail closed.
 *    Everything else, app-local blocks included, is readable.
 *
 * Fencing and the org lock are unchanged: every value an assistant reads is still stripped, capped and listed under
 * `untrusted`, and a tool still reads only pages of the org the key settles to.
 */

export interface DenyBlock {
  id: string;
  settings: ReadonlyArray<{ name: string; label?: string; kind?: string; binds?: string }>;
}

export type DenyCode = 'id' | 'secret' | 'person' | 'markup' | 'no-declaration' | 'unresolved';

export interface DenyReason {
  code: DenyCode;
  /** Plain words, shown as `agent.why`. Names no setting value. */
  why: string;
}

/** (a) closed by id. */
export const DENY_IDS: readonly string[] = ['contact-form'];

const SECRET_WORDS = new Set(['email', 'emails', 'recipient', 'recipients', 'token', 'tokens', 'key', 'keys', 'secret', 'secrets', 'webhook', 'webhooks', 'password', 'passwords', 'api', 'apis']);
/** `binds` kinds that name a person or a private record. */
const PRIVATE_BINDS = new Set(['person', 'user', 'guide']);
const MARKUP_WORDS = new Set(['html', 'css', 'script', 'scripts', 'embed', 'iframe', 'markup']);

/** "emailLabel" and "Email field" to ["email", "label"] and ["email", "field"]. */
const words = (s: string): string[] =>
  s
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

export function denyReason(b: DenyBlock): DenyReason | null {
  if (DENY_IDS.includes(b.id)) return { code: 'id', why: 'A form that sends to an address its owner set. Assistants do not see it.' };
  if (b.settings.length === 0) return { code: 'no-declaration', why: 'Its settings are not declared anywhere assistants can read, so what it holds is unknown. Assistants do not see it.' };
  // A setting the scan could not resolve (a spread it could not expand): other settings may be missing from the manifest, so fail closed.
  if (b.settings.some((s) => s.kind === 'unresolved' || s.name === '?')) return { code: 'unresolved', why: 'Part of its settings could not be read, so what it holds is unknown. Assistants do not see it.' };
  for (const s of b.settings) {
    const w = [...words(s.name), ...words(s.label ?? '')];
    if (w.some((x) => SECRET_WORDS.has(x))) return { code: 'secret', why: 'It has a setting that may hold a secret or a private address. Assistants do not see it.' };
    if (s.binds && PRIVATE_BINDS.has(s.binds)) return { code: 'person', why: 'It shows a person or a private record. Assistants do not see it.' };
    if (words(s.name).some((x) => MARKUP_WORDS.has(x))) return { code: 'markup', why: 'It has a setting that takes raw markup or code. Assistants do not see it.' };
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------------------------
// The second, narrower list (review of wave 2, 2026-11-21): settings an assistant may READ but may not SET.
//
// A block that is readable can still hold a switch that decides who may see or join something. A draft that flips one
// is reviewed by a person, but a switch that quietly opens a members-only room is the kind of change that should never
// arrive as a proposal. These are refused by `propose_page_patch` and `set_field` with a plain reason; `read_page` still
// shows them. Two parts:
//  (a) by block and setting name, for switches the name rule would miss (found by reading the whole manifest);
//  (b) a name rule for boolean or select settings whose name has a privacy or access word.
// Found in the manifest today: pt-talk-room.membersOnly, pt-event-rsvp.showAttendees (both named in the review),
// pt-offering-card.showCall (who gets the call button). Other "show..." switches are presentation, not access, and stay open.
// ---------------------------------------------------------------------------------------------------------------------

/** (a) block id to setting names. */
export const READ_ONLY_SETTINGS: Readonly<Record<string, readonly string[]>> = {
  'pt-talk-room': ['membersOnly'],
  'pt-event-rsvp': ['showAttendees'],
  'pt-offering-card': ['showCall'],
  // Who sees a button or a menu item (2026-11-21, elktours): rows, so the door cannot set them today (rows are an unsupported kind); named so
  // that a row-aware door, which would address a column by name, still refuses them. A row setting is named whole and by column.
  'm-page-buttons': ['buttons', 'who', 'swapWho', 'swap2Who'],
  'm-phone-menu': ['items', 'who'],
  // Whether visitors who are not signed in may answer on the forum.
  'grand-forum': ['showAnswer'],
};

/** (b) whole words in a boolean or select setting's name. */
const ACCESS_WORDS = new Set(['members', 'private', 'public', 'visibility', 'visible', 'attendees', 'attendee', 'login', 'signin', 'auth', 'access', 'restricted', 'hidden', 'secret']);

export const READ_ONLY_WHY = 'This switch decides who can see or join something, so an assistant may read it but not change it. A person can change it in the editor.';

/** Why an assistant may not set this setting of this block, or null when it may. */
export function readOnlyReason(blockId: string, setting: { name: string; kind?: string }): string | null {
  if (Object.prototype.hasOwnProperty.call(READ_ONLY_SETTINGS, blockId) && READ_ONLY_SETTINGS[blockId]!.includes(setting.name)) return READ_ONLY_WHY;
  if ((setting.kind === 'boolean' || setting.kind === 'select') && words(setting.name).some((w) => ACCESS_WORDS.has(w))) return READ_ONLY_WHY;
  return null;
}
