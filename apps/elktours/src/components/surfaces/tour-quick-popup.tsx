"use client";

import * as React from "react";
import { SurfaceFrame, SurfaceSkeleton, type SurfaceAction, type SurfaceDescriptor } from "@elkdonis/cms-ui/surface";
import { ArchFrame, FactsStrip, Porthole } from "@/components/mobile";
import { tourQuickAction } from "@/lib/puck/tour-quick-action";
import type { TourQuick } from "./tour-quick-types";
import "@/components/mobile/overlays.css";

/** The descriptor a phone tour card opens: a quick overview with the way on to dates, the tour page and the itinerary. */
export function tourQuickDescriptor(p: { slug: string; title?: string }): SurfaceDescriptor {
  return { type: "custom", key: "tour-quick", title: p.title, kind: "neutral", size: "standard", props: { slug: p.slug } };
}

/** Quick overview of a tour, in a cms-ui surface. Reads through a server action, so it works signed out. */
export function TourQuickPopup({ descriptor }: { descriptor: Extract<SurfaceDescriptor, { type: "custom" }> }) {
  const slug = typeof descriptor.props?.slug === "string" ? descriptor.props.slug : null;
  const [data, setData] = React.useState<TourQuick | null>(null);
  const [done, setDone] = React.useState(false);
  React.useEffect(() => {
    let live = true;
    if (!slug) { setDone(true); return; }
    tourQuickAction(slug).then((d) => live && (setData(d), setDone(true))).catch(() => live && setDone(true));
    return () => { live = false; };
  }, [slug]);

  const actions: SurfaceAction[] = data
    ? [
        data.priced ? { label: "Choose a date \u2192", href: `/tours/${data.slug}/dates`, primary: true } : { label: "Ask us about it", href: "/about", primary: true },
        { label: "Open tour page", href: `/tours/${data.slug}` },
      ]
    : [];
  return (
    <SurfaceFrame kind="neutral" kicker={data?.typeLabel ?? "Tour"} title={data?.title ?? descriptor.title ?? "Tour"} actions={actions}>
      {!data ? (
        done ? <p className="m-ov-quiet">We could not find that tour.</p> : <SurfaceSkeleton block />
      ) : (
        <div className="m-ov m-tq">
          <div className="m-tq-head">
            <ArchFrame w={92} h={116} bottom={14} brass src={data.cover} />
            {data.guide ? (
              <div className="m-tq-guide">
                <Porthole size={40} src={data.guide.photo} initial={data.guide.name.slice(0, 1)} />
                <div>
                  <div className="m-tq-guide-name">{data.guide.name}</div>
                  {data.guide.craft ? <div className="m-tq-guide-sub">{data.guide.craft}</div> : null}
                </div>
              </div>
            ) : null}
          </div>
          <FactsStrip items={data.facts} />
          {data.blurb ? <p className="m-tq-blurb m-dropcap">{data.blurb}</p> : null}
          {data.slots.length > 0 ? (
            <div className="m-tq-dates">
              <span className="m-kicker">Next dates</span>
              <div className="m-tq-chips">
                {data.slots.map((s) => (
                  <a key={s.slotId} href={`/tours/${data.slug}/dates?slot=${s.slotId}`} className="m-tq-chip">
                    <span className="m-tq-chip-day">{s.day}</span>
                    <span className="m-tq-chip-left">{s.left}</span>
                  </a>
                ))}
              </div>
            </div>
          ) : null}
          {data.hasRoute ? (
            <a className="m-tq-dl" href={`/tours/${data.slug}/itinerary.png`} download={`${data.slug}-itinerary.png`}>
              Download itinerary <span aria-hidden="true">{"\u2193"}</span>
            </a>
          ) : null}
        </div>
      )}
    </SurfaceFrame>
  );
}
