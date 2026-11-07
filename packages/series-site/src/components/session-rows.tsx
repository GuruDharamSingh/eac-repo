import type { CSSProperties } from "react";
import { SeriesRsvp } from "./series-rsvp";
import { CoverMedia, type CoverMediaValue } from "./cover-media";
// The row styles live beside the series page's (series-top.css, `.ifs-srow*`).
import "./series-top.css";

/**
 * Sessions as rows that link to each session's own page (2026-10-18,
 * mockups A and D, docs/open/series-index-mockups-2026-10-18/). A row does
 * not expand: the write-up and materials live on the session page, so the
 * series page no longer repeats this week's write-up. Used by the series
 * page (one series) and /series (every series, each row in its colour).
 * No hooks; "I'm coming" is the SeriesRsvp island.
 */
export interface SessionRowItem {
  seriesId: string;
  at: string;
  number: number;
  href: string;
  title: string | null;
  subtitle: string | null;
  isPast: boolean;
  date: { weekday: string; day: string; month: string };
  timeLine: string;
  host: { name: string; avatarUrl: string | null } | null;
  cover: CoverMediaValue | null;
  viewerStatus: "yes" | "maybe" | "no" | null;
  rsvpCount: number;
  /** Shown before "Session N" on pages listing several series. */
  seriesName?: string | null;
  /** The series' colour: mark (dot, edge) and text (label). */
  accent?: { mark: string; text: string } | null;
}

export function SessionRows({
  rows,
  signedIn,
  showThumb = true,
  rsvp = true,
}: {
  rows: SessionRowItem[];
  signedIn: boolean;
  showThumb?: boolean;
  rsvp?: boolean;
}) {
  return (
    <div className="ifs-srows">
      {rows.map((s) => (
        <article
          key={`${s.seriesId}-${s.at}`}
          className={`ifs-srow${s.isPast ? " is-past" : ""}`}
          id={s.seriesName ? undefined : `week-${s.number}`}
          style={s.accent ? ({ "--acc": s.accent.mark, "--acc-text": s.accent.text } as CSSProperties) : undefined}
        >
          <div className="ifs-datebox">
            <div className="ifs-datebox__d">{s.date.weekday}</div>
            <div className="ifs-datebox__n">{s.date.day}</div>
            <div className="ifs-datebox__m">{s.date.month}</div>
          </div>
          {showThumb &&
            (s.cover && (s.cover.kind === "image" || s.cover.posterUrl) ? (
              <a href={s.href} className="ifs-srow__thumb-link" tabIndex={-1} aria-hidden="true">
                <CoverMedia cover={s.cover.kind === "image" ? s.cover : { url: s.cover.posterUrl ?? s.cover.url, kind: "image" }} className="ifs-srow__thumb" controls={false} />
              </a>
            ) : (
              <span className="ifs-srow__thumb is-empty" aria-hidden="true" />
            ))}
          <div>
            <span className="ifs-srow__k">
              <i aria-hidden="true" />
              {s.seriesName ? `${s.seriesName} · ` : ""}Session {s.number}
            </span>
            <h3 className="ifs-srow__t">
              <a href={s.href}>{s.title ?? `Session ${s.number}`}</a>
            </h3>
            {s.subtitle && <p className="ifs-srow__sub">{s.subtitle}</p>}
            <p className="ifs-srow__meta">
              {s.host ? (
                <>
                  {s.host.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.host.avatarUrl} alt="" />
                  ) : null}
                  <span>{s.host.name}</span>
                </>
              ) : (
                <span>Host to be announced</span>
              )}
              <span>{s.timeLine}</span>
            </p>
          </div>
          <div className="ifs-srow__side">
            {rsvp && !s.isPast && (
              <SeriesRsvp
                seriesId={s.seriesId}
                occurrenceAt={s.at}
                signedIn={signedIn}
                initialStatus={s.viewerStatus}
                initialCount={s.rsvpCount}
                label="I'm coming"
                small
                returnTo={s.href}
              />
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
