// ============================================================================
// The catalogue: every registry entry an author can name, as plain data.
// Client-safe and dependency-free, so Sophia's studio can list it without
// pulling services or the database into its bundle.
//
// The first sixteen are the getting-started course's tasks, moved from
// packages/services/src/onboarding-tasks.ts on 2026-11-06 with their ids
// unchanged (published course versions store them).
// ============================================================================
import type { ActionMeta } from './types';
import { HUB_ACTIONS } from './hub';

const d = (id: string, label: string, describe: string, scope: ActionMeta['scope'], area: ActionMeta['area'], runnable = false, derived = true): ActionMeta => ({
  id, label, describe, scope, area, derived, runnable,
});

export const ACTION_CATALOGUE: readonly ActionMeta[] = [
  d('profile', 'Your profile', 'A name, a photo and one line about what you do.', 'person', 'profile', true),
  d('gain-space', 'Take your space', 'A folder of your own, membership of the artist directory and a listing. One button.', 'person', 'directory', true),
  d('listing', 'Your page in the directory', 'A page address and the switch that lists it on ArtDirect.', 'person', 'directory', true),
  d('studio', 'A published piece of writing', 'Write in the Studio and publish one piece.', 'person', 'writing'),
  d('show-on', 'Shown on another site', 'A published piece listed on a site besides the author’s own.', 'person', 'writing'),
  d('cloud', 'Cloud sign-in linked', 'Sign in to the collective’s Nextcloud once, so the folders follow the person.', 'person', 'cloud'),
  d('service', 'A service offered', 'A published service (lesson, commission, reading…) on the person’s page.', 'person', 'market'),
  d('store', 'A store on the market', 'The person’s own store on the collective’s market.', 'person', 'market', true),
  d('artwork', 'A work on the market', 'One artwork with a photo, a title and a price, published.', 'person', 'market'),
  d('payouts', 'Payouts set up', 'A Stripe account that sales and bookings are paid into.', 'person', 'payments'),
  d('org', 'An organisation of one’s own', 'A collective with a name and an address on the network.', 'person', 'org', true),
  d('org-details', 'Organisation details', 'A line, a description and an image for the organisation.', 'org', 'org', true),
  d('org-offering', 'Something leading the org site', 'A published public post, event or service on the organisation’s site.', 'org', 'content'),
  d('org-people', 'People in the organisation', 'At least one other member, guide or owner.', 'org', 'org'),
  d('org-email', 'Mail from the organisation', 'A sending name and a reply-to address for the organisation’s mail.', 'org', 'email', true),
  d('org-site', 'The org site is live', 'The collective has confirmed the address. Nothing for the person to press.', 'org', 'org'),

  // Content (CMS) entries, 2026-11-06: performed by the org's compose surface; the runner
  // (registry pass, same day) saves a draft post only, so publishing stays with a person.
  {
    ...d('org-publish', 'Publish on the org site', 'One published piece of a chosen kind on the organisation’s site: a post, an event or a meeting.', 'org', 'content', true),
    performs: 'Saves a draft post (title and plain text) on the organisation’s site. Publishing, events and meetings stay with the composer.',
    params: [{
      name: 'kind',
      label: 'Which kind',
      default: 'article',
      options: [
        // `article` is the compose option id; the picker calls it Post (threads.kind 'post').
        { value: 'article', label: 'A post' },
        { value: 'event', label: 'An event' },
        { value: 'meeting', label: 'A meeting' },
      ],
    }],
  },

  // Post entries (scope 'thread', 2026-11-06): act on one existing post (threads.kind
  // 'post'), named by its id as the call's subject. The org is the post's own. Changes
  // visitors see at once (publish, pin, editing a published post) go through a host's
  // own door ('app') only; other doors (HTTP, later agents) work on drafts.
  {
    ...d('thread-edit', 'Edit a post', 'Change a post’s title or text. A published post is edited from the site itself.', 'thread', 'content', true, false),
    performs: 'Replaces the title and/or text of one post (plain text or HTML, sanitised). Drafts from any door; a published post only from the host’s own pages.',
  },
  {
    ...d('thread-publish', 'Publish a draft post', 'Put a draft post on the organisation’s site.', 'thread', 'content', true),
    performs: 'Publishes one draft post. Only from the host’s own pages, where a person presses it.',
  },
  {
    ...d('thread-pin', 'Lead the site with a post', 'Pin a published public post so it leads the organisation’s site (one at a time).', 'thread', 'content', true),
    performs: 'Pins or unpins one published public post; pinning unpins the org’s other posts. Only from the host’s own pages.',
  },
  // The Akhand Path's day (2026-11-06; docs/open/DAILY_ROUTINE_BRIEF_2026-11-06.md §3.2), for a
  // daily routine course. Each reads one day: the status context's `day`, else today in the
  // reading's zone. Readers only; others see "not one of its readers".
  d('paath-read', 'Read today’s passages', 'Mark the day’s passages of the Akhand Path read.', 'person', 'content'),
  d('paath-record', 'Record the reading', 'A recording of the day’s reading, from the page or the call.', 'person', 'content'),
  d('paath-note', 'Write the day’s note', 'A note or a stop point for the day.', 'person', 'content'),
  d('paath-publish', 'Send the recording', 'The day’s recording approved and on YouTube.', 'person', 'content'),

  // Channel entries (scope 'channel', 2026-11-07; docs/open/CHANNEL_REGISTRY_AND_BOARD_2026-11-07.md).
  // The board's moves as entries: what Channel Home's next row, the dock and the HTTP door
  // run. Every runner writes plans only (a draft delivery, a plan step, a dismissed gap);
  // scheduling and sending stay with the quick sheet and New post. The org is the call's
  // claim (owners and guides, never oad); without one, the person's own channel.
  // Channel setup (2026-11-07): status-only steps a course can name ("Your channel"),
  // done from platform state. The work happens in Channel's Outlets and New post.
  d('channel-connect', 'A social account connected', 'Instagram, Facebook or Threads connected to the person’s own account, from Channel’s Outlets.', 'person', 'channel'),
  d('channel-org-channel', 'The organisation has a channel', 'A Page or account set as the organisation’s own channel, so posts can go out under its name.', 'org', 'channel'),
  d('channel-first-post', 'A first post sent', 'One post sent from Channel or the Studio to Instagram, Facebook or Threads.', 'person', 'channel'),
  {
    ...d('channel-next', 'What is next in the channel', 'The top next moves on a channel’s board: open slots, placed suggestions, gaps, drafts, plan steps and to-dos.', 'channel', 'channel'),
    performs: 'Reads only. Done when nothing is waiting; otherwise the status lists the moves, each with the entry that performs it.',
  },
  {
    ...d('channel-suggestion-accept', 'Accept a suggestion', 'Put a suggested post for a piece on the queue and in its plan.', 'channel', 'channel', true, false),
    performs: 'Writes a draft delivery placed where the suggestion was (a routine slot or a date) and a step tagged “from the board” in the piece’s plan.md. Nothing is scheduled or sent. Accepting twice writes nothing the second time.',
  },
  {
    ...d('channel-suggestion-dismiss', 'Dismiss a suggestion', 'Stop suggesting an outlet for a piece.', 'channel', 'channel', true, false),
    performs: 'Records the gap as dismissed so it stops suggesting itself. Only from the host’s own pages, where the person sees what goes.',
  },
  {
    ...d('channel-slot-fill', 'Fill a routine slot', 'Place a draft post about a piece in one of a routine’s slots.', 'channel', 'channel', true, false),
    performs: 'Writes a draft delivery in the named slot of a routine the person runs (its outlet, time and name) and a step in the piece’s plan.md. Refuses a slot that is filled, past, or not one of the routine’s. Nothing is scheduled or sent.',
  },
  {
    ...d('channel-plan-step', 'Add or tick a plan step', 'Append a step to a piece’s plan.md, or tick or untick one.', 'channel', 'channel', true, false),
    performs: 'Appends a step to plan.md, or ticks or unticks the step at an index whose text matches what the caller read (a step added since is refused, not mis-ticked). Recorded in the plan’s event log with the actor kind.',
  },
  // Hub card entries (2026-11-08), kept in ./hub.ts.
  ...HUB_ACTIONS,
];

/** The entries a course step can name: person and org entries (`CourseActionScope`). */
export const COURSE_ACTIONS = ACTION_CATALOGUE.filter((m) => (m.scope === 'person' || m.scope === 'org') && !m.appOnly) as ReadonlyArray<ActionMeta & { scope: import('./types').CourseActionScope }>;

const BY_ID = new Map(ACTION_CATALOGUE.map((m) => [m.id, m]));

/** The entry for an id, or null when this installation does not know it. */
export function actionMeta(id: string): ActionMeta | null {
  return BY_ID.get(id) ?? null;
}

export const ACTION_IDS: readonly string[] = ACTION_CATALOGUE.map((m) => m.id);

/**
 * The step's params for an entry, restricted to the entry's declared names and
 * options, with defaults filled in. Anything else a step stored is dropped.
 */
export function actionParams(id: string, raw: Record<string, unknown> | undefined | null): Record<string, string> {
  const meta = actionMeta(id);
  if (!meta?.params) return {};
  const out: Record<string, string> = {};
  for (const p of meta.params) {
    const v = raw?.[p.name];
    out[p.name] = typeof v === 'string' && p.options.some((o) => o.value === v) ? v : p.default;
  }
  return out;
}
