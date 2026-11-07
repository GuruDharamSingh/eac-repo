"use client";

import * as React from "react";
import { ReviewsSection } from "@/components/reviews/reviews-section";
import type { TourPopupStop } from "@/components/surfaces/tour-popup-types";
import { PlaceLinks } from "@/components/places/place-links";
import { BusinessCard } from "@/components/places/business-card";

/**
 * A stop's expanded view in the tour popup: the fuller public copy, then
 * (when the stop comes from a catalogue place) the place's outbound links
 * and its reviews. Admin tools (excerpt edit, notes) are added by
 * `adminSlot` so this stays the public view.
 */
export function StopDetails({
  stop,
  adminSlot,
  linksSlot,
}: {
  stop: TourPopupStop;
  adminSlot?: React.ReactNode;
  linksSlot?: React.ReactNode;
}) {
  return (
    <div className="mt-2 space-y-3 border-t border-[color:var(--sf-line)] pt-3">
      {stop.body ? (
        // Sanitised on write (saveTourStops); the same HTML the tour page shows.
        <div className="prose prose-sm max-w-none text-[color:var(--sf-fg)]" dangerouslySetInnerHTML={{ __html: stop.body }} />
      ) : stop.excerpt ? (
        <p className="text-sm">{stop.excerpt}</p>
      ) : (
        <p className="text-sm text-[color:var(--sf-muted)]">No description of this stop yet.</p>
      )}
      {stop.business ? <BusinessCard business={stop.business} compact /> : null}
      {linksSlot ?? <PlaceLinks links={stop.links} compact />}
      {adminSlot}
      {stop.placeId && <ReviewsSection target={{ type: "place", id: stop.placeId }} title={`Reviews of ${stop.title}`} compact />}
    </div>
  );
}
