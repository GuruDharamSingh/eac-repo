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
 * Further subject scopes (`series`, `auction`, …) come with runbooks (brief §3.5).
 */
export type ActionScope = 'person' | 'org' | 'thread';

/**
 * The scopes a course step can name (`settings.task.scope`). A `thread` entry acts
 * on one existing post, which a step cannot name until runbooks supply a subject
 * (brief §5 phase 4); `COURSE_ACTIONS` leaves those out.
 */
export type CourseActionScope = Exclude<ActionScope, 'thread'>;

/** Where an entry belongs, for grouping in the studio's picker. */
export type ActionArea = 'profile' | 'directory' | 'writing' | 'cloud' | 'market' | 'payments' | 'org' | 'content' | 'email';

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
