"use client";

import * as React from "react";
import { SurfaceFrame, SurfaceSkeleton, type SurfaceDescriptor } from "@elkdonis/cms-ui/surface";
import { PlaceBody } from "@/components/mobile/place-body";
import { placeSheetAction } from "@/lib/puck/mobile-overlay-actions";
import type { PlaceSheetData } from "@/blocks/mobile/types";

/** The descriptor the Discover lightbox opens: a PUBLIC place popup (the `place` surface is editors only). */
export function placeDetailDescriptor(p: { id: string; name?: string }): SurfaceDescriptor {
  return { type: "custom", key: "place-detail", title: p.name, kind: "neutral", size: "standard", props: { id: p.id } };
}

/** The public place body in a cms-ui surface. Reads through a server action, so it works signed out. */
export function PlaceDetailPopup({ descriptor }: { descriptor: Extract<SurfaceDescriptor, { type: "custom" }> }) {
  const id = typeof descriptor.props?.id === "string" ? descriptor.props.id : null;
  const [data, setData] = React.useState<PlaceSheetData | null>(null);
  const [done, setDone] = React.useState(false);
  React.useEffect(() => {
    let live = true;
    if (!id) { setDone(true); return; }
    placeSheetAction(id).then((d) => live && (setData(d), setDone(true))).catch(() => live && setDone(true));
    return () => { live = false; };
  }, [id]);
  const title = data?.name ?? descriptor.title ?? "Place";
  return (
    <SurfaceFrame kind="neutral" kicker={data?.kind ?? "Place"} title={title}>
      {!data ? (
        done ? <p className="m-ov-quiet">We could not find that place.</p> : <SurfaceSkeleton block />
      ) : (
        <div className="m-ov">
          <PlaceBody p={data} showHead={false} />
        </div>
      )}
    </SurfaceFrame>
  );
}
