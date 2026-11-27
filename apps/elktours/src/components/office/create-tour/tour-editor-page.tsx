"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SurfaceChromeProvider, type SurfaceDescriptor } from "@elkdonis/cms-ui/surface";
import { CreateTourPopup, createTourDescriptor } from "./create-tour-popup";

/**
 * The Create a tour frame as its own page (/hub/tours/edit, 2026-11-26): the same wizard and surface styles as the
 * popup, in the page flow. The tour in hand is kept in the address (`?tour=`), replaced without a navigation so a
 * save does not remount the wizard. ✕ returns to the hub.
 */
export function TourEditorPage({ tourId, step }: { tourId?: string; step?: 1 | 2 | 3 }) {
  const router = useRouter();
  // Fixed at first render: a refresh after a save passes new props and must not reload the form.
  const [descriptor] = React.useState(() => createTourDescriptor(tourId, step) as Extract<SurfaceDescriptor, { type: "custom" }>);
  const keepInAddress = React.useCallback((id: string) => {
    window.history.replaceState(window.history.state, "", `/hub/tours/edit?${new URLSearchParams({ tour: id })}`);
  }, []);
  const chrome = React.useMemo(() => ({ onClose: () => router.push("/hub") }), [router]);

  return (
    <main className="mx-auto w-full max-w-6xl px-3 py-6 sm:px-5">
      <div className="eac-surface-page" data-kind="event">
        <div className="eac-surface-page-crumb">
          <Link href="/hub">← Hub</Link>
        </div>
        <article className="eac-surface-panel eac-surface-panel--page">
          <SurfaceChromeProvider value={chrome}>
            <CreateTourPopup descriptor={descriptor} page onTourId={keepInAddress} />
          </SurfaceChromeProvider>
        </article>
      </div>
    </main>
  );
}
