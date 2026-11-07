import { db } from "@elkdonis/db";
import { unsubscribeToken, verifyUnsubscribeToken } from "@elkdonis/newsletter/server";
import { followOrg, rsvpSeriesSession, seriesJoinUrl, type MeetingSeries, type SeriesRsvpResult, type SeriesSession } from "@elkdonis/services";
import { dateParts, seriesZones, timeInZones } from "./series-time";
import { joinDetailsSentence } from "../components/join-details";
import type { SeriesSite } from "../config";
export type SeriesMailPurpose = "attendee" | "host" | "host-assigned" | "subscriber";

export function createSeriesMail(site: SeriesSite) {

/**
 * Links and wording shared by the series' mail (2026-10-10): the host's
 * assignment letter, the RSVP notice to a week's host, and the subscriber
 * and host reminders in lib/reminders.ts.
 *
 * Signed links reuse the newsletter's HMAC (`unsubscribeToken`,
 * packages/newsletter/src/server.ts) over a scope string of their own, so a
 * series link cannot be replayed as a newsletter unsubscribe or the reverse.
 * Secret: NEWSLETTER_SECRET, else INTER_APP_JWT_SECRET; rotating it breaks
 * every link already mailed.
 */

const SITE_ORIGIN = `https://${site.domain}`;
const TALK_BASE = (process.env.NEXT_PUBLIC_NEXTCLOUD_URL ?? "").replace(/\/$/, "") || null;

/** Purpose values the reminder letter understands (`ReminderPurpose` in @elkdonis/email). */

const unsubscribeScope = (seriesId: string) => `${site.orgId}:series-unsubscribe:${seriesId}`;
const comingScope = (seriesId: string, at: string) => `${site.orgId}:series-coming:${seriesId}:${at}`;

function seriesUnsubscribeUrl(origin: string, seriesId: string, email: string): string {
  const t = unsubscribeToken(unsubscribeScope(seriesId), email);
  return `${origin}/api/series/unsubscribe?s=${encodeURIComponent(seriesId)}&e=${encodeURIComponent(email)}&t=${t}`;
}

function verifySeriesUnsubscribe(seriesId: string, email: string, token: string): boolean {
  return verifyUnsubscribeToken(unsubscribeScope(seriesId), email, token);
}

/** "I'm coming" for one week, for one account. */
function comingUrl(origin: string, seriesId: string, at: string, userId: string): string {
  const t = unsubscribeToken(comingScope(seriesId, at), userId);
  return `${origin}/api/series/coming?s=${encodeURIComponent(seriesId)}&at=${encodeURIComponent(at)}&u=${encodeURIComponent(userId)}&t=${t}`;
}

function verifyComing(seriesId: string, at: string, userId: string, token: string): boolean {
  return verifyUnsubscribeToken(comingScope(seriesId, at), userId, token);
}

function weekUrl(origin: string, series: Pick<MeetingSeries, "slug">, week: Pick<SeriesSession, "number">): string {
  return `${origin}/series/${series.slug}/${week.number}`;
}

/** "Monday, October 12 · 6:00 pm PT · 9:00 pm ET · 3:00 am Paris" */
function whenLine(series: MeetingSeries, at: string): string {
  const { zone, zones } = seriesZones(series);
  return `${dateParts(at, zone).long} · ${timeInZones(at, zones)}`;
}

function weekTitle(series: Pick<MeetingSeries, "title">, week: Pick<SeriesSession, "title" | "number">): string {
  return `${series.title} · ${week.title ?? `Session ${week.number}`}`;
}

/** The coming published weeks as mail links ("Mon 19 Oct · Title"), at most `max`. */
function upcomingLinks(series: MeetingSeries, origin: string, options: { exceptAt?: string; max?: number } = {}): Array<{ label: string; url: string }> {
  const { zone } = seriesZones(series);
  return series.sessions
    .filter((s) => !s.isPast && s.isPublished && s.at !== options.exceptAt)
    .slice(0, options.max ?? 5)
    .map((s) => {
      const d = dateParts(s.at, zone);
      return { label: `${d.weekday} ${d.day} ${d.month} · ${s.title ?? `Session ${s.number}`}`, url: weekUrl(origin, series, s) };
    });
}

/**
 * Tell somebody they have been put down to host (or co-host) a week, with a
 * link to the week's page, where the host edits it in place. Sent through the
 * reminder letter (template key `reminder`, so an org's own words and layout
 * apply) with `purpose: "host-assigned"`, which picks its subject and footer.
 */
async function sendHostAssignedEmail(input: {
  series: MeetingSeries;
  week: SeriesSession;
  role: "host" | "co-host";
  to: { email: string; name: string };
  origin?: string;
}): Promise<void> {
  const origin = input.origin ?? SITE_ORIGIN;
  const { series, week } = input;
  const url = weekUrl(origin, series, week);
  const title = weekTitle(series, week);
  const when = whenLine(series, week.at);
  const roleWord = input.role === "co-host" ? "co-host" : "host";
  const { sendReminderEmail } = await import("@elkdonis/email");
  // `purpose` is read by @elkdonis/email from 2026-10-10; the built dist in
  // use until its next rebuild ignores it.
  const data: Parameters<typeof sendReminderEmail>[1] & { purpose?: SeriesMailPurpose } = {
    purpose: "host-assigned",
    guestName: input.to.name,
    meetingTitle: title,
    scheduledAt: week.at,
    summary: when,
    rsvpUrl: url,
    calendarUrl: `${origin}/series/${series.slug}/calendar.ics?at=${encodeURIComponent(week.at)}`,
    threadKind: "meeting",
    copy: { "reminder.intro": { text: `You are down to ${roleWord} session ${week.number} of ${series.title}.` } },
    bodyText: [
      `${when}.`,
      week.isPublished
        ? "This week is published on the series page."
        : "This week is a draft. It shows on the series page once it has a title and an organiser publishes it.",
      "Open the session's page to give it a title, a write-up, a cover and the materials to look at beforehand.",
    ].join("\n"),
    links: [{ label: "Update this session", url }],
    orgId: site.orgId,
    threadId: series.id,
    // This series' host-assigned letter, then its reminder, then the org's.
    templateScope: [`${series.id}:host-assigned`, series.id],
    orgName: site.orgName,
  };
  await sendReminderEmail(input.to.email, data);
}

/**
 * Answer for one week and send its letters: the confirmation (with the join
 * link, meeting ID and passcode) to the person, and a notice to the week's
 * host and co-host, or to the owner address when nobody hosts it yet.
 * Shared by `api/series/rsvp` (the page buttons) and `api/series/coming`
 * (the subscriber letter's "I'm coming" link). The caller has checked that
 * the week is published and not past. Mail is detached.
 */
async function answerSeriesWeek(input: {
  series: MeetingSeries;
  week: SeriesSession;
  userId: string;
  email: string | null;
  going: boolean;
  origin?: string;
}): Promise<SeriesRsvpResult> {
  const { series, week } = input;
  const result = await rsvpSeriesSession({
    orgId: site.orgId,
    threadId: series.id,
    occurrenceAt: week.at,
    userId: input.userId,
    going: input.going,
  });
  // Saying yes makes the person a follower, as signing in on the site does: someone
  // signed in through the network has no role here, and the page's join details need one.
  if (result.ok && input.going) {
    await followOrg(input.userId, site.orgId).catch((err) => console.error(`[${site.orgId}] follow on answer failed:`, err));
  }
  if (result.ok && input.going && input.email) void mailAnswer({ ...input, email: input.email, topicId: result.topicThreadId });
  return result;
}

async function mailAnswer(input: {
  series: MeetingSeries;
  week: SeriesSession;
  userId: string;
  email: string;
  topicId: string;
  origin?: string;
}) {
  try {
    const { series, week } = input;
    const origin = input.origin ?? SITE_ORIGIN;
    const [me] = await db<Array<{ display_name: string | null }>>`SELECT display_name FROM users WHERE id = ${input.userId}`;
    const guestName = me?.display_name?.trim() || input.email.split("@")[0];
    const title = weekTitle(series, week);
    const pageUrl = `${origin}/series/${series.slug}`;
    const joinUrl = seriesJoinUrl(series, TALK_BASE);
    const hostIds = [week.host?.userId, week.coHost?.userId].filter((id): id is string => Boolean(id));
    const others = hostIds.filter((id) => id !== input.userId);
    const hosts = others.length
      ? await db<Array<{ email: string | null }>>`SELECT email FROM users WHERE id = ANY(${others}::uuid[])`
      : [];
    const hostEmails = hosts.map((h) => h.email).filter((e): e is string => Boolean(e));
    // The week's host and co-host hear about it; the owner address only when
    // nobody hosts the week yet, so a host-less week's answers reach a person.
    const notify = hostEmails.length
      ? hostEmails
      : hostIds.length
        ? []
        : [site.ownerEmail];

    const { sendRsvpConfirmation, sendRsvpNotification } = await import("@elkdonis/email");
    await Promise.all([
      sendRsvpConfirmation(input.email, {
        guestName,
        meetingTitle: title,
        scheduledAt: week.at,
        // The three-zone line (the template prints Eastern itself), then the
        // meeting ID and passcode: the template has no field of its own for
        // them, and this one is printed on the event card.
        summary: [whenLine(series, week.at), joinDetailsSentence(series.joinDetails)].filter(Boolean).join(" · "),
        meetingUrl: joinUrl ?? undefined,
        threadUrl: weekUrl(origin, series, week),
        threadKind: "meeting",
        calendarUrl: `${pageUrl}/calendar.ics?at=${encodeURIComponent(week.at)}`,
        links: week.materials.map((m) => ({ label: m.name, url: m.url })),
        orgId: site.orgId,
        // The ledger records the week; the words come from this series'
        // confirmation (`rsvp-guest:<seriesId>`) if it has one, else the org's.
        threadId: input.topicId,
        templateScope: [series.id],
        orgName: site.orgName,
      }),
      ...notify.map((to) =>
        sendRsvpNotification(to, {
          guestName,
          guestEmail: input.email,
          guestUsername: "member",
          meetingTitle: title,
          scheduledAt: week.at,
          threadUrl: weekUrl(origin, series, week),
          threadKind: "meeting",
          orgId: site.orgId,
          threadId: input.topicId,
          orgName: site.orgName,
        })
      ),
    ]);
  } catch (err) {
    console.error(`[${site.orgId}] series answer email failed:`, err);
  }
}

  return { SITE_ORIGIN, TALK_BASE, seriesUnsubscribeUrl, verifySeriesUnsubscribe, comingUrl, verifyComing, weekUrl, whenLine, weekTitle, upcomingLinks, sendHostAssignedEmail, answerSeriesWeek };
}
