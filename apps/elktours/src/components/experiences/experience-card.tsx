"use client";

import * as React from "react";
import { useSurfaceOptional } from "@elkdonis/cms-ui/surface";
import { formatDuration, formatPrice } from "@/lib/tour-format";
import { ArtistChip } from "./people-chips";
import { FORMAT_LABEL, placeLabel, type ExperienceView } from "./types";

/**
 * An experience on the listing (and anywhere else that shows one): cover,
 * title, who it is with, format and place.
 *
 * It is a real link to /experiences/[slug]. A plain click opens the shared
 * `experience` popup instead (registered by the host in HubSurfaces); a
 * modified click (new tab, ctrl/cmd), no surface provider, or no `experience`
 * surface registered yet all fall through to the link.
 */
export function ExperienceCard({ experience: e }: { experience: ExperienceView }) {
  const surface = useSurfaceOptional();
  const href = `/experiences/${e.slug}`;
  const facts = [FORMAT_LABEL[e.format], formatDuration(e.durationMinutes)].filter(Boolean).join(" · ");
  const place = placeLabel(e);

  function onClick(ev: React.MouseEvent<HTMLAnchorElement>) {
    if (!surface || !surface.connectors.custom?.experience) return;
    if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    ev.preventDefault();
    surface.open(
      { type: "custom", key: "experience", title: e.title, kind: "service", size: "wide", props: { id: e.id, slug: e.slug } },
      ev.currentTarget
    );
  }

  return (
    <a href={href} onClick={onClick} className="group block overflow-hidden border border-border bg-card">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
        {e.coverImageUrl || e.images[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={e.coverImageUrl ?? e.images[0]}
            alt=""
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          />
        ) : null}
        {e.status !== "published" && (
          <span className="absolute left-2 top-2 rounded bg-background/90 px-2 py-0.5 text-xs">Draft</span>
        )}
      </div>
      <div className="p-5">
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground">{facts || "Experience"}</p>
        <h3 className="mt-1 font-serif text-xl leading-snug group-hover:underline">{e.title}</h3>
        {e.excerpt && <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{e.excerpt}</p>}
        <div className="mt-4 flex items-center justify-between gap-3">
          <ArtistChip people={e.people} />
          {e.price != null && e.price > 0 && <span className="shrink-0 text-sm font-medium">{formatPrice(e.price, e.currency)}</span>}
        </div>
        {place && <p className="mt-2 truncate text-sm text-muted-foreground">{place}</p>}
      </div>
    </a>
  );
}
