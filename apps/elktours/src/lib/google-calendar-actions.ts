"use server";

import {
  beginCalendarAuth,
  disconnectCalendar,
  getCalendarLink,
  setCalendarWhich,
  syncCalendarLink,
  type CalendarLink,
  type CalendarWhich,
} from "@elkdonis/services/google-calendar";
import { requireOrgEditor, type Viewer } from "@/lib/auth";
import { calendarSite, googleCalendarRedirectUri } from "@/lib/google-calendar";

/**
 * The hub's "Sync to Google Calendar" control (2026-11-26). Each editor manages
 * only their own connection; "every run" is for owners.
 */

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

const allowed = (viewer: Viewer, which: unknown): CalendarWhich => (which === "all" && viewer.role === "owner" ? "all" : "mine");

export async function connectGoogleCalendar(which: CalendarWhich): Promise<Result<{ url: string }>> {
  const viewer = await requireOrgEditor("/hub");
  return beginCalendarAuth({
    userId: viewer.userId,
    orgId: calendarSite.orgId,
    redirectUri: googleCalendarRedirectUri(),
    which: allowed(viewer, which),
  });
}

async function syncMine(viewer: Viewer): Promise<Result<{ link: CalendarLink | null }>> {
  const link = await getCalendarLink(viewer.userId, calendarSite.orgId);
  if (!link) return { ok: false, error: "The calendar is not connected." };
  const r = await syncCalendarLink(link.id, calendarSite, { force: true });
  if (r.ok === false) return { ok: false, error: r.error };
  return { ok: true, link: await getCalendarLink(viewer.userId, calendarSite.orgId) };
}

export async function syncGoogleCalendarNow(): Promise<Result<{ link: CalendarLink | null }>> {
  return syncMine(await requireOrgEditor("/hub"));
}

export async function chooseGoogleCalendarRuns(which: CalendarWhich): Promise<Result<{ link: CalendarLink | null }>> {
  const viewer = await requireOrgEditor("/hub");
  await setCalendarWhich(viewer.userId, calendarSite.orgId, allowed(viewer, which));
  return syncMine(viewer);
}

export async function disconnectGoogleCalendar(): Promise<Result> {
  const viewer = await requireOrgEditor("/hub");
  await disconnectCalendar(viewer.userId, calendarSite.orgId);
  return { ok: true };
}
