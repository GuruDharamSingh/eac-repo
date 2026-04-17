import type { ContentDraft, KindInferenceResult, ThreadKind } from "./types";

/**
 * Infer thread kind from filled fields. Pure — no side effects, testable.
 *
 * Rules (most specific wins):
 *   - any session row → workshop
 *   - pitch, price, or flyer → workshop
 *   - RSVP fields touched → event
 *   - is_meeting true OR meetingTimeLabel OR scheduledAt → meeting
 *   - default → post
 *
 * publishAt alone does NOT flip kind — a post can be scheduled without
 * becoming a meeting.
 */
export function inferKind(draft: ContentDraft): KindInferenceResult {
  if ((draft.sessions?.length ?? 0) > 0) {
    return { kind: "workshop", reason: "has sessions" };
  }
  if (draft.pitch?.trim() || draft.price != null || draft.flyerUrl) {
    return { kind: "workshop", reason: "has workshop-tier content" };
  }
  if (
    draft.isRsvpEnabled ||
    draft.attendeeLimit != null ||
    draft.rsvpDeadline ||
    draft.minAttendees != null
  ) {
    return { kind: "event", reason: "RSVP fields set" };
  }
  if (draft.isMeeting || draft.meetingTimeLabel?.trim() || draft.scheduledAt) {
    return { kind: "meeting", reason: "meeting time or intent flag set" };
  }
  return { kind: "post", reason: "default" };
}

/**
 * Which tier does a given kind correspond to? Used by the ModeSwitcher to
 * highlight the current kind's quick-jump button.
 */
export function kindToTier(kind: ThreadKind) {
  if (kind === "workshop") return "workshop";
  if (kind === "event") return "rsvp";
  if (kind === "meeting") return "schedule";
  return "post";
}
