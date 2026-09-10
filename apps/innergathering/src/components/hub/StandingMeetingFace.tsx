"use client";

import type { StandingMeeting } from "@elkdonis/services";
import {
  SurfaceCard,
  fmtDateTime,
  relativeDay,
  useSurface,
} from "@elkdonis/cms-ui/surface";

const TZ = { timeZone: "America/Toronto" };

/**
 * The standing gathering, as a tile.
 *
 * The face carries what a member opens the hub for — cover, when it next
 * happens, how many are coming — and the click opens the full thread popup,
 * RSVP included. Nothing here duplicates that popup; it is the same object at
 * tile size.
 *
 * The kicker tells the truth about WHY this one is showing, because the three
 * cases are not interchangeable. Only a flagged or weekly-recurring gathering
 * may be called the weekly meeting; anything else is just the next thing on,
 * and labelling it "Weekly meeting" would be a small lie the hub repeats
 * every day.
 */
/**
 * Composing from this card starts a WEEKLY gathering.
 *
 * The seed is the point: without it the form opens on "Does not repeat", so a
 * button labelled "Create a weekly meeting" would produce a one-off — which
 * `getStandingMeeting` would then not recognise as weekly, and the card would
 * not pick it up. A suggested default, not a hidden decision: it renders in
 * the Repeats group where it can be changed.
 *
 * `tier: "full"` is required, not decoration. A prefilled compose defaults to
 * the quick tier, and recurrence is not a quick field — so at the default tier
 * the seeded value would be applied without ever being shown.
 */
const WEEKLY_COMPOSE = {
  type: "compose",
  kind: "meeting",
  prefill: { recurrence_pattern: "WEEKLY" },
  tier: "full",
} as const;

const KICKER: Record<StandingMeeting["source"], string> = {
  flagged: "Standing gathering",
  weekly: "Weekly meeting",
  next: "Next gathering",
};

export function StandingMeetingFace({
  standing,
  canEdit,
}: {
  standing: StandingMeeting | null;
  canEdit: boolean;
}) {
  const surfaces = useSurface();

  if (!standing) {
    return (
      <SurfaceCard
        kind="meeting"
        kicker="Weekly meeting"
        title="Nothing scheduled"
        blurb={
          canEdit
            ? "Create the gathering and it will lead the hub."
            : "Check back — the next gathering will appear here."
        }
        surface={canEdit ? WEEKLY_COMPOSE : { type: "calendar" }}
        preview={<span className="eac-preview-empty">No date set</span>}
      />
    );
  }

  const { event, at, source } = standing;
  const relative = relativeDay(at, TZ);
  const attendance = event.isRsvpEnabled
    ? `${event.rsvpCount} coming${event.attendeeLimit ? ` of ${event.attendeeLimit}` : ""}`
    : null;

  return (
    <SurfaceCard
      kind={event.kind}
      kicker={KICKER[source]}
      title={event.title}
      blurb={event.location ?? undefined}
      surface={{
        type: "thread",
        id: event.id,
        // Seeded so the popup paints its heading before the fetch lands.
        preview: {
          title: event.title,
          kind: event.kind,
          scheduledAt: at.toISOString(),
          coverImageUrl: event.coverImageUrl,
        },
      }}
      preview={
        <>
          {event.coverImageUrl && (
            <img
              className="eac-preview-cover"
              src={event.coverImageUrl}
              alt=""
              loading="lazy"
            />
          )}
          <span className="eac-preview-line">
            <span>{fmtDateTime(at, TZ)}</span>
          </span>
          <span className="eac-preview-cue">
            {[relative, attendance].filter(Boolean).join(" · ")}
          </span>

          {/* No weekly gathering exists, so an editor is shown the way to
              make one. `eac-face-live` takes pointer events back from the
              otherwise-inert face — the same opt-in the calendar's day cells
              use — so the rest of the card still opens the thread. The hit
              area is a sibling underneath, not an ancestor, so this needs no
              stopPropagation. */}
          {canEdit && source === "next" && (
            <span className="eac-face-live">
              <button
                type="button"
                className="eac-preview-action"
                onClick={() => surfaces.open(WEEKLY_COMPOSE)}
              >
                Create a weekly meeting
              </button>
            </span>
          )}
        </>
      }
    />
  );
}
