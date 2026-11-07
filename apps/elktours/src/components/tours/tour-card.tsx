"use client";

import Link from "next/link";
import { useRef } from "react";
import { useSurfaceOptional } from "@elkdonis/cms-ui/surface";
import { tourDescriptor } from "@/components/tours/tour-popup";
import type { TourDeparture } from "@elkdonis/commerce/server";
import type { Tour } from "@/lib/tours";
import { formatDeparture, formatDuration, formatPrice } from "@/lib/tour-format";

/**
 * A tour on the index and the landing page. With a film, hovering the picture plays it (muted).
 * A plain click opens the tour popup (Overview · Stops · Dates); ctrl/cmd-click, middle-click and
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
    e.preventDefault();
    stop();
    surface.open(tourDescriptor(tour), e.currentTarget);
  };
  return (
    <Link
      href={`/tours/${tour.slug}`}
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
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground">
          {[length, tour.details.languages[0]].filter(Boolean).join(" · ") || "Tour"}
        </p>
        <h3 className="mt-1 font-serif text-xl leading-snug group-hover:underline">{tour.title}</h3>
        {tour.excerpt && <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{tour.excerpt}</p>}
        <div className="mt-4 flex items-baseline justify-between gap-3 text-sm">
          <span className="font-medium">{formatPrice(tour.price, tour.currency)}</span>
          <span className="text-muted-foreground">
            {next ? `Next: ${formatDeparture(next.startsAt)}` : "Dates coming"}
          </span>
        </div>
      </div>
    </Link>
  );
}
