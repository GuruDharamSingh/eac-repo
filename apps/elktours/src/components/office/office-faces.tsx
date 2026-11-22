"use client";

import * as React from "react";
import { SurfaceCard, SurfaceFrame, type SurfaceDescriptor } from "@elkdonis/cms-ui/surface";
import { scheduleTourDescriptor } from "@/components/office/schedule-tour-popup";
import { addPlaceDescriptor } from "@/components/office/add-place-popup";
import { createTourDescriptor } from "@/components/office/create-tour/create-tour-popup";
import { availabilityDescriptor } from "@/components/office/availability-popup";
import { takesDescriptor } from "@/components/office/takes-popup";

/**
 * The hub's Office band (2026-11-19): the staff tasks as cards that open popups over the hub, on a phone and a
 * desktop alike. /manage pages stay as the full editors the popups link to. Built: Offer availability, Offer a tour, Create a tour, Add a place, Personal takes.
 * Create a tour opens the wizard. Cards not built yet are shown disabled ("Coming soon");
 * plan in docs/open/ELKTOURS_OFFICE_HUB_2026-11-19.md.
 */

export function OfficeFaces() {
  return (
    <>
      <SurfaceCard
        kind="event"
        glyph="◷"
        title="Offer availability"
        blurb="Say which days and weeks you are free to guide or host, and alert the office."
        surface={availabilityDescriptor}
      />
      <SurfaceCard
        kind="event"
        glyph="▦"
        title="Offer a tour"
        blurb="Choose a tour, click days on the calendar and add start times. Dated tours appear on the Tours page."
        surface={scheduleTourDescriptor}
      />
      <SurfaceCard
        kind="event"
        glyph="⌖"
        title="Create a tour"
        blurb="City, title and meeting point; then the route of places; then the pictures for each stop."
        surface={createTourDescriptor()}
      />
      <SurfaceCard
        kind="service"
        glyph="✦"
        kicker="Coming soon"
        title="Add an experience"
        blurb="An artist's visit or workshop on a tour stop."
        disabled
      />
      <SurfaceCard
        kind="service"
        glyph="◉"
        title="Add a place"
        blurb="Search an establishment or drop a pin; then its copy, notes, tags and website."
        surface={addPlaceDescriptor}
      />
      <SurfaceCard
        kind="event"
        glyph="✎"
        title="Personal takes on a tour"
        blurb="Your own notes per stop, shown on the tour's details when you lead it."
        surface={takesDescriptor}
      />
    </>
  );
}

/** Body of the `office-soon` popup. */
export function OfficeSoonPopup({ descriptor }: { descriptor: Extract<SurfaceDescriptor, { type: "custom" }> }) {
  const line = typeof descriptor.props?.line === "string" ? descriptor.props.line : "";
  const href = typeof descriptor.props?.href === "string" ? descriptor.props.href : null;
  const hrefLabel = typeof descriptor.props?.hrefLabel === "string" ? descriptor.props.hrefLabel : "Open";
  return (
    <SurfaceFrame kind="neutral" kicker="Office" title={descriptor.title ?? "Office"} actions={href ? [{ label: hrefLabel, href, primary: true }] : []}>
      <p className="text-sm">{line}</p>
    </SurfaceFrame>
  );
}
