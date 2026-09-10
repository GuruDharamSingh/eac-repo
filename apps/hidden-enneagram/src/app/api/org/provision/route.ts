import { NextResponse } from "next/server";
import {
  ensureOrgCalendar,
  ensureOrgChatRoom,
  syncOrgCalendarShares,
  syncOrgCalendarEvents,
} from "@elkdonis/services";
import { getApiEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";

/**
 * Provision this org's Nextcloud resources. Idempotent — safe to re-run.
 *
 * Creates the CalDAV calendar, fans its shares out to members, projects the
 * org's threads into it, and creates the Talk room. Each step is reported
 * separately so a partial failure says which half worked: Nextcloud is a
 * separate system and one of these can fail while the others succeed.
 *
 * Calendar shares are fanned out PER USER PRINCIPAL, never to the org's
 * Circle. Live-tested 2026-09-07 against Nextcloud 33: a DAV share to
 * `principals/circles/<id>` returns HTTP 200 and persists nothing — it fails
 * silently, which is worse than failing. `user_organizations` is the
 * membership authority; see migration 104's header.
 *
 * Editors only. Provisioning writes to shared storage and should not be
 * something any signed-in member can trigger.
 */
export async function POST() {
  const editor = await getApiEditor();
  if (!editor) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const org = siteConfig.orgId;
  const result: Record<string, unknown> = {};

  try {
    result.calendarUri = await ensureOrgCalendar(org);
  } catch (err) {
    result.calendarError = err instanceof Error ? err.message : String(err);
  }

  if (result.calendarUri) {
    try {
      await syncOrgCalendarShares(org);
      result.sharesSynced = true;
    } catch (err) {
      result.sharesError = err instanceof Error ? err.message : String(err);
    }

    try {
      result.eventsProjected = await syncOrgCalendarEvents(org);
    } catch (err) {
      result.eventsError = err instanceof Error ? err.message : String(err);
    }
  }

  try {
    const room = await ensureOrgChatRoom(org);
    result.talkToken = room?.token ?? null;
  } catch (err) {
    result.talkError = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json(result);
}
