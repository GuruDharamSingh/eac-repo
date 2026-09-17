// ============================================================================
// The network's own words.
//
// Every default sentence the network puts in an organisation's mail lives
// HERE, as data, in one file. Not scattered through nine templates as JSX
// string literals, because this is the copy that gets revised — and revising
// it should be an edit to a paragraph, not a hunt through components.
//
// Three layers resolve on top of each other at send time:
//
//   1. this file            the network default, always present
//   2. email_template_settings.config.bodyText/links/media
//                           an org's own words, typed into a form
//   3. email_template_settings.config.html
//                           an org's own layout, composed in the newsletter
//                           editor — replaces the body entirely
//
// A template renders layer 1 unless a later layer overrides it, so an org that
// has never touched its settings still sends something the network stands
// behind.
// ============================================================================

/** Paragraphs, not a blob: templates render each as its own <Text>. */
export type Paragraphs = readonly string[];

// ── The network letter ──────────────────────────────────────────────────────

/**
 * What the Elkdonis Arts Collective is, in its own voice.
 *
 * Sent once, on the account's first signup, beneath the organisation-specific
 * confirmation. Long on purpose: this is the only moment someone is reliably
 * reading, and the project asks something of them rather than selling to them.
 */
export const NETWORK_MANIFESTO: Paragraphs = [
  'Elkdonis Arts Collective is pursuing a project based on what an art collective is. We hope you bring yourself to whatever organization brought you here, and that in time you are inspired to share your impressions of our work.',

  'Fundamentally we believe in putting the artist first and staying true to a not-for-profit ideal, while supplying a medium — a structure — where greater effort can be gathered by connecting groups within a group of groups. This platform is an ongoing offering of a Fourth Way study group, and we hope that in the spirit of Elkdonis it raises up more prayer for the objective.',

  'Transparency. Dialogue. Keeping your word. Consistency. Accountability. And creating a bridge between classes. These are our values.',
];

/** What signing up actually gets you. Concrete, because the rest is not. */
export const NETWORK_RESOURCES: Paragraphs = [
  'Signing up gives you access to resources of the organization, provided by the server this platform runs on. You may be connected to Nextcloud — a suite of software including cloud storage and instant messaging. We also offer email support, and tools like Excalidraw, a very useful whiteboard program.',

  'This project really becomes alive when opportunities are being created: because people are exposed to more art, are able to sell art, are able to organize weekly meetings through these web tools. Helping set up servers for families or neighbourhoods is within our aims.',

  'Really, we are not doing anything exciting or new. It is as cliché and as kitsch as saying we are creating a new social network. The real difference is that it is particular artists making it, and the people joining are meeting them with some shared ideals. Honestly, anyone can take this idea and duplicate it somewhere else — you simply form a band of people, or a song, or an album, or a hockey team. There is nothing special to what we are doing other than who we are and who wants to be around us.',

  'And to that aim, Elkdonis Arts Collective will continue to make accessible the sort of inner work, spiritual practice, objective art studies and higher obligations that we feel will support the people magnetized to who we are as a study group putting on this project.',
];

// ── Per-email openings ──────────────────────────────────────────────────────

/** Signup confirmation. `{org}` is substituted with the organisation's name. */
export const SIGNUP_CONFIRM: Paragraphs = [
  'With Elkdonis we appreciate you opening this confirmation email; you have indeed created an account with {org}.',
];

/**
 * The network framing that follows the confirmation, whatever the org.
 *
 * Two short lines rather than one long one: the first is the thing the reader
 * actually wanted to know, and the second is context. Run together, the
 * membership got buried inside a subordinate clause about the network.
 */
export const SIGNUP_NETWORK_NOTE: Paragraphs = [
  'You are now a member of {org}!',
  'You are actually also participating in a larger network of ‘Elkdonis’ Arts Collectives.',
];

/** Shown when the account was created by buying or reserving a place. */
export const SIGNUP_BY_PURCHASE: Paragraphs = [
  'This means that you can access all of the materials of the organization or event you have joined.',
];

/** Nextcloud provisioning, once the address is confirmed. */
export const PROVISIONING: Paragraphs = [
  'You can now claim your Nextcloud account and cloud storage, as well as access to {org}’s team folder. Please take the time to click this link to finalize the provisioning.',
];

/** The day-before reminder. `{thread}`, `{org}` and `{when}` are substituted. */
export const REMINDER_INTRO: Paragraphs = [
  'This email is sent as a reminder about {thread}, which you expressed interest in.',
];

/**
 * The reminder's closing line.
 *
 * TODO — the dictated source for this sentence was garbled ("This is part of
 * this organization murder on those…") and nothing has been invented in its
 * place. This is the minimum true statement; replace it with the intended line.
 */
export const REMINDER_ORG_NOTE: Paragraphs = [
  'This is part of {org}.',
];

/** Offered wherever someone has just committed to attending something. */
export const REMINDER_OPTIONS_NOTE =
  'An email reminder will be sent the day before. You can opt out of the reminder, or change when it reaches you.';

// ── Substitution ────────────────────────────────────────────────────────────

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

/** Split an org's free-typed override into paragraphs the way templates want. */
export function paragraphsOf(value: string | undefined): string[] {
  return (value ?? '')
    .split(/\n{2,}|\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}
