// ============================================================================
// SUPERSEDED IN PART — 2026-09-17.
//
// The email SUITE is now `@elkdonis/cms-ui/email` (face + surface + the page at
// arts-collective.com/hub/email). It carries everything this pair used to be
// the only home for, and four things it never had: an inbox for mail that
// comes back, an address book merged across contacts/members/RSVP guests, a
// delivery ledger, and the org's own palette.
//
// This file is KEPT because it still does one thing the shared suite does not:
// per-thread email — choosing a meeting, writing its confirmation body,
// triggering a blast to that meeting's attendees, and setting its automatic
// reminder. Those run against amrit-canada's own routes
// (/api/threads/[id]/email-settings, /trigger-email, /reminder).
//
// DO NOT extend this file. When per-thread email is folded into the shared
// suite it becomes a sixth tab there, and this pair is deleted along with the
// `email` custom-surface key in HubSurfaces.tsx — which is the same key the
// shared suite registers, so the two can never be mounted in one app.
// ============================================================================

import { SurfaceCard } from "@elkdonis/cms-ui/surface";

export interface EmailThreadOption {
  id: string;
  title: string;
  scheduledAt: string | null;
  reminderMinutesBefore: number | null;
}

/** Confirmations, manual triggers, and the automatic countdown reminder — one card, one surface. */
export function EmailFace({ threads }: { threads: EmailThreadOption[] }) {
  return (
    <SurfaceCard
      kind="neutral"
      glyph="✉"
      title="Email"
      blurb="Send confirmations, reminders, and updates to attendees."
      surface={{
        type: "custom",
        key: "email",
        title: "Email",
        kind: "neutral",
        size: "wide",
        props: { threads },
      }}
    />
  );
}
