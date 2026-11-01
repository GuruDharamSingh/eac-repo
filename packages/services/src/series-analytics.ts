import { db } from '@elkdonis/db';
import { SERIES_SESSION_KIND } from './thread-kinds';

/**
 * Email figures for one meeting series, for the planner's "Manage" tab
 * (2026-10-10; docs/open/SERIES_EMAIL_DESIGN_2026-10-10.md §1 "Thread id
 * passed by each series letter").
 *
 * Three ledgers are read, all scoped to `orgId`:
 *   - `email_sends`: one row per recipient per letter, written by
 *     `sendEmail` with the `threadId` the sender passed. Week topics
 *     (`series_session`) carry the confirmation (`rsvp`), the host notice
 *     (`notification`) and the attendee reminders (`reminder`); the series
 *     thread carries the subscriber letter, host and co-host reminders and the
 *     host-assigned notice (all `reminder`) and mailings (`newsletter`,
 *     including test copies, which the ledger does not mark).
 *   - `thread_reminder_sends`: one claim per (thread, week instant, kind):
 *     `attendees-day` / `attendees` on a week topic, `subscribers`, `host`,
 *     `co-host` on the series thread. `recipients` is the number mailed
 *     (always 1 for host claims). This is the only ledger that ties a
 *     series-thread letter to a week.
 *   - `thread_rsvps`: 'yes' on a week topic, 'subscribed' on the series.
 *
 * Opens and clicks: `email_sends.status` folds SendGrid events into one word
 * (`opened` included, no `clicked`), and every event is kept in
 * `email_events`. A send counts as opened when its status is `opened` or an
 * `open` or `click` event exists for it, and as clicked when a `click` event
 * exists. Events are matched on the part of `sg_message_id` before the first
 * dot: the ledger stores the Mail Send `x-message-id`, and SendGrid's event
 * ids normally extend it (`<x-message-id>.filter…`; assumed, no event has
 * reached the ledger as of 2026-10-10). `tracking.orgEvents` says whether any
 * event has ever been stored for the org, so a host can tell "no opens"
 * from "not measured".
 *
 * Week topics are found two ways: `metadata.seriesSession.seriesId` and, when
 * the table exists, `series_sessions` (migration 203). The table is checked
 * with `to_regclass` so this runs before 203 is applied. Archived topics
 * (left behind when a week moved) count toward the totals and appear as a
 * week only when something was sent or answered on them.
 *
 * Read-only.
 */

const SERIES_THREAD_KINDS = ['meeting', 'event', 'workshop', 'series'];

/** Delivery figures for a set of `email_sends` rows. */
export interface SeriesEmailTracking {
  /** Rows: one per recipient per letter. */
  sent: number;
  /** Validated by SendGrid in sandbox mode; not delivered. */
  sandboxed: number;
  /** failed, bounced or blocked. */
  failed: number;
  /** Reported as spam or unsubscribed through SendGrid. */
  complained: number;
  /** A delivered, open or click event, or status delivered/opened. */
  delivered: number;
  /** Status opened, or an open or click event. */
  opened: number;
  /** A click event. */
  clicked: number;
  /** Rows with at least one SendGrid event. 0 = nothing measured. */
  withEvents: number;
}

/**
 * One line of letters. `letter` names what was sent:
 *   confirmation       week topic, email_sends kind 'rsvp'
 *   host-notice        week topic, kind 'notification'
 *   attendee-reminder  week topic, kind 'reminder'
 *   subscriber-letter  series thread, reminder ledger 'subscribers' (per week only)
 *   host-reminder      series thread, reminder ledger 'host' / 'co-host' (per week only)
 *   series-letters     series thread, kind 'reminder' (subscriber letters,
 *                      host reminders, host-assigned notices; overall only)
 *   mailing            series thread, kind 'newsletter' (tests included)
 *   other              any other kind on these threads
 */
export type SeriesLetterKind =
  | 'confirmation'
  | 'host-notice'
  | 'attendee-reminder'
  | 'subscriber-letter'
  | 'host-reminder'
  | 'series-letters'
  | 'mailing'
  | 'other';

export interface SeriesEmailLine {
  letter: SeriesLetterKind;
  /** 'sends': `count` is email_sends rows. 'reminders': recipients from the reminder ledger. */
  source: 'sends' | 'reminders';
  count: number;
  /** For source 'sends' only. */
  tracking: SeriesEmailTracking | null;
  /** Reminder-ledger kinds behind the line, with recipients (e.g. attendees-day, attendees). */
  parts: Array<{ kind: string; count: number }>;
  lastAt: string | null;
}

export interface SeriesSessionEmailStats {
  /** The week's topic thread; null for a week known only from the reminder ledger. */
  topicThreadId: string | null;
  /** `series_sessions.number`, else `metadata.seriesSession.number`. */
  number: number | null;
  /** When the week meets (`starts_at`, else the topic's occurrenceAt / scheduled_at). */
  at: string;
  /** The rule slot, when it differs from `at` (a moved week). */
  slotAt: string | null;
  /**
   * published: published and titled; draft: not yet; cancelled: the
   * sidecar says so; removed: the topic is archived; unknown: no topic.
   */
  state: 'published' | 'draft' | 'cancelled' | 'removed' | 'unknown';
  title: string | null;
  /** 'yes' answers on the topic. */
  coming: number;
  /** Letters for the week: topic sends plus series-thread letters keyed to its instant. */
  emails: number;
  lines: SeriesEmailLine[];
  /** Over the topic's email_sends rows. */
  tracking: SeriesEmailTracking;
  lastAt: string | null;
}

export interface SeriesMailingSummary {
  slug: string;
  title: string;
  sentAt: string | null;
  sentCount: number;
}

export interface SeriesEmailStats {
  seriesId: string;
  slug: string;
  title: string;
  generatedAt: string;
  /** Whether opens and clicks can be measured at all. */
  measurement: {
    /** SendGrid events ever stored for the org. 0 = the event webhook has not delivered any. */
    orgEvents: number;
    /** Events matched to this series' sends. */
    seriesEvents: number;
  };
  overall: {
    subscribers: number;
    /** email_sends rows on the series thread and its week topics. */
    emails: number;
    lines: SeriesEmailLine[];
    tracking: SeriesEmailTracking;
    lastEmailAt: string | null;
    mailings: { drafts: number; sent: number; recipients: number; list: SeriesMailingSummary[] };
  };
  sessions: SeriesSessionEmailStats[];
}

type TopicRow = {
  id: string;
  thread_status: string;
  scheduled_at: Date | null;
  meta_at: string | null;
  meta_number: string | null;
  meta_published_at: string | null;
  ss_number: number | null;
  ss_slot_at: Date | null;
  ss_starts_at: Date | null;
  ss_status: string | null;
  ss_published_at: Date | null;
  note_title: string | null;
  coming: number;
};

type SendAgg = {
  thread_id: string;
  kind: string;
  sent: number;
  sandboxed: number;
  failed: number;
  complained: number;
  delivered: number;
  opened: number;
  clicked: number;
  with_events: number;
  last_at: Date | null;
};

type ReminderRow = { thread_id: string; occurrence_at: Date; kind: string; recipients: number; sent_at: Date };

const iso = (d: Date | string | null | undefined): string | null => {
  if (!d) return null;
  const t = new Date(d).getTime();
  return Number.isNaN(t) ? null : new Date(t).toISOString();
};
const msOf = (d: Date | string | null | undefined): number => (d ? new Date(d).getTime() : NaN);
const later = (a: string | null, b: string | null): string | null => (!a ? b : !b ? a : a > b ? a : b);

function emptyTracking(): SeriesEmailTracking {
  return { sent: 0, sandboxed: 0, failed: 0, complained: 0, delivered: 0, opened: 0, clicked: 0, withEvents: 0 };
}

function addTracking(into: SeriesEmailTracking, a: SendAgg | SeriesEmailTracking): SeriesEmailTracking {
  const n = (v: unknown) => Number(v) || 0;
  const src = a as Record<string, unknown>;
  into.sent += n(src.sent);
  into.sandboxed += n(src.sandboxed);
  into.failed += n(src.failed);
  into.complained += n(src.complained);
  into.delivered += n(src.delivered);
  into.opened += n(src.opened);
  into.clicked += n(src.clicked);
  into.withEvents += n(src.with_events ?? src.withEvents);
  return into;
}

/** Which topic-level line an email_sends kind belongs to. */
const TOPIC_LETTER: Record<string, SeriesLetterKind> = {
  rsvp: 'confirmation',
  notification: 'host-notice',
  reminder: 'attendee-reminder',
};
/** Which series-level line an email_sends kind belongs to. */
const SERIES_LETTER: Record<string, SeriesLetterKind> = {
  reminder: 'series-letters',
  newsletter: 'mailing',
};
const LINE_ORDER: SeriesLetterKind[] = [
  'confirmation',
  'host-notice',
  'attendee-reminder',
  'subscriber-letter',
  'host-reminder',
  'series-letters',
  'mailing',
  'other',
];

class Lines {
  private map = new Map<SeriesLetterKind, SeriesEmailLine>();
  line(letter: SeriesLetterKind, source: 'sends' | 'reminders'): SeriesEmailLine {
    let l = this.map.get(letter);
    if (!l) {
      l = { letter, source, count: 0, tracking: source === 'sends' ? emptyTracking() : null, parts: [], lastAt: null };
      this.map.set(letter, l);
    }
    return l;
  }
  addSends(letter: SeriesLetterKind, a: SendAgg) {
    const l = this.line(letter, 'sends');
    l.count += Number(a.sent) || 0;
    if (l.tracking) addTracking(l.tracking, a);
    l.lastAt = later(l.lastAt, iso(a.last_at));
  }
  addPart(letter: SeriesLetterKind, source: 'sends' | 'reminders', r: ReminderRow) {
    const l = this.line(letter, source);
    const n = Number(r.recipients) || 0;
    if (source === 'reminders') {
      l.count += n;
      l.lastAt = later(l.lastAt, iso(r.sent_at));
    }
    const p = l.parts.find((x) => x.kind === r.kind);
    if (p) p.count += n;
    else l.parts.push({ kind: r.kind, count: n });
  }
  list(): SeriesEmailLine[] {
    return LINE_ORDER.map((k) => this.map.get(k)).filter((l): l is SeriesEmailLine => Boolean(l));
  }
}

export async function getSeriesEmailStats(orgId: string, seriesId: string): Promise<SeriesEmailStats | null> {
  const [series] = await db<Array<{ id: string; slug: string; title: string }>>`
    SELECT id, slug, title FROM threads
    WHERE id = ${seriesId} AND org_id = ${orgId} AND kind = ANY(${SERIES_THREAD_KINDS})
    LIMIT 1
  `;
  if (!series) return null;

  // series_sessions exists from migration 203; production may not have it yet.
  const [reg] = await db<Array<{ has: boolean }>>`
    SELECT to_regclass('public.series_sessions') IS NOT NULL AS has
  `;
  const hasSessions = Boolean(reg?.has);

  // Week topics of the series, archived ones included (they still carry
  // letters). The sidecar fragments are left out when the table is missing,
  // so the statement never names it.
  const sidecarIds = hasSessions
    ? db`UNION SELECT ss.session_thread_id FROM series_sessions ss WHERE ss.series_id = ${series.id} AND ss.org_id = ${orgId}`
    : db``;
  const sidecarCols = hasSessions
    ? db`ss.number AS ss_number, ss.slot_at AS ss_slot_at, ss.starts_at AS ss_starts_at, ss.status AS ss_status, ss.published_at AS ss_published_at`
    : db`NULL::int AS ss_number, NULL::timestamptz AS ss_slot_at, NULL::timestamptz AS ss_starts_at, NULL::text AS ss_status, NULL::timestamptz AS ss_published_at`;
  const sidecarJoin = hasSessions
    ? db`LEFT JOIN series_sessions ss ON ss.session_thread_id = t.id AND ss.org_id = ${orgId} AND ss.series_id = ${series.id}`
    : db``;

  const topics = await db<TopicRow[]>`
    WITH ids AS (
      SELECT t.id FROM threads t
      WHERE t.org_id = ${orgId}
        AND t.kind = ${SERIES_SESSION_KIND}
        AND t.metadata->'seriesSession'->>'seriesId' = ${series.id}
      ${sidecarIds}
    )
    SELECT t.id,
           t.status AS thread_status,
           t.scheduled_at,
           t.metadata->'seriesSession'->>'occurrenceAt' AS meta_at,
           t.metadata->'seriesSession'->>'number' AS meta_number,
           t.metadata->'seriesSession'->>'publishedAt' AS meta_published_at,
           ${sidecarCols},
           n.title AS note_title,
           (SELECT count(*) FROM thread_rsvps r WHERE r.thread_id = t.id AND r.status = 'yes')::int AS coming
    FROM ids
    JOIN threads t ON t.id = ids.id AND t.org_id = ${orgId}
    ${sidecarJoin}
    LEFT JOIN LATERAL (
      SELECT mn.title FROM meeting_occurrence_notes mn
      WHERE mn.topic_thread_id = t.id AND mn.thread_id = ${series.id}
      ORDER BY mn.updated_at DESC
      LIMIT 1
    ) n ON true
  `;

  const topicIds = topics.map((t) => t.id);
  const threadIds = [series.id, ...topicIds];

  // One row per (thread, kind). Events join on the x-message-id prefix and
  // the recipient; see the file comment.
  const sends = await db<SendAgg[]>`
    WITH s AS (
      SELECT id, thread_id, kind, status, sent_at, sg_message_id, lower(to_email) AS email
      FROM email_sends
      WHERE org_id = ${orgId} AND thread_id = ANY(${threadIds})
    ),
    ev AS (
      SELECT s.id,
             bool_or(e.event = 'delivered') AS delivered,
             bool_or(e.event = 'open') AS opened,
             bool_or(e.event = 'click') AS clicked
      FROM s
      JOIN email_events e
        ON s.sg_message_id IS NOT NULL
       AND split_part(e.sg_message_id, '.', 1) = s.sg_message_id
       AND lower(e.email) = s.email
       AND (e.org_id IS NULL OR e.org_id = ${orgId})
      GROUP BY s.id
    )
    SELECT s.thread_id,
           s.kind,
           count(*)::int AS sent,
           (count(*) FILTER (WHERE s.status = 'sandboxed'))::int AS sandboxed,
           (count(*) FILTER (WHERE s.status IN ('failed', 'bounced', 'blocked')))::int AS failed,
           (count(*) FILTER (WHERE s.status IN ('spam', 'unsubscribed')))::int AS complained,
           (count(*) FILTER (WHERE s.status IN ('delivered', 'opened') OR ev.delivered OR ev.opened OR ev.clicked))::int AS delivered,
           (count(*) FILTER (WHERE s.status = 'opened' OR ev.opened OR ev.clicked))::int AS opened,
           (count(*) FILTER (WHERE ev.clicked))::int AS clicked,
           count(ev.id)::int AS with_events,
           max(s.sent_at) AS last_at
    FROM s LEFT JOIN ev ON ev.id = s.id
    GROUP BY s.thread_id, s.kind
  `;

  // thread_reminder_sends has no org_id; every id here was checked above.
  const reminders = await db<ReminderRow[]>`
    SELECT thread_id, occurrence_at, kind, recipients, sent_at
    FROM thread_reminder_sends
    WHERE thread_id = ANY(${threadIds})
  `;

  const [subs] = await db<Array<{ n: number }>>`
    SELECT count(*)::int AS n FROM thread_rsvps WHERE thread_id = ${series.id} AND status = 'subscribed'
  `;

  const [orgEv] = await db<Array<{ n: number }>>`
    SELECT count(*)::int AS n FROM email_events WHERE org_id = ${orgId}
  `;

  // A series' mailings are site_config `series-mail:<seriesId>:<slug>`
  // (@elkdonis/newsletter newsletterKey). starts_with, not LIKE: a nanoid may
  // contain `_`.
  const mailingPrefix = 'series-mail:' + series.id + ':';
  const mailingRows = await db<Array<{ key: string; title: string | null; sent_at: string | null; sent_count: string | null }>>`
    SELECT key, value->>'title' AS title, value->>'sentAt' AS sent_at, value->>'sentCount' AS sent_count
    FROM site_config
    WHERE org_id = ${orgId} AND starts_with(key, ${mailingPrefix})
    ORDER BY updated_at DESC
  `;

  // ── Weeks ──────────────────────────────────────────────────────────────
  type Acc = SeriesSessionEmailStats & { _lines: Lines };
  const sessions: Acc[] = [];
  const byTopic = new Map<string, Acc>();
  const byInstant = new Map<number, Acc>();

  // Archived topics first, so a live topic at the same instant wins the key.
  const ordered = [...topics].sort((a, b) => Number(a.thread_status !== 'archived') - Number(b.thread_status !== 'archived'));
  for (const t of ordered) {
    const at = iso(t.ss_starts_at) ?? iso(t.meta_at) ?? iso(t.scheduled_at);
    if (!at) continue;
    const metaNumber = Number(t.meta_number);
    const publishedAt = iso(t.ss_published_at) ?? iso(t.meta_published_at);
    const state: SeriesSessionEmailStats['state'] =
      t.thread_status === 'archived'
        ? 'removed'
        : t.ss_status === 'cancelled'
          ? 'cancelled'
          : publishedAt && t.note_title
            ? 'published'
            : 'draft';
    const slotAt = iso(t.ss_slot_at);
    const s: Acc = {
      topicThreadId: t.id,
      number: t.ss_number ?? (Number.isInteger(metaNumber) && metaNumber > 0 ? metaNumber : null),
      at,
      slotAt: slotAt && slotAt !== at ? slotAt : null,
      state,
      title: t.note_title,
      coming: Number(t.coming) || 0,
      emails: 0,
      lines: [],
      tracking: emptyTracking(),
      lastAt: null,
      _lines: new Lines(),
    };
    sessions.push(s);
    byTopic.set(t.id, s);
    for (const k of [t.ss_starts_at, t.ss_slot_at, t.meta_at, t.scheduled_at]) {
      const ms = msOf(k);
      if (!Number.isNaN(ms)) byInstant.set(ms, s);
    }
  }

  const overall = new Lines();
  const overallTracking = emptyTracking();
  let totalEmails = 0;
  let lastEmailAt: string | null = null;
  let seriesEvents = 0;

  for (const a of sends) {
    const n = Number(a.sent) || 0;
    totalEmails += n;
    seriesEvents += Number(a.with_events) || 0;
    addTracking(overallTracking, a);
    lastEmailAt = later(lastEmailAt, iso(a.last_at));
    const week = byTopic.get(a.thread_id);
    if (week) {
      const letter = TOPIC_LETTER[a.kind] ?? 'other';
      overall.addSends(letter, a);
      week._lines.addSends(letter, a);
      week.emails += n;
      addTracking(week.tracking, a);
      week.lastAt = later(week.lastAt, iso(a.last_at));
    } else {
      overall.addSends(SERIES_LETTER[a.kind] ?? 'other', a);
    }
  }

  for (const r of reminders) {
    lastEmailAt = later(lastEmailAt, iso(r.sent_at));
    const topicWeek = byTopic.get(r.thread_id);
    if (topicWeek) {
      // attendees / attendees-day: the sends are already counted from
      // email_sends; the ledger adds the split by reminder.
      overall.addPart('attendee-reminder', 'sends', r);
      topicWeek._lines.addPart('attendee-reminder', 'sends', r);
      continue;
    }
    // Series-thread claims: subscriber letters and host reminders, keyed to
    // the week's instant (its old slot when it has moved since).
    const letter: SeriesLetterKind | null =
      r.kind === 'subscribers' ? 'subscriber-letter' : r.kind === 'host' || r.kind === 'co-host' ? 'host-reminder' : null;
    if (letter) overall.addPart('series-letters', 'sends', r);
    if (!letter) continue;
    const ms = msOf(r.occurrence_at);
    let week = byInstant.get(ms);
    if (!week) {
      const at = iso(r.occurrence_at)!;
      week = {
        topicThreadId: null,
        number: null,
        at,
        slotAt: null,
        state: 'unknown',
        title: null,
        coming: 0,
        emails: 0,
        lines: [],
        tracking: emptyTracking(),
        lastAt: null,
        _lines: new Lines(),
      };
      sessions.push(week);
      byInstant.set(ms, week);
    }
    week._lines.addPart(letter, 'reminders', r);
    week.emails += Number(r.recipients) || 0;
    week.lastAt = later(week.lastAt, iso(r.sent_at));
  }

  const out: SeriesSessionEmailStats[] = sessions
    .filter((s) => s.state !== 'removed' || s.emails > 0 || s.coming > 0)
    .sort((a, b) => a.at.localeCompare(b.at))
    .map(({ _lines, ...s }) => ({ ...s, lines: _lines.list() }));

  const mailings: SeriesMailingSummary[] = mailingRows.map((m) => {
    const slug = m.key.slice(mailingPrefix.length);
    return {
      slug,
      title: m.title || slug,
      sentAt: iso(m.sent_at),
      sentCount: Number(m.sent_count) || 0,
    };
  });
  const sentMailings = mailings.filter((m) => m.sentAt);

  return {
    seriesId: series.id,
    slug: series.slug,
    title: series.title,
    generatedAt: new Date().toISOString(),
    measurement: { orgEvents: Number(orgEv?.n) || 0, seriesEvents },
    overall: {
      subscribers: Number(subs?.n) || 0,
      emails: totalEmails,
      lines: overall.list(),
      tracking: overallTracking,
      lastEmailAt,
      mailings: {
        drafts: mailings.length - sentMailings.length,
        sent: sentMailings.length,
        recipients: sentMailings.reduce((n, m) => n + m.sentCount, 0),
        list: mailings,
      },
    },
    sessions: out,
  };
}
