"use client";

import Link from "next/link";
import { useRef } from "react";
import { useSurfaceOptional } from "@elkdonis/cms-ui/surface";
import { tourDescriptor } from "@/components/tours/tour-popup";
import { tourStageDescriptor } from "@/components/tours/stage/tour-stage-popup";
import type { TourDeparture } from "@elkdonis/commerce/server";
import type { Tour } from "@/lib/tours";
import { formatDeparture, formatDuration, formatPrice } from "@/lib/tour-format";

/**
 * A tour on the index and the landing page. With a film, hovering the picture plays it (muted).
 * On a phone a tap follows the link. Elsewhere a plain click opens the tour popup; ctrl/cmd-click, middle-click and
 * no-JS still follow the link to /tours/[slug].
 */
export function TourCard({ tour, next }: { tour: Tour; next?: TourDeparture | null }) {
  const length = formatDuration(tour.durationMinutes);
  const video = useRef<HTMLVideoElement>(null);
  const poster = tour.coverImageUrl ?? tour.film?.poster ?? null;
  const play = () => { void video.current?.play().catch(() => {}); };
  const stop = () => { const v = video.current; if (v) { v.pause(); v.currentTime = 0; } };
  const surface = useSurfaceOptional();
  const openPopup = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!surface || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    // Phone: no popup, the tap goes to the tour page (developer, 2026-11-21).
    if (typeof window !== "undefined" && window.matchMedia?.("(max-width: 767px)").matches) return;
    e.preventDefault();
    stop();
    // Desktop: the tour page's stage as the popup (2026-11-20). Narrower windows keep the Stops / Overview / Dates popup.
    const wide = typeof window !== "undefined" && window.matchMedia?.("(min-width: 1024px)").matches;
    surface.open(wide ? tourStageDescriptor({ ...tour, cover: poster }) : tourDescriptor(tour), e.currentTarget);
  };
  return (
    <Link
      href={`/tours/${tour.slug}`}
      prefetch={false}
      className="tour-card group block overflow-hidden border border-border bg-card"
      onClick={openPopup}
      onMouseEnter={tour.film ? play : undefined}
      onMouseLeave={tour.film ? stop : undefined}
      onFocus={tour.film ? play : undefined}
      onBlur={tour.film ? stop : undefined}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={poster}
            alt=""
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          />
        ) : null}
        {tour.film && (
          <video
            ref={video}
            src={tour.film.url720 ?? tour.film.url}
            muted
            loop
            playsInline
            preload="none"
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-focus-visible:opacity-100"
          />
        )}
        {/* The poster and film are Google 3D tiles, cropped here: the credit the frame carries must stay visible. */}
        {tour.film && (
          <span className="absolute bottom-1 right-1.5 rounded-sm bg-black/55 px-1 text-[0.6rem] leading-4 text-white/90">Google · promotional</span>
        )}
      </div>
      <div className="p-5">
        <p className="tour-card-kicker font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground">
          {[length, tour.details.languages[0]].filter(Boolean).join(" · ") || "Tour"}
        </p>
        {/* data-words-from: where these words are kept, so the page editor can open that record's field (house-editor, double-click on a selected title). */}
        <h3 className="tour-card-title mt-1 font-serif text-xl leading-snug group-hover:underline" data-words-from={`record:tour:${tour.id}:title`}>{tour.title}</h3>
        {tour.excerpt && <p className="tour-card-excerpt mt-2 line-clamp-3 text-sm text-muted-foreground" data-words-from={`record:tour:${tour.id}:excerpt`}>{tour.excerpt}</p>}
        <div className="mt-4 flex items-baseline justify-between gap-3 text-sm">
          <span className="tour-card-price font-medium">{formatPrice(tour.price, tour.currency)}</span>
          <span className="tour-card-next text-muted-foreground">
            {next ? `Next: ${formatDeparture(next.startsAt)}` : "Dates coming"}
          </span>
        </div>
      </div>
    </Link>
  );
}
