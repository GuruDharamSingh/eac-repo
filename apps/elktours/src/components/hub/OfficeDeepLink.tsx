"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useSurfaceOptional, type SurfaceDescriptor } from "@elkdonis/cms-ui/surface";
import { OFFICE_PARAM, stepNumber } from "@/lib/office-links";
import { createTourDescriptor } from "@/components/office/create-tour/create-tour-popup";
import { scheduleTourDescriptor } from "@/components/office/schedule-tour-popup";
import { addPlaceDescriptor } from "@/components/office/add-place-popup";
import { availabilityDescriptor } from "@/components/office/availability-popup";
import { takesDescriptor } from "@/components/office/takes-popup";

const SAFE_ID = /^[A-Za-z0-9_-]{1,50}$/;

function descriptorFor(key: string, tour: string | null, step: string | null): SurfaceDescriptor | null {
  const tourId = tour && SAFE_ID.test(tour) ? tour : undefined;
  switch (key) {
    case "create-tour":
      return createTourDescriptor(tourId, tourId ? stepNumber(step) : undefined);
    case "schedule":
      return tourId ? { type: "custom", key: "office-schedule", title: "Offer a tour", kind: "event", size: "wide", props: { tourId } } : scheduleTourDescriptor;
    case "add-place":
      return addPlaceDescriptor;
    case "availability":
      return availabilityDescriptor;
    case "takes":
      return takesDescriptor;
    default:
      return null;
  }
}

/**
 * `/hub?office=<key>&tour=<id>&step=route` opens that Office card's popup on arrival (lib/office-links.ts). Editors
 * only; the popups' own actions re-check the role. The parameters are removed from the address once handled, so a
 * reload does not reopen the popup.
 */
export function OfficeDeepLink({ canEdit }: { canEdit: boolean }) {
  const surface = useSurfaceOptional();
  const open = surface?.open;
  const pathname = usePathname();
  const params = useSearchParams();
  const handled = React.useRef<string | null>(null);
  const search = params.toString();

  React.useEffect(() => {
    if (pathname !== "/hub" || !canEdit || !open) return;
    const key = params.get(OFFICE_PARAM);
    if (!key || handled.current === search) return;
    handled.current = search;
    const d = descriptorFor(key, params.get("tour"), params.get("step"));
    if (d) open(d);
    const next = new URLSearchParams(search);
    for (const k of [OFFICE_PARAM, "tour", "step"]) next.delete(k);
    const q = next.toString();
    window.history.replaceState(window.history.state, "", q ? `/hub?${q}` : "/hub");
  }, [pathname, canEdit, open, params, search]);

  return null;
}
