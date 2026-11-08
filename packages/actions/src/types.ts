// ============================================================================
// The action registry's shared types. Client-safe: no database, no services.
//
// An entry names one thing a person (or an org's owner) can do or have on the
// platform — a profile, a store, an organisation, later a post of some kind or
// a designed page — independent of the page that happens to offer it. Each
// entry is split in two:
//   catalogue  (./catalogue)  id, label, scope — what an author picks from
//   present    (./present)    how a host shows it: a surface, a link, a button
//   server     (./server)     input schema, permission check, handler, status
// so a lesson, a dock or a checklist can name the entry by id alone.
// (claude, 2026-11-06; docs/open/LMS_ACTION_LAYER_BRIEF_2026-11-06.md)
// ============================================================================

/**
 * Whom an entry acts on. `person`: the signed-in person. `org`: an organisation
 * the person may manage (resolved by the host). `thread` (2026-11-06): one
 * existing post, named by the call's `subjectId`; its org is the post's own.
 * `channel` (2026-11-07): a Channel (arts-collective /channel). With no org it is
 * the person's own channel, which also carries the orgs they run; with an org
 * claim it is that org's channel, honoured only for its owners and guides and
 * never for `oad` (actionOrgId; a refused claim is refused, not widened).
 * Further subject scopes (`series`, `auction`, …) come with runbooks (brief §3.5).
 */
export type ActionScope = 'person' | 'org' | 'thread' | 'channel';

/**
 * The scopes a course step can name (`settings.task.scope`). A `thread` entry acts
 * on one existing post, which a step cannot name until runbooks supply a subject
 * (brief §5 phase 4); `COURSE_ACTIONS` leaves those out. `channel` entries are left
 * out too until `@elkdonis/lms` `stepTask` and lms-ui's picker know the scope (they
 * read only 'person' | 'org'; docs/open/CHANNEL_REGISTRY_AND_BOARD_2026-11-07.md).
 */
export type CourseActionScope = Exclude<ActionScope, 'thread' | 'channel'>;

/** Where an entry belongs, for grouping in the studio's picker. */
export type ActionArea = 'profile' | 'directory' | 'writing' | 'cloud' | 'market' | 'payments' | 'org' | 'content' | 'email' | 'channel';

/**
 * A choice the author makes for an entry in a course step, stored in
 * `settings.task.params`. Options are a closed list so the studio can offer
 * a select and the server can refuse anything else.
 */
export interface ActionParam {
  name: string;
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  /** Used when the step does not say. */
  default: string;
}

/** The author-facing description of an entry. Pure data. */
export interface ActionMeta {
  /**
   * Stable. Course steps store it (`settings.task.id`) in immutable published
   * versions, so an id is never renamed; retire it and add a new one instead.
   */
  id: string;
  label: string;
  /** One line for an author choosing it. */
  describe: string;
  scope: ActionScope;
  area: ActionArea;
  /** True when the server side can say whether it is done (a `status` check). */
  derived: boolean;
  /** True when the server side can perform it (a `run` handler) through `runAction`. */
  runnable: boolean;
  /**
   * What the runner does, when that is less than the label says (2026-11-06):
   * `org-publish`'s runner saves a draft and leaves publishing to the person.
   */
  performs?: string;
  /** Choices an author makes in the step. Absent = none. */
  params?: ReadonlyArray<ActionParam>;
  /**
   * Performed only through a host's own pages (`via` 'app'), never the HTTP
   * routes, the dock or an agent; and never a course step (2026-11-08, the hub
   * card entries: role changes, removals, welcomes).
   */
  appOnly?: boolean;
}

/** What the registry reports about an entry for one person. Same shape as @elkdonis/lms TaskStatus. */
export interface ActionStatus {
  done: boolean;
  /** Begun, not finished. */
  partial?: boolean;
  /** One line for the person: what is there now, or what is missing. */
  detail?: string | null;
  /** Where the finished thing lives (absolute, or a path on the hub host). */
  href?: string | null;
  /** Current values, for an entry presented as a form (prefills the fields). */
  values?: Record<string, string>;
  /**
   * What is waiting, most pressing first, for an entry whose status is a list
   * (2026-11-07: `channel-next`). Each item may name the entry that performs it.
   */
  next?: ActionNextItem[];
}

/**
 * One thing waiting for the person, as a status lists it. `run` is a registry
 * entry and its input, performed through the host's door (`runAction(run.id,
 * run.input, { org })`); `href` is where to finish it when the caller cannot
 * open it in place (a dock, an agent handing back a link).
 */
export interface ActionNextItem {
  /** Stable within one read: `<kind>:<…>`. */
  id: string;
  title: string;
  /** Why now: "Fills your Friday Instagram slot". */
  reason: string | null;
  /** When it is placed or due (ISO), if dated. */
  at: string | null;
  href: string | null;
  run: null | { id: string; input: Record<string, unknown>; label: string; busyLabel: string };
}

/** The result of performing an entry. Test `r.ok === false`: root tsconfig is not strict. */
/**
 * Why `performAction` refused, when the refusal is its own and not the entry's
 * (2026-11-06): 'auth' no actor, 'unknown' no such runner, 'input' failed the
 * schema, 'forbidden' the entry's role check, 'failed' the handler threw;
 * 'limit' only from actionRoutes (too many calls in its window).
 * Absent on a refusal: the entry itself said no (an address taken, no page yet).
 */
export type ActionFailure = 'auth' | 'unknown' | 'input' | 'forbidden' | 'failed' | 'limit';

export type ActionResult =
  | { ok: true; data?: Record<string, unknown> }
  | { ok: false; error: string; code?: ActionFailure };

/**
 * Addresses that differ by host. `hub` is the base of the network console's
 * routes (`/hub/organization`, `/email`): '' on arts-collective itself, the
 * network origin elsewhere.
 */
export interface ActionLinks {
  hub: string;
  /** ArtDirect origin, no trailing slash. */
  artdirect: string;
  /** e.g. "arts-collective.com"; an org's site is <slug>.<networkHost>. */
  networkHost: string;
  /** Nextcloud origin, when the host has one configured. */
  nextcloud?: string;
}
