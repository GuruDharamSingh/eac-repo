"use client";

import * as React from "react";
import { toast } from "sonner";
import { SurfaceFrame, SurfaceSkeleton, useSurfaceOptional, type SurfaceAction, type SurfaceDescriptor } from "@elkdonis/cms-ui/surface";
import { tourEditorHref } from "@/lib/office-links";
import { TourBookingRules } from "@/components/manage/tour-booking-rules";
import { DescriptionStep } from "./description-step";
import { RouteStep } from "./route-step";
import { DetailsStep } from "./details-step";
import { numOrNull } from "./types";
import { useTourEditor } from "./use-tour-editor";

/** The hub card's descriptor (registered as `office-create-tour` in HubSurfaces). `props.tourId` opens that tour, draft or published. */
export function createTourDescriptor(tourId?: string, step?: 1 | 2 | 3): SurfaceDescriptor {
  return {
    type: "custom",
    key: "office-create-tour",
    title: tourId ? "Edit tour" : "Create a tour",
    kind: "event",
    size: "full",
    ...(tourId ? { props: { tourId, ...(step ? { step } : {}) } } : {}),
  };
}

type Step = 1 | 2 | 3;
const STEPS: Array<[Step, string]> = [
  [1, "Description"],
  [2, "Route"],
  [3, "Details"],
];
const STEP_KEY: Record<Step, "description" | "route" | "details"> = { 1: "description", 2: "route", 3: "details" };

/**
 * Create or edit a tour (hub, 2026-11-19; published tours too since 2026-11-26): a wizard, Description → Route →
 * Details, back and forth, in a popup or as a page (`page`, /hub/tours/edit).
 * Leaving Description saves the tour (saveTourAction, which also gives a new one its booking offer), leaving Route
 * or asking for the walking route saves the stops (saveStopsAction, which recomputes it); both only when something
 * changed. Pictures save as they are changed on Details. On a published tour those saves go to the live page, and
 * the tour keeps its address when renamed. Publish puts a draft on the site; it is listed on /tours once it has
 * dates (Offer dates opens the schedule popup on top).
 */
export function CreateTourPopup({
  descriptor,
  page = false,
  onTourId,
}: {
  descriptor: Extract<SurfaceDescriptor, { type: "custom" }>;
  /** Drawn as its own page rather than in the popup. */
  page?: boolean;
  /** Told which tour is open (a new one after its first save, or one picked), so a page can keep it in the address. */
  onTourId?: (id: string) => void;
}) {
  const surface = useSurfaceOptional();
  const initialId = typeof descriptor.props?.tourId === "string" ? descriptor.props.tourId : null;
  // `props.step` (with a tourId) opens an existing tour on that step: the tour page's editor menu links here.
  const [step, setStep] = React.useState<Step>(() => {
    const s = descriptor.props?.step;
    return initialId && (s === 2 || s === 3) ? s : 1;
  });
  const ed = useTourEditor({ initialId, onTourId });
  const {
    tourId, slug, published, archived, loading, saving, savedAt, choices, rules,
    draft, set, draftDirty, stops, setStops, savedStops, stopsDirty, narratives, setNarratives, savedNarr,
    legs, routeSource, via, openTour, saveTour, saveStops, changeVia, seedFirstStop, publish, unpublish,
  } = ed;

  async function go(to: Step) {
    if (to === step) return;
    let id = tourId;
    if (step === 1 && draftDirty) {
      id = await saveTour();
      if (!id) return;
      if (published) toast.success("Saved to the live page.");
    }
    // Removing or reordering stops marks no stop dirty, so the whole list is compared.
    if (step === 2 && id && stopsDirty) {
      if (!(await saveStops())) return;
      if (published) toast.success("Stops saved to the live page.");
    }
    if (to >= 2 && !id) return;
    if (to === 2) seedFirstStop();
    setStep(to);
  }

  if (loading) {
    return (
      <SurfaceFrame kind="event" kicker="Office" title={initialId || tourId ? "Edit tour" : "Create a tour"}>
        <SurfaceSkeleton block />
      </SurfaceFrame>
    );
  }

  if (archived) {
    return (
      <SurfaceFrame kind="event" kicker="Office" title={draft.title.trim() || "Edit tour"} actions={[{ label: "All tours", href: "/manage/tours" }]}>
        <p className="text-sm text-muted-foreground">This tour is archived. Publish or unpublish it from the tour list before editing it.</p>
      </SurfaceFrame>
    );
  }

  const canRoute = Boolean(tourId) || (draft.title.trim().length >= 2 && draft.meetingLat !== "");
  const actions: SurfaceAction[] = [];
  if (!page && tourId) actions.push({ label: "Open as page", quiet: true, href: tourEditorHref(tourId, STEP_KEY[step]) });
  if (tourId) actions.push({ label: "Open the suite", quiet: true, href: `/hub/tours/suite?tour=${encodeURIComponent(tourId)}` });
  if (published) actions.push({ label: "View", quiet: true, href: `/tours/${slug}` });
  if (published) actions.push({ label: "Unpublish", quiet: true, disabled: saving, onClick: unpublish });
  if (step > 1) actions.push({ label: "Back", quiet: true, onClick: () => go((step - 1) as Step) });
  if (step === 1) {
    actions.push({
      label: saving ? "Saving…" : published ? "Save changes" : "Save draft",
      quiet: true,
      disabled: saving || (published && !draftDirty),
      onClick: () => void saveTour().then((id) => id && toast.success(published ? "Saved to the live page." : "Draft saved")),
    });
  }
  if (step === 2) {
    actions.push({
      label: saving ? "Saving…" : "Save stops",
      quiet: true,
      disabled: saving || !tourId || (published && !stopsDirty),
      onClick: () => void saveStops().then((ok) => ok && toast.success(published ? "Stops saved to the live page." : "Stops saved")),
    });
  }
  if (step < 3) {
    actions.push({ label: step === 1 ? "Next: Route" : "Next: Details", primary: true, disabled: saving || (step === 1 && !canRoute), onClick: () => go((step + 1) as Step) });
  } else if (published) {
    actions.push({ label: "Offer dates", primary: true, onClick: () => surface?.push({ type: "custom", key: "office-schedule", title: "Offer a tour", kind: "event", size: "wide", ...(tourId ? { props: { tourId } } : {}) }) });
  } else {
    actions.push({ label: saving ? "Publishing…" : "Publish tour", primary: true, disabled: saving, onClick: publish });
  }

  const dirty = step === 1 ? draftDirty : step === 2 ? stopsDirty : false;
  const statusLine = saving
    ? "Saving…"
    : published && dirty
      ? "Live tour: unsaved changes go to the site when saved"
      : savedAt
        ? `${published ? "Published" : "Draft"} saved ${savedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
        : tourId
          ? published
            ? "Published tour"
            : "Draft"
          : step === 1 && !canRoute
            ? "A title and a meeting point, then Next"
            : "Not saved yet";

  return (
    <SurfaceFrame kind="event" kicker="Office" title={draft.title.trim() || (tourId ? "Edit tour" : "Create a tour")} actions={actions} status={statusLine}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <ol className="flex gap-2 text-xs" aria-label="Steps">
          {STEPS.map(([n, name]) => (
            <li key={n}>
              <button
                type="button"
                onClick={() => go(n)}
                disabled={saving || (n > 1 && !tourId && !(n === 2 && canRoute))}
                aria-current={n === step ? "step" : undefined}
                className={`rounded-full border px-3 py-1 ${n === step ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground disabled:opacity-40"}`}
              >
                {n} · {name}
              </button>
            </li>
          ))}
        </ol>
        {!tourId && choices.length > 0 && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Edit a tour
            <select defaultValue="" onChange={(e) => void openTour(e.target.value)} className="max-w-[16rem] rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground">
              <option value="">Choose…</option>
              {(
                [
                  ["Drafts", choices.filter((c) => !c.published)],
                  ["Published", choices.filter((c) => c.published)],
                ] as const
              ).map(([group, list]) =>
                list.length ? (
                  <optgroup key={group} label={group}>
                    {list.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </optgroup>
                ) : null,
              )}
            </select>
          </label>
        )}
      </div>

      {step === 1 && <DescriptionStep draft={draft} set={set} tourId={tourId} />}
      {step === 1 && tourId && rules && (
        <details className="mt-5 rounded-md border border-border p-3 text-sm">
          <summary className="cursor-pointer select-none font-medium">Tour type, booking rules and more</summary>
          <div className="mt-3 max-w-md">
            <TourBookingRules key={tourId} tourId={tourId} type={rules.type ?? null} defaults={rules.defaults} />
          </div>
          <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1">
            {(
              [
                ["Pictures and files", `/manage/tours/${tourId}/assets`],
                ["Fly-over film", `/manage/tours/${tourId}/flyover`],
                ["Collaborate", `/manage/tours/${tourId}/collaborate`],
                ["Guide notes", `/manage/tours/${tourId}/notes`],
              ] as const
            ).map(([text, href]) => (
              <a key={href} href={href} className="underline underline-offset-4">
                {text}
              </a>
            ))}
          </p>
        </details>
      )}
      {step === 2 && (
        <RouteStep
          stops={stops}
          setStops={setStops}
          narratives={narratives}
          setNarratives={setNarratives}
          legs={legs}
          routeSource={routeSource}
          onWorkOutRoute={() => void saveStops()}
          saving={saving}
          meeting={numOrNull(draft.meetingLat) != null && numOrNull(draft.meetingLng) != null ? { lat: numOrNull(draft.meetingLat)!, lng: numOrNull(draft.meetingLng)! } : null}
          via={via}
          onViaChange={(v) => void changeVia(v)}
        />
      )}
      {step === 3 && tourId && <DetailsStep tourId={tourId} slug={slug} stops={savedStops} narratives={savedNarr} onEditRoute={() => void go(2)} />}
    </SurfaceFrame>
  );
}
