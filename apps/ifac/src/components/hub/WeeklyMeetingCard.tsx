"use client";

import type { HubEvent } from "@/lib/hub-data";
import { HubCard } from "./HubCard";
import {
  formatDateTime,
  formatDuration,
  formatLabel,
  recurrenceLabel,
  relativeDay,
} from "./format";

/**
 * The group's standing weekly meeting.
 *
 * The tile face carries the cover image and the next occurrence, because that
 * is what a member opens the hub to check. Everything else — the join link,
 * the description, who else is coming — waits for the modal.
 *
 * `nextOccurrenceAt` rather than `scheduledAt` on the face: a weekly meeting's
 * row keeps the date of the FIRST occurrence forever, so showing `scheduledAt`
 * would tell a member the meeting happened in March.
 */
export function WeeklyMeetingCard({
  meeting,
  canEdit,
  talkBaseUrl,
}: {
  meeting: HubEvent | null;
  canEdit: boolean;
  /** Nextcloud's public origin. Absent in dev, which is why the link is conditional. */
  talkBaseUrl: string | null;
}) {
  if (!meeting) {
    return (
      <HubCard
        title="Weekly meeting"
        blurb="Standing time, agenda and join link."
        glyph="◷"
        accent="gold"
        preview={<span className="hub-preview-empty">No weekly meeting set</span>}
      >
        <div className="hub-panel">
          <p>
            Nothing is tagged as the weekly meeting yet. A meeting becomes the
            standing one when it is filed in the <code>weekly-meeting</code>{" "}
            section, or simply when it repeats weekly.
          </p>
          {canEdit ? (
            <a className="hub-btn hub-btn--primary" href="/hub/compose?kind=meeting">
              Create the weekly meeting
            </a>
          ) : (
            <p className="hub-muted">
              An owner or guide can set one up from Compose.
            </p>
          )}
        </div>
      </HubCard>
    );
  }

  const when = meeting.nextOccurrenceAt ?? meeting.scheduledAt;
  const relative = relativeDay(when);
  const duration = formatDuration(meeting.durationMinutes);
  const joinUrl =
    meeting.meetingUrl ??
    (meeting.talkToken && talkBaseUrl
      ? `${talkBaseUrl.replace(/\/$/, "")}/call/${meeting.talkToken}`
      : null);

  return (
    <HubCard
      title="Weekly meeting"
      blurb={meeting.title}
      glyph="◷"
      accent="gold"
      preview={
        <>
          {meeting.coverImageUrl && (
            <img
              className="hub-preview-cover"
              src={meeting.coverImageUrl}
              alt=""
              loading="lazy"
            />
          )}
          <span className="hub-preview-line">{formatDateTime(when)}</span>
          {relative && <span className="hub-preview-cue">{relative}</span>}
        </>
      }
    >
      <div className="hub-panel">
        {meeting.coverImageUrl && (
          <img className="hub-panel-cover" src={meeting.coverImageUrl} alt="" />
        )}
        <h3 className="hub-panel-title">{meeting.title}</h3>

        <dl className="hub-facts">
          <dt>Next</dt>
          <dd>
            {formatDateTime(when)}
            {relative && <span className="hub-chip">{relative}</span>}
          </dd>

          {duration && (
            <>
              <dt>Runs</dt>
              <dd>{duration}</dd>
            </>
          )}
          {recurrenceLabel(meeting.recurrencePattern) && (
            <>
              <dt>Repeats</dt>
              <dd>{recurrenceLabel(meeting.recurrencePattern)}</dd>
            </>
          )}
          {formatLabel(meeting.format) && (
            <>
              <dt>Format</dt>
              <dd>{formatLabel(meeting.format)}</dd>
            </>
          )}
          {meeting.location && (
            <>
              <dt>Where</dt>
              <dd>{meeting.location}</dd>
            </>
          )}
          <dt>Attending</dt>
          <dd>
            {meeting.rsvpCount}
            {meeting.attendeeLimit ? ` of ${meeting.attendeeLimit}` : ""}
          </dd>
        </dl>

        <div className="hub-panel-actions">
          {joinUrl && (
            <a
              className="hub-btn hub-btn--primary"
              href={joinUrl}
              target="_blank"
              rel="noreferrer"
            >
              Join the meeting
            </a>
          )}
          <a className="hub-btn" href={`/hub/meetings/${meeting.slug}`}>
            Meeting details
          </a>
          {canEdit && (
            <a className="hub-btn" href="/hub/compose?kind=meeting">
              Create another
            </a>
          )}
        </div>
      </div>
    </HubCard>
  );
}
