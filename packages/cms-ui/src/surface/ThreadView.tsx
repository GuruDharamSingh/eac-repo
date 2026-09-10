import * as React from "react";
import type { SurfaceThread } from "./types";
import { PRICED_KINDS, SCHEDULED_KINDS } from "./types";
import { SurfaceFacts, SurfaceSection } from "./SurfaceShell";
import {
  fmtDateTime,
  fmtDuration,
  fmtFormat,
  fmtPrice,
  fmtRecurrence,
  fmtShortDate,
  fmtTime,
  relativeDay,
  type FormatOptions,
} from "./format";

// ============================================================================
// A thread's body and facts, with no chrome and no fetching.
//
// The same rendering serves the popup (ThreadSurface, client-side, loaded on
// open) and the full page (SurfacePage, server-rendered). That is the
// "card → popup → page" promise made literal: the page IS the surface at
// page size, so nobody has to learn two layouts for one thing.
//
// Pure — no hooks — so a server component can render it.
// ============================================================================

export interface ThreadViewParts {
  /** The main pane: cover, dateline, lede, prose. */
  main: React.ReactNode;
  /** The rail: facts, sessions, workspace links. Null for kinds without any. */
  rail: React.ReactNode | null;
  kicker: string;
}

export function threadViewParts(
  thread: SurfaceThread,
  fmt: FormatOptions = {},
  options: { showCover?: boolean } = {}
): ThreadViewParts {
  const scheduled = SCHEDULED_KINDS.has(thread.kind);
  const priced = PRICED_KINDS.has(thread.kind);
  const when = thread.nextOccurrenceAt ?? thread.scheduledAt;
  const relative = relativeDay(when, fmt);
  const cancelled = thread.cycleStatus === "cancelled";
  const attendance = thread.isRsvpEnabled
    ? `${thread.rsvpCount}${thread.attendeeLimit ? ` of ${thread.attendeeLimit}` : ""}`
    : null;

  const factList: Array<{ label: string; value: React.ReactNode }> = [];
  if (scheduled) {
    factList.push({
      label: thread.recurrencePattern && thread.recurrencePattern !== "NONE" ? "Next" : "When",
      value: when ? (
        <>
          {fmtDateTime(when, fmt)}
          {relative && <span className="eac-chip">{relative}</span>}
          {cancelled && <span className="eac-chip eac-chip--warn">Cancelled</span>}
        </>
      ) : (
        "Date to be announced"
      ),
    });
    factList.push({ label: "Runs", value: fmtDuration(thread.durationMinutes) });
    factList.push({ label: "Repeats", value: fmtRecurrence(thread.recurrencePattern) });
    factList.push({ label: "Format", value: fmtFormat(thread.format) });
  }
  factList.push({ label: "Where", value: thread.location });
  if (scheduled) factList.push({ label: "Coming", value: attendance });
  if (priced) factList.push({ label: "Price", value: fmtPrice(thread.price, thread.currency, fmt) });

  const rail =
    scheduled || priced ? (
      <>
        <SurfaceFacts facts={factList} />

        {thread.sessions && thread.sessions.length > 0 && (
          <SurfaceSection title="Sessions">
            <ul className="eac-occ-list">
              {thread.sessions.map((s, i) => (
                <li key={i} className="eac-occ" style={{ cursor: "default" }}>
                  <span className="eac-occ-glyph" aria-hidden>
                    {i + 1}
                  </span>
                  <span>
                    <span className="eac-occ-title">{s.title || `Session ${i + 1}`}</span>
                    <span className="eac-occ-meta">
                      {[
                        s.startsAt && `${fmtShortDate(s.startsAt, fmt)} · ${fmtTime(s.startsAt, fmt)}`,
                        fmtDuration(s.durationMinutes),
                        s.location,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </SurfaceSection>
        )}

        {(thread.documentUrl || thread.videoLink) && (
          <SurfaceSection title="Workspace">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {thread.documentUrl && (
                <a className="eac-btn" href={thread.documentUrl} target="_blank" rel="noreferrer">
                  Shared document
                </a>
              )}
              {thread.videoLink && (
                <a className="eac-btn" href={thread.videoLink} target="_blank" rel="noreferrer">
                  Recording
                </a>
              )}
            </div>
          </SurfaceSection>
        )}
      </>
    ) : null;

  const dateline = [thread.author?.name, thread.publishedAt && fmtShortDate(thread.publishedAt, fmt)]
    .filter(Boolean)
    .join(" · ");

  const main = (
    <>
      {options.showCover !== false && thread.coverImageUrl && (
        <img className="eac-surface-cover" src={thread.coverImageUrl} alt="" />
      )}
      {dateline && (
        <p className="eac-surface-record" style={{ margin: "0 0 12px" }}>
          {dateline}
        </p>
      )}
      {thread.excerpt && <p className="eac-surface-lede">{thread.excerpt}</p>}
      {thread.bodyHtml ? (
        <div className="eac-surface-prose" dangerouslySetInnerHTML={{ __html: thread.bodyHtml }} />
      ) : !thread.excerpt ? (
        <p className="eac-surface-muted">No description yet.</p>
      ) : null}
    </>
  );

  const kindLabel = KIND_LABELS[thread.kind] ?? "";
  const kicker = [kindLabel, thread.feed?.name].filter(Boolean).join(" · ");

  return { main, rail, kicker };
}

const KIND_LABELS: Record<string, string> = {
  post: "Writing",
  event: "Event",
  meeting: "Meeting",
  workshop: "Workshop",
  service: "Service",
  product: "Product",
};
