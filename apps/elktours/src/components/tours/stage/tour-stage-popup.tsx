"use client";

import { useSurfaceOptional, type SurfaceDescriptor } from "@elkdonis/cms-ui/surface";
import { TourPageProvider, type TourPageData } from "@/blocks/tour/context";
import { usePopupData } from "@/components/surfaces/surface-tabs";
import { TourStage } from "./tour-stage";
import type { TourStageOptions } from "./types";

// The tour popup a listing card opens on desktop (developer, 2026-11-20: "a version of a frame for the pop up
// replacing the one that currently comes up on desktop when a tour listing is clicked"): the tour page's stage,
// framed over the stop's photo with the strip on its lower edge (design 1a), in a `size: "stage"` dialog that has
// no window of its own. Data: GET /api/surfaces/tour/[id]/stage (the page's TourPageData + the stage block's
// saved settings). The hub keeps the older Stops / Overview / Dates popup (tour-popup.tsx).

type Custom = Extract<SurfaceDescriptor, { type: "custom" }>;

/** The descriptor a listing card opens on desktop. `cover` paints the frame while the data loads. */
export function tourStageDescriptor(tour: { id: string; slug: string; title: string; cover?: string | null }): SurfaceDescriptor {
  return {
    type: "custom",
    key: "tour-stage",
    title: tour.title,
    kind: "event",
    size: "stage",
    props: { id: tour.id, slug: tour.slug, cover: tour.cover ?? null },
  };
}

/** Fits a 1440×900 or 1280×800 window: 24 above the stage, the strip's 108 under it, 48 of air. */
const POPUP_STAGE_HEIGHT = "min(552px, calc(100dvh - 180px))";

export function TourStagePopup({ descriptor }: { descriptor: Custom }) {
  const surface = useSurfaceOptional();
  const id = typeof descriptor.props?.id === "string" ? descriptor.props.id : null;
  const slug = typeof descriptor.props?.slug === "string" ? descriptor.props.slug : null;
  const cover = typeof descriptor.props?.cover === "string" ? descriptor.props.cover : null;
  const { data, error } = usePopupData<{ data: TourPageData; options: Partial<TourStageOptions> }>(
    id ? `/api/surfaces/tour/${encodeURIComponent(id)}/stage` : null
  );
  const href = `/tours/${data?.data.tour.slug ?? slug ?? ""}`;

  if (!data || !data.data.stage) {
    return (
      <div className="ts-popup-wait" style={cover ? { backgroundImage: `url("${cover.replace(/"/g, "%22")}")` } : undefined}>
        <div className="ts-popup-wait__card" role="status">
          <span className="ts-popup-wait__kicker">Tour</span>
          <span className="ts-popup-wait__title">{descriptor.title ?? "Tour"}</span>
          {error || (data && !data.data.stage) ? (
            <span className="ts-popup-wait__line">
              {error ?? "This walk could not be drawn here."}{" "}
              {slug ? <a href={href}>Open the tour page →</a> : null}
            </span>
          ) : (
            <span className="ts-popup-wait__line">Loading the walk…</span>
          )}
          <button type="button" className="ts-popup-wait__close" aria-label="Close" onClick={() => surface?.close()}>
            ✕
          </button>
        </div>
      </div>
    );
  }

  return (
    <TourPageProvider data={data.data}>
      <TourStage {...data.options} showStrip host={{ onClose: () => surface?.close(), height: POPUP_STAGE_HEIGHT, pageHref: href }} />
    </TourPageProvider>
  );
}
