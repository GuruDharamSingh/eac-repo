import { db } from "@elkdonis/db";
import {
  claimHostReminder,
  getMeetingSeries,
  getPresentedSeriesId,
  listHostRemindersDue,
  listSeriesSubscribers,
  seriesJoinUrl,
  type MeetingSeries,
} from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { DEFAULT_ALSO_ZONES, DEFAULT_SERIES_ZONE, dateParts, timeInZones } from "@/lib/series-time";
import { joinDetailsSentence } from "@/components/site/join-details";
import {
  TALK_BASE,
  comingUrl,
  seriesUnsubscribeUrl,
  upcomingLinks,
  weekTitle,
  weekUrl,
  whenLine,
  type SeriesMailPurpose,
} from "@/lib/series-mail";

/**
 * Reminder ticks for IFAC, run from instrumentation.ts every five minutes.
 *
 * Three letters, all deduplicated by the `thread_reminder_sends` ledger
 * (claim first, then send: one lost reminder beats six duplicates):
 *
 *   attendees    — to everyone with a `yes` on a week's topic thread
 *                  (`series_session`, migration 201), the day before
 *                  (kind 'attendees-day') and again shortly before the start
 *                  (kind 'attendees', the series' `reminder_minutes_before`,
 *                  default 60). Members' emails only. A cancelled week
 *                  (`series_sessions.status`, migration 203) is skipped; a
 *                  moved week is reminded at its thread's new `scheduled_at`.
 *   subscribers  — to everyone subscribed to a series (status `subscribed`
 *                  on the series' own thread, migration 202), `reminderDays` before each published
 *                  week (default 2; 0 turns it off), keyed on the series
 *                  thread and the week's instant. Draft weeks, weeks further
 *                  out than that and weeks under three hours away are skipped.
 *                  It carries the week, the join link, an "I'm coming" link and
 *                  the coming published weeks, with an unsubscribe link.
 *   host         — to whoever holds the week as host, and separately as
 *                  co-host (kind 'co-host'), within the hour
 *                  (`listHostRemindersDue`). Rota rows written by the
 *                  planner (`assignSeriesRole`) carry the same instants the
 *                  series computes, so they are found here.
 */
export async function runReminderTick(appOrigin: string): Promise<void> {
  await runAttendeeReminders(appOrigin).catch((err) => console.error("[ifac] attendee reminders:", err));
  await runSubscriberReminders(appOrigin).catch((err) => console.error("[ifac] subscriber reminders:", err));
  await runHostReminders(appOrigin).catch((err) => console.error("[ifac] host reminders:", err));
}

/** `purpose` is read by @elkdonis/email from 2026-10-10; the dist built before that ignores it. */
type ReminderData = Parameters<typeof import("@elkdonis/email").sendReminderEmail>[1] & { purpose?: SeriesMailPurpose };

/**
 * Per-series override chain for a reminder (design doc section 2): the
 * series' letter for this purpose (`reminder:<seriesId>:<purpose>`), then the
 * series' reminder (`reminder:<seriesId>`), then IFAC's own. Words stored on
 * a series key replace `bodyText`, so facts go in `summary`, `links`,
 * `meetingUrl` and `comingUrl`, which stay the sender's.
 */
const reminderScope = (seriesId: string, purpose: SeriesMailPurpose) => [`${seriesId}:${purpose}`, seriesId];

/** Facts for the event card's one line; the card collapses newlines. */
const factLine = (parts: Array<string | null | undefined | false>) => parts.filter(Boolean).join(" · ") || undefined;

const talkLink = (token: string | null | undefined) => (token && TALK_BASE ? `${TALK_BASE}/call/${token}` : undefined);

// ─── Attendees ───────────────────────────────────────────────────────────────

interface DueTopic {
  id: string;
  title: string;
  scheduled_at: Date;
  series_id: string;
  series_slug: string;
  series_title: string;
  meeting_url: string | null;
  video_link: string | null;
  talk_token: string | null;
  /** `metadata.joinDetails` (meeting-series.ts): join link, meeting ID, passcode, other ways. */
  join_details: { url?: string | null; meetingId?: string | null; passcode?: string | null; other?: string | null } | null;
  time_zone: string | null;
  also_zones: string[] | null;
  has_also_zones: boolean;
  week_title: string | null;
  summary: string | null;
  number: number | null;
}

async function dueTopics(windowMinutesExpr: "day" | "soon"): Promise<DueTopic[]> {
  // The day-before letter fires inside a 90-minute window a day out; the
  // soon letter inside the series' own reminder window.
  const lower = windowMinutesExpr === "day" ? db`NOW() + INTERVAL '22 hours 30 minutes'` : db`NOW()`;
  const upper =
    windowMinutesExpr === "day"
      ? db`NOW() + INTERVAL '24 hours'`
      : db`NOW() + (COALESCE(s.reminder_minutes_before, 60) * INTERVAL '1 minute')`;
  const kind = windowMinutesExpr === "day" ? "attendees-day" : "attendees";
  return db<DueTopic[]>`
    SELECT t.id, t.title, t.scheduled_at,
           s.id AS series_id, s.slug AS series_slug, s.title AS series_title,
           s.meeting_url, s.video_link, s.nextcloud_talk_token AS talk_token,
           s.metadata->'joinDetails' AS join_details,
           s.metadata->>'timeZone' AS time_zone,
           ARRAY(SELECT jsonb_array_elements_text(COALESCE(s.metadata->'series'->'alsoZones', '[]'::jsonb))) AS also_zones,
           (s.metadata->'series' ? 'alsoZones') AS has_also_zones,
           n.title AS week_title, n.summary,
           COALESCE(ss.number, (t.metadata->'seriesSession'->>'number')::int) AS number
    FROM threads t
    JOIN threads s ON s.id = t.metadata->'seriesSession'->>'seriesId'
    LEFT JOIN meeting_occurrence_notes n ON n.topic_thread_id = t.id
    LEFT JOIN series_sessions ss ON ss.session_thread_id = t.id AND ss.org_id = t.org_id
    WHERE t.org_id = ${siteConfig.orgId}
      AND s.org_id = ${siteConfig.orgId}
      AND t.kind = 'series_session'
      AND t.status = 'published'
      AND s.status = 'published'
      AND COALESCE(ss.status, 'scheduled') <> 'cancelled'
      AND t.scheduled_at IS NOT NULL
      AND t.scheduled_at > ${lower}
      AND t.scheduled_at <= ${upper}
      AND NOT EXISTS (
        SELECT 1 FROM thread_reminder_sends r
        WHERE r.thread_id = t.id AND r.occurrence_at = t.scheduled_at AND r.kind = ${kind}
      )
    LIMIT 20
  `;
}

async function runAttendeeReminders(appOrigin: string): Promise<void> {
  for (const which of ["day", "soon"] as const) {
    const kind = which === "day" ? "attendees-day" : "attendees";
    const due = await dueTopics(which);
    for (const topic of due) {
      const claimed = await db`
        INSERT INTO thread_reminder_sends (thread_id, occurrence_at, kind, recipients)
        VALUES (${topic.id}, ${topic.scheduled_at}, ${kind}, 0)
        ON CONFLICT DO NOTHING
        RETURNING thread_id
      `;
      if (claimed.length === 0) continue;

      const attendees = await db<Array<{ email: string; name: string }>>`
        SELECT u.email, COALESCE(u.display_name, u.email) AS name
        FROM thread_rsvps r JOIN users u ON u.id = r.user_id
        WHERE r.thread_id = ${topic.id} AND r.status = 'yes' AND u.email IS NOT NULL
      `;
      if (attendees.length === 0) continue;

      // Same zones as the pages (seriesZones): the stored list, else the defaults.
      const zone = topic.time_zone ?? DEFAULT_SERIES_ZONE;
      const zones = [zone, ...(topic.has_also_zones ? topic.also_zones ?? [] : DEFAULT_ALSO_ZONES).filter((z) => z !== zone)];
      const at = new Date(topic.scheduled_at).toISOString();
      const when = `${dateParts(at, zone).long} · ${timeInZones(at, zones)}`;
      const pageUrl = topic.number ? `${appOrigin}/series/${topic.series_slug}/${topic.number}` : `${appOrigin}/series/${topic.series_slug}`;
      const details = topic.join_details ?? {};
      const joinUrl = details.url || topic.meeting_url || topic.video_link || undefined;
      // The week's summary line and the meeting ID, passcode and dial-in go on
      // the card (`summary`), not in `bodyText`, so a series' own words keep
      // them. Only attendees with a yes receive this letter.
      const weekLine = topic.summary ? topic.summary.split("\n").find((l) => l.trim())?.trim() : undefined;
      const talkJoinUrl = !joinUrl ? talkLink(topic.talk_token) : undefined;
      const title = topic.week_title ? `${topic.series_title} · ${topic.week_title}` : topic.title;

      const { sendReminderEmail } = await import("@elkdonis/email");
      let sent = 0;
      for (const a of attendees) {
        try {
          const data: ReminderData = {
            purpose: "attendee",
            guestName: a.name,
            meetingTitle: title,
            scheduledAt: at,
            summary: factLine([when, weekLine, joinDetailsSentence(details)]),
            meetingUrl: joinUrl,
            talkJoinUrl,
            rsvpUrl: pageUrl,
            rsvpCount: attendees.length,
            threadKind: "meeting",
            calendarUrl: `${appOrigin}/series/${topic.series_slug}/calendar.ics?at=${encodeURIComponent(at)}`,
            bodyText:
              which === "day"
                ? `${title} is tomorrow.`
                : `${title} starts soon.${joinUrl || talkJoinUrl ? " The join link is below." : " The join link is on the series page once you are signed in."}`,
            orgId: siteConfig.orgId,
            threadId: topic.id,
            templateScope: reminderScope(topic.series_id, "attendee"),
            orgName: siteConfig.orgName,
          };
          await sendReminderEmail(a.email, data);
          sent++;
        } catch (err) {
          console.error(`[ifac] reminder to ${a.email} failed:`, err);
        }
      }
      await db`
        UPDATE thread_reminder_sends SET recipients = ${sent}
        WHERE thread_id = ${topic.id} AND occurrence_at = ${topic.scheduled_at} AND kind = ${kind}
      `;
      console.log(`[ifac] reminders (${kind}): ${topic.id} "${title}": sent ${sent}/${attendees.length}`);
    }
  }
}

// ─── Subscribers ─────────────────────────────────────────────────────────────

const SUBSCRIBER_KIND = "subscribers";
/** A week this close is left to the attendee letters. */
const SUBSCRIBER_MIN_LEAD_MS = 3 * 3_600_000;

/**
 * The org's series: recurring threads that carry `metadata.series` (set by
 * the series composer and the planner), plus the presented one.
 * `listSeriesSubscribers` reads only `subscribed` rows, so attendance on a
 * plain recurring meeting is never read as a subscription.
 */
async function seriesIds(): Promise<string[]> {
  const presented = await getPresentedSeriesId(siteConfig.orgId).catch(() => null);
  const rows = await db<Array<{ id: string }>>`
    SELECT id FROM threads
    WHERE org_id = ${siteConfig.orgId}
      AND status = 'published'
      AND kind IN ('series', 'meeting', 'event')
      AND recurrence_pattern IS NOT NULL
      AND (kind = 'series' OR metadata ? 'series' OR id = ${presented ?? ""})
  `;
  return rows.map((r) => r.id);
}

async function runSubscriberReminders(appOrigin: string): Promise<void> {
  const now = Date.now();
  for (const id of await seriesIds()) {
    const series = await getMeetingSeries(siteConfig.orgId, { threadId: id }, { count: 8 });
    if (!series || series.reminderDays <= 0) continue;
    const horizon = now + series.reminderDays * 86_400_000;
    const due = series.sessions.filter((w) => {
      const t = Date.parse(w.at);
      return !w.isPast && !w.isCancelled && w.isPublished && t <= horizon && t - now > SUBSCRIBER_MIN_LEAD_MS;
    });
    if (due.length === 0) continue;
    const subscribers = await listSeriesSubscribers(siteConfig.orgId, series.id);
    if (subscribers.length === 0) continue;

    for (const week of due) {
      const claimed = await db`
        INSERT INTO thread_reminder_sends (thread_id, occurrence_at, kind, recipients)
        VALUES (${series.id}, ${week.at}::timestamptz, ${SUBSCRIBER_KIND}, 0)
        ON CONFLICT DO NOTHING
        RETURNING thread_id
      `;
      if (claimed.length === 0) continue;
      const sent = await mailSubscribers(series, week.at, subscribers, appOrigin);
      await db`
        UPDATE thread_reminder_sends SET recipients = ${sent}
        WHERE thread_id = ${series.id} AND occurrence_at = ${week.at}::timestamptz AND kind = ${SUBSCRIBER_KIND}
      `;
      console.log(`[ifac] reminders (${SUBSCRIBER_KIND}): ${series.id} @ ${week.at}: sent ${sent}/${subscribers.length}`);
    }
  }
}

async function mailSubscribers(
  series: MeetingSeries,
  at: string,
  subscribers: Array<{ userId: string; email: string; displayName: string }>,
  appOrigin: string
): Promise<number> {
  const week = series.sessions.find((w) => w.at === at);
  if (!week) return 0;
  const coming = week.topicThreadId
    ? new Set(
        (
          await db<Array<{ user_id: string }>>`
            SELECT user_id FROM thread_rsvps WHERE thread_id = ${week.topicThreadId} AND status = 'yes'
          `
        ).map((r) => r.user_id)
      )
    : new Set<string>();
  const title = weekTitle(series, week);
  const url = weekUrl(appOrigin, series, week);
  const joinUrl = seriesJoinUrl(series, TALK_BASE) ?? undefined;
  const later = upcomingLinks(series, appOrigin, { exceptAt: week.at, max: 4 }).map((l) => ({ ...l, label: `Later: ${l.label}` }));
  const { sendReminderEmail } = await import("@elkdonis/email");

  let sent = 0;
  for (const s of subscribers) {
    const alreadyComing = coming.has(s.userId);
    try {
      const data: ReminderData = {
        purpose: "subscriber",
        guestName: s.displayName,
        meetingTitle: title,
        scheduledAt: week.at,
        // When, the week's summary line and (for those coming) the meeting ID
        // and passcode: facts, kept on the card so a series' own words keep them.
        summary: factLine([
          whenLine(series, week.at),
          week.summary?.split("\n").find((l) => l.trim())?.trim(),
          alreadyComing && joinDetailsSentence(series.joinDetails),
        ]),
        coverUrl: week.coverStillUrl ?? undefined,
        // The join link goes only to people who have said they're coming:
        // a subscription asks each week, it does not confirm (developer, 2026-10-10).
        meetingUrl: alreadyComing ? joinUrl : undefined,
        rsvpUrl: url,
        rsvpCount: week.rsvpCount,
        threadKind: "meeting",
        calendarUrl: `${appOrigin}/series/${series.slug}/calendar.ics?at=${encodeURIComponent(week.at)}`,
        copy: { "reminder.intro": { text: `The next session of ${series.title} is coming up.` } },
        bodyText: alreadyComing
          ? "You have said you're coming. Thank you."
          : "If you can come, let us know with the link below and we will send you the join link.",
        // The reminder letter renders "I'm coming" under the card, and a
        // series layout can place it as `{comingUrl}`.
        comingUrl: alreadyComing ? undefined : comingUrl(appOrigin, series.id, week.at, s.userId),
        links: later,
        // The reminder footer's link: "Unsubscribe from this series" with
        // purpose subscriber (the dist before 2026-10-10 labels it "turn them off").
        reminderSettingsUrl: seriesUnsubscribeUrl(appOrigin, series.id, s.email),
        orgId: siteConfig.orgId,
        threadId: series.id,
        templateScope: reminderScope(series.id, "subscriber"),
        orgName: siteConfig.orgName,
      };
      await sendReminderEmail(s.email, data);
      sent++;
    } catch (err) {
      console.error(`[ifac] subscriber reminder to ${s.email} failed:`, err);
    }
  }
  return sent;
}

// ─── Hosts ───────────────────────────────────────────────────────────────────

async function runHostReminders(appOrigin: string): Promise<void> {
  const presented = await getPresentedSeriesId(siteConfig.orgId).catch(() => null);
  for (const role of ["host", "co-host"] as const) {
    const due = await listHostRemindersDue({ orgId: siteConfig.orgId, withinMinutes: 65, role });
    for (const duty of due) {
      if (!duty.email) continue;
      const at = new Date(duty.occurrenceAt).toISOString();
      // A series week links to its own page; any other rota to the hub. A
      // cancelled week sends nothing (checked before the claim, so a restored
      // week is still reminded).
      const series = await getMeetingSeries(siteConfig.orgId, { threadId: duty.threadId }, { from: new Date(Date.parse(at) - 60_000), count: 1 }).catch(() => null);
      if (series?.sessions.find((w) => w.at === at)?.isCancelled) continue;
      if (!(await claimHostReminder(duty.threadId, duty.occurrenceAt, role))) continue;
      try {
        const isSeries = Boolean(series && (series.id === presented || Object.keys(series.presentation ?? {}).length > 0));
        const week = isSeries ? series!.sessions.find((w) => w.at === at) ?? null : null;
        const joinUrl = series ? seriesJoinUrl(series, TALK_BASE) ?? undefined : talkLink(duty.talkToken);
        const title = series && week ? weekTitle(series, week) : duty.title;
        const { sendReminderEmail } = await import("@elkdonis/email");
        const data: ReminderData = {
          purpose: "host",
          guestName: duty.displayName ?? duty.email,
          meetingTitle: title,
          scheduledAt: at,
          // The rota note and the meeting ID and passcode are facts: on the
          // card, so a series' own words keep them.
          summary: factLine([
            series && week && whenLine(series, at),
            duty.note && `Note on the rota: ${duty.note}`,
            series && joinDetailsSentence(series.joinDetails),
          ]),
          orgName: siteConfig.orgName,
          rsvpUrl: series && week ? weekUrl(appOrigin, series, week) : `${appOrigin}/hub`,
          meetingUrl: joinUrl,
          rsvpCount: week?.rsvpCount,
          copy: { "reminder.intro": { text: `You are ${role === "co-host" ? "co-hosting" : "hosting"} ${title} today.` } },
          bodyText: "If you cannot make it, tell an organiser so somebody else can pick it up.",
          orgId: siteConfig.orgId,
          threadId: duty.threadId,
          templateScope: series ? reminderScope(series.id, "host") : undefined,
        };
        await sendReminderEmail(duty.email, data);
      } catch (err) {
        console.error(`[ifac] ${role} reminder failed for ${duty.threadId} @ ${duty.occurrenceAt}:`, err);
      }
    }
  }
}
