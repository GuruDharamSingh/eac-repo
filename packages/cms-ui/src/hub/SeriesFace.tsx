"use client";

import * as React from "react";
import { SurfaceCard, fmtShortDate, useSurface } from "../surface";

/**
 * The hub card for a meeting series: the next few weeks, who has each, and
 * which still need a host or a title. Opens the Series planner.
 *
 * Server-rendered from props (the hub page's one read), like the other
 * faces; the planner surface fetches its own fuller data when opened.
 */

export interface HubSeriesWeek {
  at: string;
  number: number;
  title: string | null;
  hostName: string | null;
  rsvpCount: number;
  isNext: boolean;
}

export interface HubSeries {
  id: string;
  slug: string;
  title: string;
  /** Public page, if the site has one. */
  href?: string | null;
  weeks: HubSeriesWeek[];
}

export function SeriesFace({
  series,
  canPlan,
  timeZone,
  surfaceKey = "meeting-series",
  plannerHref,
}: {
  series: HubSeries | null;
  canPlan: boolean;
  timeZone?: string;
  surfaceKey?: string;
  /** A page for the planner. Given, the card navigates instead of opening the popup. */
  plannerHref?: string | null;
}) {
  const surfaces = useSurface();
  if (!series) return null;
  const tz = timeZone ? { timeZone } : {};
  const shown = series.weeks.slice(0, 4);
  const gaps = series.weeks.filter((w) => !w.hostName).length;

  return (
    <SurfaceCard
      kind="meeting"
      kicker="Series"
      title={series.title}
      blurb={
        gaps > 0
          ? `${gaps} coming ${gaps === 1 ? "session needs" : "sessions need"} a host.`
          : "Every coming session has a host."
      }
      cue={plannerHref ? "→" : "+"}
      href={plannerHref ?? undefined}
      onClick={plannerHref ? undefined : (origin) =>
        surfaces.open(
          {
            type: "custom",
            key: surfaceKey,
            title: "Series planner",
            kind: "meeting",
            size: "wide",
            props: { threadId: series.id, canPlan },
          },
          origin ?? undefined
        )
      }
      preview={
        <ol className="eac-series-face">
          {shown.map((w) => (
            <li key={w.at} className={w.isNext ? "is-next" : undefined}>
              <span className="eac-series-face__date">{fmtShortDate(w.at, tz)}</span>
              <span className="eac-series-face__title">{w.title ?? <em>Untitled</em>}</span>
              <span className={`eac-series-face__host${w.hostName ? "" : " is-empty"}`}>
                {w.hostName ?? "No host"}
              </span>
            </li>
          ))}
        </ol>
      }
    />
  );
}
