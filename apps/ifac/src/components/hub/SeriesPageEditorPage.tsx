"use client";

import { useRouter } from "next/navigation";
import { SeriesPageEditor } from "@elkdonis/cms-ui/hub";
import { SurfaceChromeProvider, SurfaceFrame } from "@elkdonis/cms-ui/surface";

/**
 * The Series page settings (2026-10-18) as a hub page, framed like the
 * Series planner page (SeriesPlannerPage.tsx): the frame's close control
 * goes back to the hub.
 */
export function SeriesPageEditorPage() {
  const router = useRouter();
  return (
    <div className="eac-surface-page ifac-series-page" data-kind="meeting">
      <p className="ifac-series-page__crumb">
        <a href="/hub">‹ Hub</a> · <a href="/series" target="_blank" rel="noopener">The Series page on the site →</a>
      </p>
      <article className="eac-surface-panel eac-surface-panel--page">
        <SurfaceChromeProvider value={{ onClose: () => router.push("/hub"), titleId: "series-page-title" }}>
          <SurfaceFrame kind="meeting" kicker="Series" title="The Series page">
            <SeriesPageEditor endpoint="/api/hub/series-page" publicHref="/series" defaultHeading="Series from IFAC" />
          </SurfaceFrame>
        </SurfaceChromeProvider>
      </article>
    </div>
  );
}
