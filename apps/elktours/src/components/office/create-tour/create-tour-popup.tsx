"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SurfaceFrame, SurfaceSkeleton, useSurfaceOptional, type SurfaceAction, type SurfaceDescriptor } from "@elkdonis/cms-ui/surface";
import type { TourStop } from "@elkdonis/commerce/server";
import { setStopExcerptAction } from "@/lib/stop-note-actions";
import { saveRouteViaAction, saveStopsAction, saveTourAction, setTourStatusAction } from "@/lib/tour-actions";
import { getTourSheet, listEditableTourSheet, type TourSheet } from "@/lib/office-actions";
import { tourEditorHref } from "@/lib/office-links";
import { TourBookingRules } from "@/components/manage/tour-booking-rules";
import { blankDraft, fromStop, toInput, type StopDraft } from "@/components/manage/tour-builder/draft";
import { DescriptionStep } from "./description-step";
import { RouteStep } from "./route-step";
import { DetailsStep } from "./details-step";
import { blankTourDraft, draftFromTour, numOrNull, type Narratives, type TourDraft } from "./types";
import type { Via } from "./route-edit-map";

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
type LngLat = [number, number];

const STEP_KEY: Record<Step, "description" | "route" | "details"> = { 1: "description", 2: "route", 3: "details" };

/** What a stops save would write, for telling whether there is anything to save. */
const stopsKey = (list: StopDraft[], lines: Narratives) => JSON.stringify(list.map((s) => [toInput(s), (lines[s.key] ?? "").trim()]));

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
  const [choices, setChoices] = React.useState<Array<{ id: string; title: string; published: boolean }>>([]);
  /** The tour's fields and stops as last read or saved, to tell whether there is anything to save. */
  const [savedDraft, setSavedDraft] = React.useState("");
  const [savedStopsKey, setSavedStopsKey] = React.useState("");
  const [rules, setRules] = React.useState<{ type: TourSheet["tour"]["tourType"]; defaults: TourSheet["bookingDefaults"] } | null>(null);

  const set = React.useCallback(<K extends keyof TourDraft>(k: K, v: TourDraft[K]) => setDraft((d) => ({ ...d, [k]: v })), []);

  const reload = React.useCallback(async (id: string, opts: { fields?: boolean; narratives?: boolean } = {}) => {
    const sheet = await getTourSheet(id).catch(() => null);
    if (!sheet) {
      toast.error("That tour could not be opened.");
      return null;
    }
    setSlug(sheet.tour.slug);
    setStatus(sheet.tour.status);
    if (opts.fields) {
      const fields = draftFromTour(sheet.tour);
      setDraft(fields);
      setSavedDraft(JSON.stringify(fields));
      setRules({ type: sheet.tour.tourType, defaults: sheet.bookingDefaults });
    }
    setSavedStops(sheet.stops);
    setStops(sheet.stops.map((s) => fromStop(s)));
    setSavedStopsKey(stopsKey(sheet.stops.map((s) => fromStop(s)), sheet.excerpts ?? {}));
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
      listEditableTourSheet()
        .then((d) => setChoices(d))
        .catch(() => setChoices([]));
    }
  }, [initialId, reload]);

  async function openTour(id: string) {
    if (!id) return;
    setLoading(true);
    setTourId(id);
    onTourId?.(id);
    await reload(id, { fields: true });
    setLoading(false);
  }

  const published = status === "published";
  const archived = status === "archived";
  const draftDirty = !tourId || JSON.stringify(draft) !== savedDraft;
  const stopsDirty = stopsKey(stops, narratives) !== savedStopsKey;

  /** Saves the tour's own fields; returns its id, or null when refused. */
  async function saveTour(publish = false): Promise<string | null> {
    // Saving would turn an archived tour back into a draft.
    if (archived) return null;
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
    const created = !tourId;
    setTourId(r.id);
    setSlug(r.slug);
    if (publish) setStatus("published");
    setSavedAt(new Date());
    setSavedDraft(JSON.stringify(draft));
    if (created) {
      onTourId?.(r.id);
      const sheet = await getTourSheet(r.id).catch(() => null);
      if (sheet) setRules({ type: sheet.tour.tourType, defaults: sheet.bookingDefaults });
    }
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
      /** What the database holds afterwards, by stop id: a line that failed to write keeps its old text. */
      const stored: Narratives = {};
      let failed = 0;
      for (let i = 0; i < order.length; i++) {
        const id = sheet.stops[i]!.id;
        const { key, text } = order[i]!;
        next[id] = text;
        stored[id] = text;
        if (text === (before[key] ?? "").trim()) continue;
        const w = await setStopExcerptAction(id, text || null).catch(() => ({ ok: false as const, error: "" }));
        if (!w.ok) {
          failed++;
          next[id] = text; // kept in the box; still differs from savedNarr, so the next save retries
          stored[id] = before[key] ?? "";
          setSavedNarr((m) => ({ ...m, [id]: before[key] ?? "" }));
        } else {
          // The server normalises the line (plain text, whitespace collapsed): keep its form so it is not re-sent.
          next[id] = w.excerpt ?? "";
          stored[id] = next[id]!;
          setSavedNarr((m) => ({ ...m, [id]: w.excerpt ?? "" }));
        }
      }
      setNarratives(next);
      setSavedStopsKey(stopsKey(sheet.stops.map((s) => fromStop(s)), stored));
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

  /** Stop 1 is the meeting point: seeded from it when a draft's route is still empty (never added to a live tour). */
  function seedFirstStop() {
    const lat = numOrNull(draft.meetingLat);
    const lng = numOrNull(draft.meetingLng);
    if (published || stops.length > 0 || lat == null || lng == null) return;
    setStops([{ ...blankDraft(), title: draft.location || "Meeting point", lat: String(lat), lng: String(lng), placeId: draft.meetingPlaceId }]);
  }

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

  async function publish() {
    if (!(await saveTour(true))) return;
    toast.success("Published. It appears on the Tours page once it has dates.");
    router.refresh();
  }

  async function unpublish() {
    if (!tourId || !window.confirm("Take this tour off the site? It becomes a draft; its dates and bookings are kept.")) return;
    setSaving(true);
    const r = await setTourStatusAction(tourId, "draft").catch(() => ({ ok: false as const, error: "Could not unpublish." }));
    setSaving(false);
    if (!r.ok) return void toast.error(r.error);
    setStatus("draft");
    toast.success("Unpublished. It is a draft again.");
    router.refresh();
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
