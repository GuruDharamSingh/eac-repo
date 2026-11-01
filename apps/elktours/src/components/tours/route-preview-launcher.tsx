"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Play } from "lucide-react";
import type { TourStop } from "@elkdonis/commerce/server";
import type { TourRoute } from "@/lib/tours";
import "./tour-story.css";

const RoutePreview = dynamic(() => import("@/components/tours/route-preview").then((m) => m.RoutePreview), {
  ssr: false,
  loading: () => <div className="route-preview" />,
});

interface Props {
  title: string;
  stops: TourStop[];
  meetingPoint: { lat: number; lng: number; label?: string | null } | null;
  route: TourRoute | null;
  googleMapsKey: string | null;
  coverImageUrl: string | null;
  /** Hero placement: no heading above, a taller poster, title inside the poster. */
  hero?: boolean;
}

/**
 * The "Preview the route" band on a tour page: a poster with a play button
 * that mounts the player inline, and a "Full screen" that pins it over the
 * page (Escape or × closes). Mounting on demand keeps the map off pages
 * nobody plays; `?preview=1` in the URL opens it straight away.
 */
export function RoutePreviewLauncher(p: Props) {
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("preview") === "1") setOpen(true);
  }, []);
  useEffect(() => {
    if (!full) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [full]);

  const heroClass = p.hero ? " route-preview--hero" : "";
  return (
    <div>
      {!p.hero && (
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <h2 className="font-serif text-2xl">Preview the route</h2>
            <p className="mt-1 text-sm text-muted-foreground">A flight along the walk, stop by stop. Press play, or click a stop.</p>
          </div>
          {open && !full && (
            <button type="button" className="text-sm underline underline-offset-4" onClick={() => setFull(true)}>Full screen</button>
          )}
        </div>
      )}
      <div className={p.hero ? "relative" : "mt-4"}>
        {p.hero && open && !full && (
          <button type="button" className="absolute right-3 top-3 z-10 rounded bg-background/80 px-2 py-1 text-xs backdrop-blur" onClick={() => setFull(true)}>Full screen</button>
        )}
        {!open ? (
          <button type="button" onClick={() => setOpen(true)} className={`route-preview group block w-full text-left${heroClass}`}>
            {p.coverImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.coverImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70 transition-transform duration-700 group-hover:scale-[1.02]" />
            )}
            <span className="route-preview__poster-shade" />
            <span className="route-preview__start"><Play className="size-6" /> Preview the route</span>
            {p.hero && <span className="route-preview__poster-caption">{p.stops.filter((s) => s.lat != null).length} stops · a flight along the walk, stop by stop</span>}
          </button>
        ) : full ? (
          <div className="route-preview route-preview--full">
            <RoutePreview {...p} onClose={() => setFull(false)} />
          </div>
        ) : (
          <div className={`route-preview${heroClass}`}><RoutePreview {...p} /></div>
        )}
      </div>
    </div>
  );
}
