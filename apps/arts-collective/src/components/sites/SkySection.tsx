"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { moonPhase, type ChartResult } from "@elkdonis/astro";
import { SurfaceProvider, useSurface } from "@elkdonis/cms-ui/surface";
import { MoonPhase, type MoonPhaseReading } from "@elkdonis/cms-ui/pens";
import { moonFace } from "@/lib/moon-image";
import { MoonSurface } from "./MoonSurface";
import "@elkdonis/cms-ui/surface.css";
import { SkyHeader, SkyList, SkySurface, useSky } from "@elkdonis/sky-ui";
import "@elkdonis/sky-ui/sky.css";
import { SKY_SLOT } from "@/lib/cms/community-render";

/**
 * Where the planets are right now, in the newsroom's right column under the
 * arcade.
 *
 * The newsroom is a server-rendered HTML string, so this portals into the
 * mount node that string leaves behind — the same arrangement as
 * <CommunityGame/>. The list and the popup both come from @elkdonis/sky-ui,
 * so this column and Elastrocal's own pages are one component; "Open the sky"
 * goes to Elastrocal, which owns the subject.
 */
export function SkySection({
  initialIso,
  initialChart,
  skyUrl,
}: {
  initialIso: string;
  initialChart: ChartResult;
  skyUrl: string;
}) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setSlot(document.getElementById(SKY_SLOT));
  }, []);
  if (!slot) return null;

  return createPortal(
    <SurfaceProvider
      connectors={{
        viewer: { signedIn: false, canCompose: false },
        loadThread: async () => null,
        orgName: "Elkdonis Arts Collective",
        custom: {
          sky: () => <SkySurface siteUrl={skyUrl} external />,
          moon: ({ descriptor }) => <MoonSurface phase={descriptor.props as unknown as MoonPhaseReading} />,
        },
      }}
    >
      <SkyColumn initialIso={initialIso} initialChart={initialChart} skyUrl={skyUrl} />
    </SurfaceProvider>,
    slot,
  );
}

/**
 * The column's own compact form: the moment, the planet list, the Moon as it
 * looks from here, a line into Elastrocal. Deliberately not a SurfaceCard —
 * inside a newsprint column a card's frame would fight the blocks around it —
 * but the list is the same component the face uses, and the whole block opens
 * the same popup.
 *
 * The moon is drawn from the chart already in hand rather than fetched, so it
 * redraws with every scrub of the clock — including the tilt, which turns as
 * the Moon crosses the sky and flips over between hemispheres.
 */
function SkyColumn({
  initialIso,
  initialChart,
  skyUrl,
}: {
  initialIso: string;
  initialChart: ChartResult;
  skyUrl: string;
}) {
  const sky = useSky(initialIso, initialChart, true);
  const surfaces = useSurface();
  const moon = moonPhase(sky.chart);

  return (
    <div>
      <button
        type="button"
        className="w-full cursor-pointer text-left"
        onClick={() =>
          surfaces.open({ type: "custom", key: "sky", title: "The sky", kind: "calendar", size: "bare" })
        }
        aria-haspopup="dialog"
        aria-label="Open the sky"
      >
        <SkyHeader sky={sky} readOnly className="mb-1.5 text-[10px] text-[var(--ink-3)]" />
        <SkyList chart={sky.chart} className="text-[11px] text-[var(--ink)]" />
      </button>

      {/* The Moon gets the column's full width as a square, below the table.
          Its own button rather than part of the one above — a button inside a
          button is invalid, and the two open different things. */}
      <button
        type="button"
        className="mt-2 block w-full cursor-pointer border-t border-[var(--rule,rgba(0,0,0,.15))] pt-2 text-left"
        onClick={() =>
          surfaces.open({
            type: "custom",
            key: "moon",
            title: `${moon.label} moon`,
            kind: "calendar",
            props: { ...moon },
          })
        }
        aria-haspopup="dialog"
        aria-label={`${moon.label} moon, ${Math.round(moon.illumination * 100)} per cent lit — see it larger`}
      >
        <MoonPhase phase={moon} face={moonFace(512)} size="100%" />
        <span className="mt-1 block text-[10px] leading-tight text-[var(--ink-3)]">
          {moon.label} · {Math.round(moon.illumination * 100)}% lit
        </span>
      </button>
      <a
        href={skyUrl}
        className="mt-2 block text-[10px] uppercase tracking-[0.14em] text-[var(--ink-3)] underline-offset-2 hover:underline"
      >
        Chart your own →
      </a>
    </div>
  );
}
