"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import type { TourStop } from "@elkdonis/commerce/server";
import { StreetView } from "@/components/tours/street-view";
import "./tour-story.css";

const TourMap = dynamic(() => import("@/components/tours/tour-map").then((m) => m.TourMap), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-muted" />,
});

interface TourStoryProps {
  stops: TourStop[];
  meetingPoint: { lat: number; lng: number; label?: string | null } | null;
  googleMapsKey: string | null;
}

/**
 * The route, told stop by stop. The text column scrolls; the map and the
 * Street View slot stay put beside it and change with the stop in view. On a
 * phone the two stack and the picture sits above each stop's text instead.
 */
export function TourStory({ stops, meetingPoint, googleMapsKey }: TourStoryProps) {
  const [active, setActive] = useState(-1);
  // The side panel is display:none below 900px; Leaflet cannot fit bounds in
  // a zero-size box (Invalid LatLng NaN), so the map is not mounted there.
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 900px)");
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  const refs = useRef<(HTMLElement | null)[]>([]);
  const placed = stops.filter((s) => s.lat != null && s.lng != null);
  const mapStops = placed.map((s) => ({ id: s.id, title: s.title, lat: s.lat!, lng: s.lng! }));
  const mapIndexOf = (stopIndex: number) => placed.findIndex((p) => p.id === stops[stopIndex]?.id);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        // The stop whose heading sits highest in the band near the top wins.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const top = visible[0];
        if (!top) return;
        const i = Number((top.target as HTMLElement).dataset.index);
        if (Number.isFinite(i)) setActive(i);
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: 0 }
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [stops.length]);

  const jump = useCallback((mapIndex: number) => {
    const stop = placed[mapIndex];
    const i = stops.findIndex((s) => s.id === stop?.id);
    const el = refs.current[i];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [placed, stops]);

  const current = active >= 0 ? stops[active] : null;
  const pose = current && current.lat != null && current.lng != null
    ? { lat: current.lat, lng: current.lng, heading: current.heading, pitch: current.pitch, fov: current.fov }
    : null;

  return (
    <div className="tour-story">
      <div className="tour-story__text">
        {meetingPoint?.label && (
          <section className="tour-stop" data-index={-1}>
            <p className="tour-stop__kicker">Meeting point</p>
            <h3 className="tour-stop__title">{meetingPoint.label}</h3>
          </section>
        )}
        {stops.map((s, i) => (
          <section
            key={s.id}
            ref={(el) => { refs.current[i] = el; }}
            data-index={i}
            className={`tour-stop${i === active ? " is-active" : ""}`}
            id={`stop-${i + 1}`}
          >
            <p className="tour-stop__kicker">
              Stop {i + 1}
              {s.durationMinutes ? ` · ${s.durationMinutes} min` : ""}
            </p>
            <h3 className="tour-stop__title">{s.title}</h3>
            {/* On narrow screens each stop carries its own picture. */}
            <div className="tour-stop__media">
              <StreetView
                pose={s.lat != null && s.lng != null ? { lat: s.lat, lng: s.lng, heading: s.heading, pitch: s.pitch, fov: s.fov } : null}
                imageUrl={s.imageUrl}
                title={s.title}
                apiKey={googleMapsKey}
                className="tour-stop__media-slot"
              />
            </div>
            {s.body && <div className="tour-stop__body" dangerouslySetInnerHTML={{ __html: s.body }} />}
          </section>
        ))}
      </div>

      {wide && (
      <aside className="tour-story__panel" aria-hidden={stops.length === 0}>
        <div className="tour-story__map">
          <TourMap stops={mapStops} meetingPoint={meetingPoint} activeIndex={current ? mapIndexOf(active) : -1} onSelect={jump} />
        </div>
        <div className="tour-story__view">
          <StreetView
            pose={pose}
            imageUrl={current?.imageUrl ?? null}
            title={current?.title ?? "Overview"}
            apiKey={googleMapsKey}
            className="h-full w-full"
          />
          <p className="tour-story__caption">
            {current ? `${active + 1}. ${current.title}` : meetingPoint?.label ? `Meeting point · ${meetingPoint.label}` : "The route"}
          </p>
        </div>
      </aside>
      )}
    </div>
  );
}
