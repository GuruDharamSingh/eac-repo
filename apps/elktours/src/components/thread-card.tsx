"use client";

import Link from "next/link";
import { kindMeta, useSurfaceOptional } from "@elkdonis/cms-ui/surface";
import {
  formatDuration,
  formatRecurrence,
  formatShortDate,
  formatTime,
  toPlainText,
} from "@/lib/format";
import type { Thread, ThreadCycleStatus } from "@/lib/types";
import { CycleBadge } from "@elkdonis/blocks";

interface ThreadCardProps {
  thread: Thread;
  /** Only meaningful for dated, recurring items — omitted for posts. */
  cycleStatus?: ThreadCycleStatus;
  attendanceCount?: number;
  /** The feed's name, for the kicker. */
  feedName?: string;
}

/**
 * A listing row on a feed page — the FACE of the thread.
 *
 * Same vocabulary as a hub tile (glyph, kind hairline, monospace kicker,
 * title, blurb), laid out as a row. Clicking the row opens the thread's
 * surface in place — the same popup the hub tile and the calendar day open —
 * with "Open page" inside. The title and "Open page" stay real links, so
 * without JavaScript, in a reader, or from a search result they still go to
 * the page; a modifier-click keeps its meaning.
 */
export function ThreadCard({ thread, cycleStatus, attendanceCount, feedName }: ThreadCardProps) {
  const surfaces = useSurfaceOptional();
  const href = `/${thread.feedSlug}/${thread.slug}`;
  const when = thread.nextOccurrenceAt;
  const recurrence = formatRecurrence(thread.recurrencePattern);
  const duration = formatDuration(thread.durationMinutes);
  const preview = thread.excerpt ?? toPlainText(thread.description, 200);
  const meta = kindMeta(thread.kind);

  function open(e?: React.MouseEvent) {
    if (!surfaces) return;
    if (e && (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0)) return;
    e?.preventDefault();
    surfaces.open({
      type: "thread",
      id: thread.id,
      preview: {
        title: thread.title,
        kind: thread.kind,
        scheduledAt: when ? new Date(when).toISOString() : null,
        coverImageUrl: thread.coverImageUrl,
        feedName,
      },
    });
  }

  return (
    <article className="eac-face eac-face--row" data-kind={thread.kind}>
      {surfaces ? (
        <button type="button" className="eac-face-hit" aria-label={`Open ${thread.title}`} aria-haspopup="dialog" onClick={() => open()} />
      ) : (
        <a className="eac-face-hit" href={href} aria-label={`Open ${thread.title}`} />
      )}

      {thread.coverImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="eac-face-cover" src={thread.coverImageUrl} alt="" loading="lazy" />
      )}

      <span className="eac-face-kicker">
        {[meta.label, feedName].filter(Boolean).join(" · ")}
      </span>

      <span className="eac-face-title">
        <Link href={href} onClick={open} className="eac-face-live" style={{ color: "inherit", textDecoration: "none" }}>
          {thread.title}
        </Link>
      </span>

      {preview && <span className="eac-face-blurb">{preview}</span>}

      <div className="eac-face-meta">
        {when && (
          <span>
            <b>{formatShortDate(when)}</b> · {formatTime(when)}
            {duration ? ` · ${duration}` : ""}
          </span>
        )}
        {recurrence && <span>{recurrence}</span>}
        {thread.location && <span>{thread.location}</span>}
        {thread.isOnline && thread.meetingUrl && <span>Online</span>}
        {typeof attendanceCount === "number" && attendanceCount > 0 && (
          <span>
            <b>{attendanceCount}</b> coming
          </span>
        )}
        {thread.authorName && <span>with {thread.authorName}</span>}
      </div>

      {cycleStatus && (
        <div style={{ marginTop: 8 }}>
          <CycleBadge status={cycleStatus} />
        </div>
      )}

      <div className="eac-face-actions">
        <Link href={href} className="eac-btn eac-btn--quiet" style={{ padding: "4px 8px" }}>
          Open page →
        </Link>
      </div>
    </article>
  );
}
