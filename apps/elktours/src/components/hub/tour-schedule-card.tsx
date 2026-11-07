"use client";

import * as React from "react";

export interface ScheduleCardTour {
  id: string;
  slug: string;
  title: string;
  status: string;
  /** Formatted next departure, or null when none is scheduled. */
  next: string | null;
}

type Filter = "all" | "published" | "drafts";

/**
 * The hub's tour schedule card (editors): every tour offered, with a way into
 * each one's editor, and a drafts filter. Drawn in the Cards 2 style
 * (cms-ui hubsite `.eac-hp-card`), but a panel rather than one link, since it
 * holds many.
 */
export function TourScheduleCard({ tours }: { tours: ScheduleCardTour[] }) {
  const drafts = tours.filter((t) => t.status !== "published").length;
  const [filter, setFilter] = React.useState<Filter>("all");
  const shown = tours.filter((t) =>
    filter === "all" ? true : filter === "published" ? t.status === "published" : t.status !== "published"
  );
  const counts: Record<Filter, number> = { all: tours.length, published: tours.length - drafts, drafts };

  return (
    <section className="eac-hp-card el-schedule" aria-labelledby="hub-schedule-title">
      <span className="eac-hp-card-top">
        <span className="eac-hp-card-glyph" aria-hidden>
          ⌖
        </span>
        <a href="/manage/schedule" className="el-schedule-link">
          Schedule →
        </a>
      </span>
      <h2 id="hub-schedule-title" className="eac-hp-card-title">
        Tours offered
      </h2>
      <p className="eac-hp-card-blurb">Go into any tour to edit its words, stops and dates. Drafts are only seen by editors.</p>

      <div className="el-schedule-filter" role="group" aria-label="Show">
        {(["all", "published", "drafts"] as const).map((f) => (
          <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {f === "all" ? "All" : f === "published" ? "Published" : "Drafts"} ({counts[f]})
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="eac-hp-card-blurb">{filter === "drafts" ? "No drafts." : "No tours yet."}</p>
      ) : (
        <ul className="el-schedule-list">
          {shown.map((t) => (
            <li key={t.id}>
              <span className="el-schedule-name">
                <a href={`/manage/tours/${t.id}`}>{t.title}</a>
                {t.status !== "published" && <span className="el-schedule-badge">{t.status}</span>}
              </span>
              <span className="el-schedule-next">{t.next ? `Next: ${t.next}` : "No dates"}</span>
              <span className="el-schedule-actions">
                <a href={`/manage/tours/${t.id}`}>Edit</a>
                <a href={`/manage/tours/${t.id}/stops`}>Stops</a>
                <a href={`/manage/tours/${t.id}?tab=departures`}>Dates</a>
                <a href={`/tours/${t.slug}`}>{t.status === "published" ? "View" : "Preview"}</a>
              </span>
            </li>
          ))}
        </ul>
      )}

      <span className="eac-hp-card-meta el-schedule-foot">
        <a href="/manage/schedule">Plan dates in the schedule</a>
        <a href="/manage/tours/new">New tour</a>
      </span>
    </section>
  );
}
