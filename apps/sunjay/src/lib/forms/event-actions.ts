"use server";

import type { MeetingContextView, MeetingInputView, MeetingRecordView } from "@elkdonis/studio-forms/meeting";
import { siteMeetingContextAction, siteMeetingLoadAction, siteMeetingSaveAction } from "@/lib/forms/meeting-actions";

/**
 * The event form's server side on Para Theater (2026-11-14). An event is a meeting row with
 * `kind = 'event'` (services meeting-content.ts handles both), so these delegate to the meeting
 * actions; the form sends `kind: 'event'` in the input. Kept as its own file so the event binding
 * can diverge (its own revalidation or permissions) without touching the meeting one.
 */

export async function siteEventContextAction(orgId: string): Promise<MeetingContextView> {
  return siteMeetingContextAction(orgId);
}

export async function siteEventLoadAction(id: string): Promise<MeetingRecordView | null> {
  return siteMeetingLoadAction(id);
}

export async function siteEventSaveAction(
  orgId: string,
  input: MeetingInputView,
  intent: "draft" | "published",
  id: string | null,
  opts?: { autosave?: boolean }
) {
  return siteMeetingSaveAction(orgId, { ...input, kind: "event" }, intent, id, opts);
}
