"use client";

import { useRouter } from "next/navigation";
import { SeriesPlannerSurface } from "@elkdonis/cms-ui/hub";
import { SurfaceChromeProvider } from "@elkdonis/cms-ui/surface";

/** The planner's Manage tab, "Email list" (organisers only; `api/hub/series/people`). */
export const SERIES_PEOPLE_ENDPOINT = "/api/hub/series/people";
/** The planner's Manage tab, "Sessions" and "Overall" (organisers only; `api/hub/series/stats`). */
export const SERIES_STATS_ENDPOINT = "/api/hub/series/stats";
/** Starts a series (organisers only): the planner's "+ New series" tab (`api/hub/series/new`). */
export const SERIES_NEW_ENDPOINT = "/api/hub/series/new";

/**
 * Mounts the shared Series planner as page content: the frame's close
 * control goes back to the hub instead of closing a popup.
 */
export function SeriesPlannerPage({
  threadId,
  title,
  canPlan,
  timeZone,
  publicHref,
  emailsHref,
  mailingsHref,
}: {
  threadId: string;
  title: string;
  canPlan: boolean;
  timeZone: string;
  publicHref: string;
  /** This series' letters in the email suite, on a site that has one. */
  emailsHref?: string;
  /** Its "Mailings to this series" section. */
  mailingsHref?: string;
}) {
  const router = useRouter();
  return (
    <div className="eac-surface-page ifac-series-page" data-kind="meeting">
      <p className="ifac-series-page__crumb">
        <a href="/hub">‹ Hub</a> · <a href="/hub/series">All series and the Series page</a> · <a href={publicHref} target="_blank" rel="noopener">{title} on the site →</a>
      </p>
      <article className="eac-surface-panel eac-surface-panel--page">
        <SurfaceChromeProvider value={{ onClose: () => router.push("/hub"), titleId: "series-planner-title" }}>
          <SeriesPlannerSurface
            threadId={threadId}
            canPlan={canPlan}
            timeZone={timeZone}
            peopleEndpoint={SERIES_PEOPLE_ENDPOINT}
            statsEndpoint={SERIES_STATS_ENDPOINT}
            emailsHref={emailsHref}
            mailingsHref={mailingsHref}
            createEndpoint={SERIES_NEW_ENDPOINT}
            onCreated={(id) => router.push(`/hub/series/${encodeURIComponent(id)}`)}
          />
        </SurfaceChromeProvider>
      </article>
    </div>
  );
}
