"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import type { TourStop } from "@elkdonis/commerce/server";
import { StreetView } from "@/components/tours/street-view";
import { BusinessCard } from "@/components/places/business-card";
import type { PlaceBusinessSummary } from "@/lib/catalogue-types";
import "./tour-story.css";

const TourMap = dynamic(() => import("@/components/tours/tour-map").then((m) => m.TourMap), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-muted" />,
});

interface TourStoryProps {
  stops: TourStop[];
  meetingPoint: { lat: number; lng: number; label?: string | null } | null;
  googleMapsKey: string | null;
  /** Per stop id: the place's primary business (TourFull.stopExtras). */
  businesses?: Record<string, PlaceBusinessSummary | null>;
}

/** How long the active line must hold one stop before the map moves (smooths fast scrolling). */
const SETTLE_MS = 140;

/**
 * The route, told stop by stop. The text column scrolls; the map and the
 * Street View slot stay put beside it and follow the active stop. On a phone
 * the two stack and the picture sits above each stop's text instead.
 *
 * Which stop is active (2026-11-02 rewrite, after "very unreliable"):
 *   - Scrolling: ONE IntersectionObserver watches a thin line 40% down the
 *     viewport. It keeps a running set of the stops on that line (the old
 *     version looked only at the entries in each callback, so a stop leaving
 *     with none entering changed nothing), takes the top one, and commits it
 *     after SETTLE_MS without change.
 *   - Clicking a stop (or its pin on the map) makes it active at once and
 *     LOCKS scroll-driven changes, so the smooth scroll a click may cause
 *     never re-picks a stop. The lock lifts on the next real user scroll:
 *     wheel, touch or a scrolling key, never on programmatic scroll events.
 */
export function TourStory({ stops, meetingPoint, googleMapsKey, businesses }: TourStoryProps) {
  const [active, setActive] = useState(-1);
  // The side panel is display:none below 900px; the map cannot fit bounds in
  // a zero-size box, so it is not mounted there.
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 900px)");
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const refs = useRef<(HTMLElement | null)[]>([]);
  const onLine = useRef(new Set<number>());
  const locked = useRef(false);
  const timer = useRef<number | null>(null);

  const placed = stops.filter((s) => s.lat != null && s.lng != null);
  const mapStops = placed.map((s) => ({ id: s.id, title: s.title, lat: s.lat!, lng: s.lng! }));
  const mapIndexOf = (stopIndex: number) => placed.findIndex((p) => p.id === stops[stopIndex]?.id);

  // Scroll sync.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const line = onLine.current;
    line.clear();
    const commit = () => {
      timer.current = null;
      if (locked.current || line.size === 0) return;
      setActive(Math.min(...line));
    };
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const i = Number((e.target as HTMLElement).dataset.index);
          if (!Number.isFinite(i) || i < 0) continue;
          if (e.isIntersecting) line.add(i);
          else line.delete(i);
        }
        if (locked.current) return;
        if (timer.current) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(commit, SETTLE_MS);
      },
      // A 1px-high band at 40% of the viewport: at most a stop or two touch it.
      { rootMargin: "-40% 0px -60% 0px", threshold: 0 }
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => {
      io.disconnect();
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [stops.length]);

  // A real user scroll lifts a click's lock; programmatic scrolling does not fire these.
  useEffect(() => {
    const unlock = () => {
      if (!locked.current) return;
      locked.current = false;
    };
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(e.key)) unlock();
    };
    window.addEventListener("wheel", unlock, { passive: true });
    window.addEventListener("touchmove", unlock, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("wheel", unlock);
      window.removeEventListener("touchmove", unlock);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  /** Make a stop active now, and hold it until the user scrolls. */
  const choose = useCallback((i: number, scroll: boolean) => {
    if (i < 0 || i >= stops.length) return;
    locked.current = true;
    if (timer.current) window.clearTimeout(timer.current);
    setActive(i);
    if (scroll) refs.current[i]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [stops.length]);

  // A pin on the map: that stop, and bring its text into view.
  const jump = useCallback((mapIndex: number) => {
    const stop = placed[mapIndex];
    choose(stops.findIndex((s) => s.id === stop?.id), true);
  }, [placed, stops, choose]);

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
            aria-current={i === active ? "step" : undefined}
            onClick={(e) => {
              // Links and controls inside the stop keep their own click.
              if ((e.target as HTMLElement).closest("a, button, iframe, video, input")) return;
              if (wide) choose(i, false);
            }}
          >
            <p className="tour-stop__kicker">
              Stop {i + 1}
              {s.durationMinutes ? ` · ${s.durationMinutes} min` : ""}
              {i === active && wide ? <span className="tour-stop__now"> · On the map</span> : null}
            </p>
            <h3 className="tour-stop__title">
              {wide ? (
                <button type="button" className="tour-stop__pick" onClick={() => choose(i, false)} aria-pressed={i === active}>
                  {s.title}
                </button>
              ) : (
                s.title
              )}
            </h3>
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
            {businesses?.[s.id] ? (
              <div className="mt-4">
                <BusinessCard business={businesses[s.id]!} compact />
              </div>
            ) : null}
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
