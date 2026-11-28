"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { TourStop } from "@elkdonis/commerce/server";
import { setStopExcerptAction } from "@/lib/stop-note-actions";
import { saveRouteViaAction, saveStopsAction, saveTourAction, setTourStatusAction } from "@/lib/tour-actions";
import { getTourSheet, listEditableTourSheet, type TourSheet } from "@/lib/office-actions";
import { blankDraft, fromStop, toInput, type StopDraft } from "@/components/manage/tour-builder/draft";
import { blankTourDraft, draftFromTour, numOrNull, type Narratives, type TourDraft } from "./types";
import type { Via } from "./route-edit-map";

type LngLat = [number, number];

/** What a stops save would write, for telling whether there is anything to save. */
export const stopsKey = (list: StopDraft[], lines: Narratives) => JSON.stringify(list.map((s) => [toInput(s), (lines[s.key] ?? "").trim()]));

/**
 * A tour being edited: its fields, stops, stop lines and route, loaded from getTourSheet and saved with saveTourAction /
 * saveStopsAction / setStopExcerptAction / saveRouteViaAction (2026-11-26, moved out of CreateTourPopup so the wizard,
 * the edit suite and the stage's edit mode share one load-and-save path). Saves only what changed; on a published tour
 * a save goes to the live page.
 */
export function useTourEditor({ initialId, onTourId }: { initialId: string | null; onTourId?: (id: string) => void }) {
  const router = useRouter();
  const [tourId, setTourId] = React.useState<string | null>(initialId);
  const [slug, setSlug] = React.useState<string>("");
  const [status, setStatus] = React.useState<string>("draft");
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

  /**
   * Saves the stops and their lines. `next` saves that list (and lines) instead of the current state, for a caller that
   * changes the stops and saves in one go (the stage's edit mode); it also becomes the editor's state.
   */
  const stopsNow = stops;
  const narrativesNow = narratives;
  async function saveStops(next?: { stops?: StopDraft[]; narratives?: Narratives }): Promise<boolean> {
    if (!tourId) return false;
    const stops = next?.stops ?? stopsNow;
    const narratives = next?.narratives ?? narrativesNow;
    if (next?.stops) setStops(next.stops);
    if (next?.narratives) setNarratives(next.narratives);
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

  return {
    tourId, slug, status, published, archived, loading, saving, savedAt, choices, rules,
    draft, setDraft, set, draftDirty,
    stops, setStops, savedStops, stopsDirty,
    narratives, setNarratives, savedNarr,
    legs, routeSource, via,
    reload, openTour, saveTour, saveStops, changeVia, seedFirstStop, publish, unpublish,
  };
}

export type TourEditor = ReturnType<typeof useTourEditor>;
