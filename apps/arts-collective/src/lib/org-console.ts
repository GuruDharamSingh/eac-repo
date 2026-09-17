import { db } from "@elkdonis/db";

/**
 * What an organisation's console needs to know before it can tell its owner
 * anything useful.
 *
 * The Organization tab used to be seven sections of equal weight with no state
 * in any of them: an owner could not tell what had changed since their last
 * visit, what was waiting on them, or whether anything was broken. Every band
 * here answers "what needs you", and every number is meant to be a link into
 * the thing it counts — a console is a set of doors with counts on them, not a
 * dashboard of trivia.
 *
 * One module, one round of queries, because the page renders them together and
 * a band that loads separately is a band that shifts the layout under a click.
 * Each query is independently guarded: a console that loses its RSVP band to a
 * bad join is still worth showing, so a failure degrades that band to zero
 * rather than taking the page down.
 */

/** Kinds that happen at a time. Mirrors SCHEDULED_KINDS in @elkdonis/services. */
const SCHEDULED = ["event", "meeting", "workshop"];

export type ConsoleDraft = {
  id: string;
  title: string;
  kind: string;
  updatedAt: string | null;
};

export type ConsoleUpcoming = {
  id: string;
  title: string;
  kind: string;
  scheduledAt: string;
  rsvpCount: number;
  attendeeLimit: number | null;
  /** Set and not yet met — the thing an owner actually needs to see. */
  minAttendees: number | null;
};

export type ConsoleResponse = {
  id: string;
  questionnaireTitle: string;
  respondent: string;
  submittedAt: string | null;
};

export type ConsolePerson = {
  userId: string;
  displayName: string;
  email: string;
  role: string;
  joinedAt: string | null;
  /** Reachability and payout readiness, which is what "manage a member" means here. */
  hasNextcloud: boolean;
  hasStripe: boolean;
  stripeOnboarded: boolean;
};

export type ConsoleState = {
  drafts: { count: number; recent: ConsoleDraft[] };
  upcoming: { count: number; rsvpTotal: number; items: ConsoleUpcoming[] };
  responses: { count: number; recent: ConsoleResponse[] };
  people: {
    total: number;
    byRole: Record<string, number>;
    /** The whole roster. Small by nature — an org here has tens of members,
     *  not thousands — and both the People surface and the connection counts
     *  need the full set rather than a filtered slice of it. */
    all: ConsolePerson[];
    /** Joined in the last 30 days. */
    recent: ConsolePerson[];
    /** Still on `viewer` — they have an account here but no standing. */
    waiting: ConsolePerson[];
  };
  published: { count: number; lastAt: string | null };
};

/** A band that could not load reads as empty rather than taking the page down. */
async function guard<T>(label: string, run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run();
  } catch (err) {
    console.error(`[org-console] ${label}:`, err);
    return fallback;
  }
}

async function loadDrafts(orgId: string): Promise<ConsoleState["drafts"]> {
  const rows = await db<Array<{ id: string; title: string; kind: string; updated_at: string | null }>>`
    SELECT id, title, kind, updated_at
    FROM threads
    WHERE org_id = ${orgId} AND status = 'draft'
    ORDER BY COALESCE(updated_at, created_at) DESC
    LIMIT 5
  `;
  const [{ count }] = await db<Array<{ count: string }>>`
    SELECT COUNT(*)::text AS count FROM threads WHERE org_id = ${orgId} AND status = 'draft'
  `;
  return {
    count: Number(count),
    recent: rows.map((r) => ({
      id: r.id,
      title: r.title,
      kind: r.kind,
      updatedAt: r.updated_at,
    })),
  };
}

async function loadUpcoming(orgId: string): Promise<ConsoleState["upcoming"]> {
  // The RSVP count is a correlated subquery rather than a join + GROUP BY so a
  // thread with no RSVPs still comes back (as zero), which is precisely the
  // row an owner most needs to see.
  const rows = await db<
    Array<{
      id: string;
      title: string;
      kind: string;
      scheduled_at: string;
      rsvp_count: string;
      attendee_limit: number | null;
      min_attendees: number | null;
    }>
  >`
    SELECT
      t.id, t.title, t.kind, t.scheduled_at,
      (SELECT COUNT(*)::text FROM thread_rsvps r
        WHERE r.thread_id = t.id AND r.status = 'yes') AS rsvp_count,
      t.attendee_limit,
      t.min_attendees
    FROM threads t
    WHERE t.org_id = ${orgId}
      AND t.status = 'published'
      AND t.kind = ANY(${SCHEDULED})
      AND t.scheduled_at IS NOT NULL
      AND t.scheduled_at >= now()
    ORDER BY t.scheduled_at ASC
    LIMIT 6
  `;
  const items = rows.map((r) => ({
    id: r.id,
    title: r.title,
    kind: r.kind,
    scheduledAt: r.scheduled_at,
    rsvpCount: Number(r.rsvp_count),
    attendeeLimit: r.attendee_limit,
    minAttendees: r.min_attendees,
  }));
  return {
    count: items.length,
    rsvpTotal: items.reduce((sum, i) => sum + i.rsvpCount, 0),
    items,
  };
}

async function loadResponses(orgId: string): Promise<ConsoleState["responses"]> {
  // `submitted` is the only status that is waiting on the org — `draft` is the
  // member still writing, `reviewed`/`returned` have already had attention.
  const rows = await db<
    Array<{
      id: string;
      title: string;
      respondent: string | null;
      email: string;
      submitted_at: string | null;
    }>
  >`
    SELECT qr.id,
           COALESCE(q.title, qr.questionnaire_key) AS title,
           u.display_name AS respondent,
           u.email,
           qr.submitted_at
    FROM questionnaire_responses qr
    LEFT JOIN questionnaires q ON q.key = qr.questionnaire_key
    JOIN users u ON u.id = qr.user_id
    WHERE qr.org_id = ${orgId} AND qr.status = 'submitted'
    ORDER BY qr.submitted_at DESC NULLS LAST
    LIMIT 5
  `;
  const [{ count }] = await db<Array<{ count: string }>>`
    SELECT COUNT(*)::text AS count
    FROM questionnaire_responses
    WHERE org_id = ${orgId} AND status = 'submitted'
  `;
  return {
    count: Number(count),
    recent: rows.map((r) => ({
      id: r.id,
      questionnaireTitle: r.title,
      respondent: r.respondent ?? r.email,
      submittedAt: r.submitted_at,
    })),
  };
}

async function loadPeople(orgId: string): Promise<ConsoleState["people"]> {
  // Stripe and Nextcloud state comes from the `users` row, not from either
  // service: the platform records what it provisioned, and asking Stripe on
  // every console render would make the page as slow as the slowest API. It
  // also means this band still works with no STRIPE_SECRET_KEY set, which is
  // the current state of the network — it reports "nobody connected" honestly
  // rather than erroring.
  const rows = await db<
    Array<{
      user_id: string;
      display_name: string | null;
      email: string;
      role: string;
      joined_at: string | null;
      nextcloud_user_id: string | null;
      stripe_account_id: string | null;
      stripe_onboarded_at: string | null;
    }>
  >`
    SELECT uo.user_id, u.display_name, u.email, uo.role, uo.joined_at,
           u.nextcloud_user_id, u.stripe_account_id, u.stripe_onboarded_at
    FROM user_organizations uo
    JOIN users u ON u.id = uo.user_id
    WHERE uo.org_id = ${orgId}
    ORDER BY uo.joined_at DESC NULLS LAST
  `;

  const people: ConsolePerson[] = rows.map((r) => ({
    userId: r.user_id,
    displayName: r.display_name ?? r.email,
    email: r.email,
    role: r.role,
    joinedAt: r.joined_at,
    hasNextcloud: Boolean(r.nextcloud_user_id),
    hasStripe: Boolean(r.stripe_account_id),
    stripeOnboarded: Boolean(r.stripe_onboarded_at),
  }));

  const byRole: Record<string, number> = {};
  for (const p of people) byRole[p.role] = (byRole[p.role] ?? 0) + 1;

  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return {
    total: people.length,
    byRole,
    all: people,
    recent: people.filter((p) => p.joinedAt && new Date(p.joinedAt).getTime() >= cutoff),
    waiting: people.filter((p) => p.role === "viewer"),
  };
}

async function loadPublished(orgId: string): Promise<ConsoleState["published"]> {
  const [row] = await db<Array<{ count: string; last_at: string | null }>>`
    SELECT COUNT(*)::text AS count,
           MAX(COALESCE(published_at, created_at)) AS last_at
    FROM threads
    WHERE org_id = ${orgId} AND status = 'published'
  `;
  return { count: Number(row?.count ?? 0), lastAt: row?.last_at ?? null };
}

/** Everything the console shows, in one pass. */
export async function getConsoleState(orgId: string): Promise<ConsoleState> {
  const [drafts, upcoming, responses, people, published] = await Promise.all([
    guard("drafts", () => loadDrafts(orgId), { count: 0, recent: [] }),
    guard("upcoming", () => loadUpcoming(orgId), { count: 0, rsvpTotal: 0, items: [] }),
    guard("responses", () => loadResponses(orgId), { count: 0, recent: [] }),
    guard("people", () => loadPeople(orgId), {
      total: 0,
      byRole: {},
      all: [],
      recent: [],
      waiting: [],
    }),
    guard("published", () => loadPublished(orgId), { count: 0, lastAt: null }),
  ]);
  return { drafts, upcoming, responses, people, published };
}

/**
 * Whether the platform can talk to a payment provider at all.
 *
 * Deliberately a check on configuration rather than a live call: with no
 * `STRIPE_SECRET_KEY` anywhere on this network (confirmed 2026-09-16), the
 * honest thing for a console to say is "not connected", not to spin on a
 * request that cannot succeed. When a key appears this starts reporting
 * connected without any other change.
 */
export function paymentsConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}
