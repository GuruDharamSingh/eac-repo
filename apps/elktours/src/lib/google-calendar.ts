import { db } from "@elkdonis/db";
import { listOrgSlots } from "@elkdonis/checkout/booking-server";
import type { CalendarSyncEvent, GoogleCalendarSite } from "@elkdonis/services/google-calendar";
import { siteConfig } from "@/config/site";
import { loadTours } from "@/lib/tour-slots";

/**
 * What goes into a person's Google Calendar from this site (2026-11-26): the
 * upcoming runs they guide, or every run for an owner who asks for that. Tour,
 * time, places booked, meeting point and a link to the office. No guest names
 * or contact details leave the site. Server only.
 */

const ORG = siteConfig.orgId;

/** listOrgSlots returns at most this many. */
const SLOT_LIMIT = 1000;

const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3021").replace(/\/$/, "");

/** The address to register on the Google OAuth client. */
export const googleCalendarRedirectUri = () => `${appUrl()}/api/google-calendar/callback`;

async function eventsFor(userId: string, which: "mine" | "all", from: Date): Promise<{ events: CalendarSyncEvent[]; coveredUntil: Date | null }> {
  const [member] = await db`SELECT role FROM user_organizations WHERE user_id = ${userId} AND org_id = ${ORG}`;
  const role = member?.role as string | undefined;
  // No longer an editor: their upcoming events are removed.
  if (role !== "owner" && role !== "guide") return { events: [], coveredUntil: null };
  const all = which === "all" && role === "owner";

  const slots = await listOrgSlots(ORG, { from, includeCancelled: false });
  const tours = await loadTours();
  // loadTours answers empty when it cannot read: do not mistake that for "no tours".
  if (slots.length > 0 && tours.size === 0) throw new Error("tours not read");
  const meeting = new Map(
    (
      await db`SELECT id, location FROM threads WHERE org_id = ${ORG} AND kind = 'tour' AND location IS NOT NULL`
    ).map((r) => [r.id as string, r.location as string])
  );

  const events: CalendarSyncEvent[] = [];
  for (const s of slots) {
    const tour = tours.get(s.threadId);
    // The slot's own guide, else the tour's author (as the booking emails have it).
    const guideId = s.guideUserId ?? tour?.authorId ?? s.hostUserId;
    if (!all && guideId !== userId) continue;
    const guideName = s.guideName ?? tour?.authorName ?? s.hostName;
    const url = `${appUrl()}/manage/schedule/${s.slotId}`;
    events.push({
      key: s.slotId,
      title: `${s.threadTitle} (${s.seatsTaken}/${s.capacity})`,
      description: [
        `${s.seatsTaken} of ${s.capacity} places taken.`,
        s.minToRun && s.minToRun > 1 && s.seatsTaken < s.minToRun && s.runDecision !== "run" ? `Below the minimum of ${s.minToRun}.` : null,
        guideName ? `Guide: ${guideName}` : null,
        url,
      ]
        .filter(Boolean)
        .join("\n"),
      location: meeting.get(s.threadId),
      start: s.startsAt,
      end: s.endsAt,
      url,
    });
  }
  const coveredUntil = slots.length >= SLOT_LIMIT ? new Date(slots[slots.length - 1]!.startsAt) : null;
  return { events, coveredUntil };
}

export const calendarSite: GoogleCalendarSite = {
  orgId: ORG,
  calendarName: "Elkdonis tours",
  timeZone: siteConfig.timeZone,
  eventsFor,
};
