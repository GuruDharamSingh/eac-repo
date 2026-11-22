"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SurfaceFrame, SurfaceSkeleton, useSurfaceOptional, type SurfaceAction, type SurfaceDescriptor } from "@elkdonis/cms-ui/surface";
import type { TourStop } from "@elkdonis/commerce/server";
import { setStopExcerptAction } from "@/lib/stop-note-actions";
import { saveRouteViaAction, saveStopsAction, saveTourAction } from "@/lib/tour-actions";
import { getTourSheet, listDraftTourSheet } from "@/lib/office-actions";
import { blankDraft, fromStop, toInput, type StopDraft } from "@/components/manage/tour-builder/draft";
import { scheduleTourDescriptor } from "@/components/office/schedule-tour-popup";
import { DescriptionStep } from "./description-step";
import { RouteStep } from "./route-step";
import { DetailsStep } from "./details-step";
import { blankTourDraft, draftFromTour, numOrNull, type Narratives, type TourDraft } from "./types";
import type { Via } from "./route-edit-map";

/** The hub card's descriptor (registered as `office-create-tour` in HubSurfaces). `props.tourId` continues a draft. */
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
type LngLat = [number, number];

/**
 * Create a tour (hub, 2026-11-19): a wizard in one popup, Description → Route → Details, back and forth.
 * The tour is saved as a draft when leaving Description (saveTourAction, which also gives it its booking
 * offer), the stops when leaving Route or asking for the walking route (saveStopsAction, which recomputes it),
 * and pictures as they are changed on Details. Publish puts it on the site; it is listed on /tours once it has
 * dates (Offer dates opens the schedule popup on top).
 */
export function CreateTourPopup({ descriptor }: { descriptor: Extract<SurfaceDescriptor, { type: "custom" }> }) {
  const router = useRouter();
  const surface = useSurfaceOptional();
  const initialId = typeof descriptor.props?.tourId === "string" ? descriptor.props.tourId : null;
  const [tourId, setTourId] = React.useState<string | null>(initialId);
  const [slug, setSlug] = React.useState<string>("");
  const [status, setStatus] = React.useState<string>("draft");
  // `props.step` (with a tourId) opens an existing tour on that step: the tour page's editor menu links here.
  const [step, setStep] = React.useState<Step>(() => {
    const s = descriptor.props?.step;
    return initialId && (s === 2 || s === 3) ? s : 1;
  });
  const [draft, setDraft] = React.useState<TourDraft>(blankTourDraft);
  const [stops, setStops] = React.useState<StopDraft[]>([]);
  /** The stops' lines for the tour page, by StopDraft.key; `savedNarr` is what the database holds, by stop id. */
  const [narratives, setNarratives] = React.useState<Narratives>({});
  const [savedNarr, setSavedNarr] = React.useState<Narratives>({});
  const [savedStops, setSavedStops] = React.useState<TourStop[]>([]);
  const [legs, setLegs] = React.useState<LngLat[][] | null>(null);
  const [routeSource, setRouteSource] = React.useState<"osrm" | "straight" | null>(null);
  const [via, setVia] = React.useState<Via>({});
  const [loading, setLoading] = React.useState(Boolean(initialId));
  const [saving, setSaving] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState<Date | null>(null);
  const [drafts, setDrafts] = React.useState<Array<{ id: string; title: string }>>([]);

  const set = React.useCallback(<K extends keyof TourDraft>(k: K, v: TourDraft[K]) => setDraft((d) => ({ ...d, [k]: v })), []);

  const reload = React.useCallback(async (id: string, opts: { fields?: boolean; narratives?: boolean } = {}) => {
    const sheet = await getTourSheet(id).catch(() => null);
    if (!sheet) {
      toast.error("That tour could not be opened.");
      return null;
    }
    setSlug(sheet.tour.slug);
    setStatus(sheet.tour.status);
    if (opts.fields) setDraft(draftFromTour(sheet.tour));
    setSavedStops(sheet.stops);
    setStops(sheet.stops.map((s) => fromStop(s)));
    setSavedNarr(sheet.excerpts ?? {});
    if (opts.narratives !== false) setNarratives(sheet.excerpts ?? {});
    setLegs((sheet.tour.details.route?.legs as LngLat[][] | undefined) ?? null);
    setRouteSource(sheet.tour.details.route?.source ?? null);
    setVia((sheet.tour.details.via as Via | null | undefined) ?? {});
    return sheet;
  }, []);

  React.useEffect(() => {
    if (initialId) {
      void reload(initialId, { fields: true }).finally(() => setLoading(false));
    } else {
      listDraftTourSheet()
        .then((d) => setDrafts(d))
        .catch(() => setDrafts([]));
    }
  }, [initialId, reload]);

  async function continueDraft(id: string) {
    if (!id) return;
    setLoading(true);
    setTourId(id);
    await reload(id, { fields: true });
    setLoading(false);
  }

  /** Saves the tour's own fields; returns its id, or null when refused. */
  async function saveTour(publish = false): Promise<string | null> {
    if (draft.title.trim().length < 2) {
      toast.error("Give the tour a title.");
      return null;
    }
    setSaving(true);
    const r = await saveTourAction(
      {
        title: draft.title,
        excerpt: draft.excerpt,
        body: draft.body,
        coverImageUrl: draft.coverImageUrl,
        price: draft.price,
        durationMinutes: draft.durationMinutes,
        location: draft.location,
        meetingLat: draft.meetingLat,
        meetingLng: draft.meetingLng,
        highlights: draft.highlights,
        includes: draft.includes,
        languages: draft.languages,
        maxParty: draft.maxParty,
        effort: draft.effort,
        city: draft.city,
        status: publish || status === "published" ? "published" : "draft",
      },
      tourId ?? undefined
    ).catch(() => ({ ok: false as const, error: "Could not save. Try again." }));
    setSaving(false);
    if (!r.ok) {
      toast.error(r.error);
      return null;
    }
    setTourId(r.id);
    setSlug(r.slug);
    if (publish) setStatus("published");
    setSavedAt(new Date());
    return r.id;
  }

  async function saveStops(): Promise<boolean> {
    if (!tourId) return false;
    const bad = stops.findIndex((s) => !s.title.trim());
    if (bad >= 0) {
      toast.error(`Stop ${bad + 1} needs a name.`);
      return false;
    }
    setSaving(true);
    const r = await saveStopsAction(tourId, stops.map(toInput)).catch(() => ({ ok: false as const, error: "Could not save the stops." }));
    if (!r.ok) {
      setSaving(false);
      toast.error(r.error);
      return false;
    }
    // The list was saved in this order and existing stops keep their ids, so the reloaded rows line up by position.
    // Lines are written by setStopExcerptAction (saveStopsAction leaves the column alone), only where they changed.
    const order = stops.map((s) => ({ key: s.key, text: (narratives[s.key] ?? "").trim() }));
    const before = savedNarr;
    const sheet = await reload(tourId, { narratives: false });
    if (sheet && sheet.stops.length === order.length) {
      const next: Narratives = {};
      let failed = 0;
      for (let i = 0; i < order.length; i++) {
        const id = sheet.stops[i]!.id;
        const { key, text } = order[i]!;
        next[id] = text;
        if (text === (before[key] ?? "").trim()) continue;
        const w = await setStopExcerptAction(id, text || null).catch(() => ({ ok: false as const, error: "" }));
        if (!w.ok) {
          failed++;
          next[id] = text; // kept in the box; still differs from savedNarr, so the next save retries
          setSavedNarr((m) => ({ ...m, [id]: before[key] ?? "" }));
        } else {
          // The server normalises the line (plain text, whitespace collapsed): keep its form so it is not re-sent.
          next[id] = w.excerpt ?? "";
          setSavedNarr((m) => ({ ...m, [id]: w.excerpt ?? "" }));
        }
      }
      setNarratives(next);
      if (failed) toast.error(`${failed} stop line${failed === 1 ? "" : "s"} could not be saved. Save the stops again.`);
    } else if (sheet) {
      setNarratives(sheet.excerpts ?? {});
      toast.error("The stops changed while saving; check their lines.");
    } else {
      // Stops saved but could not be read back: keep the typed lines (still keyed as before) for the next save.
      toast.error("The stops were saved, but their lines were not. Save the stops again.");
    }
    setSaving(false);
    setSavedAt(new Date());
    router.refresh();
    return true;
  }

  /** Save the dragged path's bends; the server reroutes through them. */
  async function changeVia(next: Via) {
    if (!tourId) return;
    setVia(next);
    setSaving(true);
    const r = await saveRouteViaAction(tourId, next).catch(() => ({ ok: false as const, error: "Could not save the path." }));
    setSaving(false);
    if (!r.ok) return void toast.error(r.error);
    setLegs((r.route?.legs as LngLat[][] | undefined) ?? null);
    setRouteSource(r.route?.source ?? null);
    setSavedAt(new Date());
  }

  /** Stop 1 is the meeting point: seeded from it when the route is still empty. */
  function seedFirstStop() {
    const lat = numOrNull(draft.meetingLat);
    const lng = numOrNull(draft.meetingLng);
    if (stops.length > 0 || lat == null || lng == null) return;
    setStops([{ ...blankDraft(), title: draft.location || "Meeting point", lat: String(lat), lng: String(lng), placeId: draft.meetingPlaceId }]);
  }

  async function go(to: Step) {
    if (to === step) return;
    let id = tourId;
    if (step === 1) {
      id = await saveTour();
      if (!id) return;
    }
    // Removing or reordering stops marks none dirty: save the list whenever Route is left.
    if (step === 2 && id && !(await saveStops())) return;
    if (to >= 2 && !id) return;
    if (to === 2) seedFirstStop();
    setStep(to);
  }

  async function publish() {
    if (!(await saveTour(true))) return;
    toast.success("Published. It appears on the Tours page once it has dates.");
    router.refresh();
  }

  if (loading) {
    return (
      <SurfaceFrame kind="event" kicker="Office" title="Create a tour">
        <SurfaceSkeleton block />
      </SurfaceFrame>
    );
  }

  const canRoute = Boolean(tourId) || (draft.title.trim().length >= 2 && draft.meetingLat !== "");
  const actions: SurfaceAction[] = [];
  if (step > 1) actions.push({ label: "Back", quiet: true, onClick: () => go((step - 1) as Step) });
  if (step === 1) actions.push({ label: saving ? "Saving…" : "Save draft", quiet: true, disabled: saving, onClick: () => void saveTour().then((id) => id && toast.success("Draft saved")) });
  if (step === 2) actions.push({ label: saving ? "Saving…" : "Save stops", quiet: true, disabled: saving || !tourId, onClick: () => void saveStops().then((ok) => ok && toast.success("Stops saved")) });
  if (step < 3) {
    actions.push({ label: step === 1 ? "Next: Route" : "Next: Details", primary: true, disabled: saving || (step === 1 && !canRoute), onClick: () => go((step + 1) as Step) });
  } else if (status === "published") {
    actions.push({ label: "Offer dates", primary: true, onClick: () => surface?.push(scheduleTourDescriptor) });
  } else {
    actions.push({ label: saving ? "Publishing…" : "Publish tour", primary: true, disabled: saving, onClick: publish });
  }

  const statusLine = saving
    ? "Saving…"
    : savedAt
      ? `${status === "published" ? "Published" : "Draft"} saved ${savedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
      : tourId
        ? status === "published"
          ? "Published tour"
          : "Draft"
        : step === 1 && !canRoute
          ? "A title and a meeting point, then Next"
          : "Not saved yet";

  return (
    <SurfaceFrame kind="event" kicker="Office" title={draft.title.trim() || "Create a tour"} actions={actions} status={statusLine}>
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
        {!tourId && drafts.length > 0 && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Continue a draft
            <select defaultValue="" onChange={(e) => void continueDraft(e.target.value)} className="rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground">
              <option value="">Choose…</option>
              {drafts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {step === 1 && <DescriptionStep draft={draft} set={set} />}
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
