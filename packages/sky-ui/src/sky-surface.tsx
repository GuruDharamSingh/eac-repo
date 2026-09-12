"use client";

import { useEffect, useState } from "react";
import { SurfaceFrame, SurfaceSkeleton, useSurfaceOptional } from "@elkdonis/cms-ui/surface";
import type { ChartResult } from "@elkdonis/astro";
import { SkyConfig } from "./utils";
import { ChartWheel } from "./chart-wheel";
import { SkyPanel } from "./sky-panel";
import { SkyControls, SkyHeader } from "./sky-parts";
import { useSky } from "./use-sky";

/**
 * The sky, in the shared popup.
 *
 * Registered as connectors.custom.sky, so any face anywhere in the app opens
 * it with `{ type: "custom", key: "sky" }`. It fetches its own first chart
 * rather than inheriting the opener's. `siteUrl` is where "Open the sky" goes
 * — the host's own path at home, the Elastrocal site when embedded elsewhere.
 *
 * Two presentations:
 *
 *   bare (default)  no window at all. The wheel is a disc of white paper
 *                   floating on the backdrop, the date above it and the time
 *                   controls loose beneath, sized to the viewport's height.
 *                   A chart is a circle; a rectangle around it is furniture.
 *   framed          the ordinary surface — masthead, wheel beside the planet
 *                   list, footer action. Kept for hosts that want the popup
 *                   to read as one of a set of panels rather than an object.
 */
export function SkySurface({
  siteUrl = "/",
  external = false,
  bare = true,
}: {
  siteUrl?: string;
  external?: boolean;
  bare?: boolean;
}) {
  const [initial, setInitial] = useState<{ iso: string; chart: ChartResult } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(SkyConfig.endpoint);
        const body = await res.json();
        if (!res.ok) throw new Error(body.error);
        if (!cancelled) setInitial({ iso: body.chart.utc, chart: body.chart });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) {
    return (
      <SurfaceFrame kind="calendar" title="The sky">
        <p className="eac-surface-empty">The sky could not be calculated just now.</p>
      </SurfaceFrame>
    );
  }
  if (!initial) {
    // The skeleton keeps the frame even in bare mode — a loading circle with
    // no chart in it would just be a white hole over the page.
    return (
      <SurfaceFrame kind="calendar" title="The sky">
        <SurfaceSkeleton />
      </SurfaceFrame>
    );
  }
  const Body = bare ? BareBody : FramedBody;
  return <Body iso={initial.iso} chart={initial.chart} siteUrl={siteUrl} external={external} />;
}

interface BodyProps {
  iso: string;
  chart: ChartResult;
  siteUrl: string;
  external: boolean;
}

/** The disc: date, wheel, controls — nothing else. */
function BareBody({ iso, chart, siteUrl, external }: BodyProps) {
  const sky = useSky(iso, chart, true);
  const surfaces = useSurfaceOptional();

  return (
    <div className="eac-sky-bare">
      <SkyHeader sky={sky} className="justify-center text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.55)]" />

      <div className="eac-sky-disc">
        <ChartWheel chart={sky.chart} />
      </div>

      {/* Outside the disc: the disc clips to a circle, so a button in its
          corner would be cut in half. */}
      {surfaces && (
        <button type="button" className="eac-sky-bare-close" onClick={() => surfaces.close()} aria-label="Close">
          ✕
        </button>
      )}

      <div className="eac-sky-bare-controls">
        <SkyControls sky={sky} floating />
      </div>

      <a
        className="eac-sky-bare-link"
        href={siteUrl}
        target={external ? "_blank" : undefined}
        rel={external ? "noreferrer" : undefined}
      >
        Open the sky →
      </a>
    </div>
  );
}

/** The ordinary panel, for hosts that ask for `bare={false}`. */
function FramedBody({ iso, chart, siteUrl, external }: BodyProps) {
  const sky = useSky(iso, chart, true);
  return (
    <SurfaceFrame
      kind="calendar"
      title="The sky"
      kicker="Now"
      actions={[{ label: "Open the sky", href: siteUrl, primary: true, external }]}
    >
      <SkyPanel size="surface" sky={sky} />
    </SurfaceFrame>
  );
}
