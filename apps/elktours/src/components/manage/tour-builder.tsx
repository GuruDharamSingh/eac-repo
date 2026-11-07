"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Button } from "@elkdonis/primitives";
import { StreetView } from "@/components/tours/street-view";
import { saveStopsAction } from "@/lib/tour-actions";
import { pickSuggestionAction, updatePlaceFromStopAction } from "@/lib/place-actions";
import type { Experience, Place, PlaceSuggestion } from "@/lib/catalogue-types";
import { SortableStop } from "@/components/manage/tour-builder/sortable-stop";
import { BuilderPicker } from "@/components/manage/tour-builder/picker";
import {
  blankDraft, experienceFields, fromExperience, fromPlace, fromStop, num, placeFields, toInput,
  type BuilderStop, type StopDraft,
} from "@/components/manage/tour-builder/draft";
import "@/components/tours/tour-story.css";

const TourMap = dynamic(() => import("@/components/tours/tour-map").then((m) => m.TourMap), { ssr: false });

export interface TourBuilderProps {
  tourId: string;
  initial: BuilderStop[];
  googleMapsKey: string | null;
  /** Catalogue places, private notes stripped. */
  catalogue: Place[];
  experiences: Experience[];
}

const errorText = (e: unknown, fallback: string) =>
  e instanceof Error && !/Not implemented/.test(e.message) ? e.message : fallback;

/**
 * The tour builder: stops on the left (drag or Up/Down), the route map in the
 * middle, and a picker on the right. Picking copies the place's or
 * experience's fields into a new stop and records where it came from;
 * nothing propagates afterwards unless an editor presses Reset or Update.
 */
export function TourBuilder({ tourId, initial, googleMapsKey, catalogue, experiences }: TourBuilderProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [stops, setStops] = useState<StopDraft[]>(() => initial.map(fromStop));
  const [selectedKey, setSelectedKey] = useState<string | null>(initial[0]?.id ?? null);
  const [removed, setRemoved] = useState(false);
  // Extra catalogue rows created from suggestions during this session.
  const [created, setCreated] = useState<Place[]>([]);

  // After a save the server re-renders with fresh ids: take them.
  useEffect(() => {
    setStops(initial.map(fromStop));
    setRemoved(false);
    setSelectedKey((k) => (k && initial.some((s) => s.id === k) ? k : (initial[0]?.id ?? null)));
  }, [initial]);

  const dirty = removed || stops.some((s) => s.dirty) || stops.map((s) => s.id).join() !== initial.map((s) => s.id).join();
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const places = useMemo(() => [...catalogue, ...created.filter((c) => !catalogue.some((p) => p.id === c.id))], [catalogue, created]);
  const placeById = useMemo(() => new Map(places.map((p) => [p.id, p])), [places]);
  const expById = useMemo(() => new Map(experiences.map((e) => [e.id, e])), [experiences]);

  const selectedIndex = stops.findIndex((s) => s.key === selectedKey);
  const sel = selectedIndex >= 0 ? stops[selectedIndex] : undefined;

  const update = (key: string, patch: Partial<StopDraft>) =>
    setStops((list) => list.map((s) => {
      if (s.key !== key) return s;
      const changed = (Object.keys(patch) as (keyof StopDraft)[]).some((k) => s[k] !== patch[k]);
      return changed ? { ...s, ...patch, dirty: true } : s;
    }));
  const move = (i: number, dir: -1 | 1) =>
    setStops((list) => {
      const j = i + dir;
      if (j < 0 || j >= list.length) return list;
      return arrayMove(list, i, j);
    });
  const remove = (key: string) => {
    const s = stops.find((x) => x.key === key);
    if (s && (s.title || s.body) && !window.confirm(`Remove “${s.title || "this stop"}” from the tour?`)) return;
    setStops((list) => list.filter((x) => x.key !== key));
    if (s?.id) setRemoved(true);
    if (selectedKey === key) setSelectedKey(null);
  };
  const insert = (d: StopDraft) => {
    setStops((list) => {
      const at = selectedIndex >= 0 ? selectedIndex + 1 : list.length;
      return [...list.slice(0, at), d, ...list.slice(at)];
    });
    setSelectedKey(d.key);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setStops((list) => {
      const from = list.findIndex((s) => s.key === active.id);
      const to = list.findIndex((s) => s.key === over.id);
      return from < 0 || to < 0 ? list : arrayMove(list, from, to);
    });
  }

  async function pickSuggestion(item: PlaceSuggestion) {
    const known = item.placeId ? placeById.get(item.placeId) : undefined;
    if (known) return insert(fromPlace(known));
    // OSM rows become catalogue places; the stop copies the new place.
    const r = await pickSuggestionAction(item).catch((e: unknown) => ({ ok: false as const, error: errorText(e, "Could not add that place.") }));
    if (!r.ok) return void toast.error(r.error);
    setCreated((c) => [...c, r.place]);
    if (item.source !== "catalogue") toast.success(`${r.place.title} added to the catalogue`);
    insert(fromPlace(r.place));
  }

  function save() {
    for (const [i, s] of stops.entries()) {
      if (!s.title.trim()) {
        setSelectedKey(s.key);
        return void toast.error(`Stop ${i + 1} needs a title.`);
      }
    }
    start(async () => {
      const payload = stops.map(toInput);
      const r = await saveStopsAction(tourId, payload).catch((e: unknown) => ({ ok: false as const, error: errorText(e, "Could not save the stops.") }));
      if (!r.ok) return void toast.error(r.error);
      toast.success("Stops saved");
      router.refresh();
    });
  }

  function resetStop(s: StopDraft) {
    const exp = s.experienceId ? expById.get(s.experienceId) : undefined;
    const place = !exp && s.placeId ? placeById.get(s.placeId) : undefined;
    const fields = exp ? experienceFields(exp) : place ? placeFields(place) : null;
    if (!fields) return;
    if (!window.confirm("Replace this stop's title, copy and pose with the catalogue version? Guide notes, photo and minutes stay.")) return;
    update(s.key, fields);
  }

  function updateCatalogue(s: StopDraft) {
    if (!s.id) return;
    const stopId = s.id;
    const place = s.placeId ? placeById.get(s.placeId) : undefined;
    if (!window.confirm(`Overwrite the catalogue's “${place?.title ?? "place"}” with this stop's title, copy and pose? Other tours keep their own copies.`)) return;
    start(async () => {
      const r = await updatePlaceFromStopAction(stopId).catch((e: unknown) => ({ ok: false as const, error: errorText(e, "Could not update the catalogue.") }));
      if (!r.ok) return void toast.error(r.error);
      toast.success("Catalogue updated");
      router.refresh();
    });
  }

  // Map: placed stops only; indexes map back to list keys.
  const placed = stops
    .map((s, i) => ({ s, i, lat: num(s.lat), lng: num(s.lng) }))
    .filter((x): x is { s: StopDraft; i: number; lat: number; lng: number } => x.lat != null && x.lng != null);
  const mapStops = placed.map((x) => ({ id: x.s.key, title: x.s.title || `Stop ${x.i + 1}`, lat: x.lat, lng: x.lng }));
  const activeMapIndex = placed.findIndex((x) => x.s.key === selectedKey);
  const selPose = sel && num(sel.lat) != null && num(sel.lng) != null
    ? { lat: num(sel.lat)!, lng: num(sel.lng)!, heading: num(sel.heading), pitch: num(sel.pitch), fov: num(sel.fov) }
    : null;
  const anchor = activeMapIndex >= 0 ? placed[activeMapIndex]! : placed[placed.length - 1];
  const near = anchor ? { lat: anchor.lat, lng: anchor.lng } : null;
  const insertLabel = selectedIndex >= 0 ? `after stop ${selectedIndex + 1}` : "at the end";
  const usedPlaceIds = new Set(stops.map((s) => s.placeId).filter((v): v is string => Boolean(v)));
  const usedExperienceIds = new Set(stops.map((s) => s.experienceId).filter((v): v is string => Boolean(v)));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={save} disabled={pending || !dirty}>{pending ? "Saving…" : dirty ? "Save stops" : "Saved"}</Button>
        <span className="text-sm text-muted-foreground">
          {stops.length} stop{stops.length === 1 ? "" : "s"}{dirty ? " · unsaved changes" : ""}
        </span>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_19rem]">
        <section aria-label="Stops" className="min-w-0">
          {stops.length === 0 ? (
            <p className="border border-dashed border-border p-6 text-sm text-muted-foreground">
              No stops yet. Pick places from the right, in the order the tour visits them.
            </p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={stops.map((s) => s.key)} strategy={verticalListSortingStrategy}>
                <ol className="space-y-2">
                  {stops.map((s, i) => {
                    const exp = s.experienceId ? expById.get(s.experienceId) : undefined;
                    const place = s.placeId ? placeById.get(s.placeId) : undefined;
                    const canReset = Boolean(exp || (!s.experienceId && place));
                    // The server copies the saved stop, so unsaved edits would be lost or skipped.
                    const updateHint = !s.id || dirty
                        ? "Save the stops first, then update the catalogue."
                        : null;
                    return (
                      <SortableStop
                        key={s.key}
                        draft={s}
                        index={i}
                        count={stops.length}
                        selected={s.key === selectedKey}
                        linkLabel={exp?.title ?? place?.title ?? null}
                        onSelect={() => setSelectedKey(s.key === selectedKey ? null : s.key)}
                        onChange={(patch) => update(s.key, patch)}
                        onMove={(dir) => move(i, dir)}
                        onRemove={() => remove(s.key)}
                        onReset={canReset ? () => resetStop(s) : null}
                        onUpdateCatalogue={updateHint === null ? () => updateCatalogue(s) : null}
                        updateHint={updateHint}
                      />
                    );
                  })}
                </ol>
              </SortableContext>
            </DndContext>
          )}
        </section>

        <section aria-label="Map" className="space-y-3 lg:sticky lg:top-24 lg:self-start">
          <div className="tour-story__map h-80">
            <TourMap
              stops={mapStops}
              activeIndex={activeMapIndex}
              onSelect={(mi) => setSelectedKey(placed[mi]?.s.key ?? null)}
              className="h-full"
            />
          </div>
          <div className="tour-story__view h-52">
            <StreetView pose={selPose} imageUrl={sel?.imageUrl || null} title={sel?.title ?? ""} apiKey={googleMapsKey} className="h-full w-full" />
          </div>
        </section>

        <aside aria-label="Add a stop" className="lg:sticky lg:top-24 lg:self-start">
          <BuilderPicker
            catalogue={places}
            experiences={experiences}
            usedPlaceIds={usedPlaceIds}
            usedExperienceIds={usedExperienceIds}
            near={near}
            insertLabel={insertLabel}
            onPickPlace={(p) => insert(fromPlace(p))}
            onPickExperience={(e) => insert(fromExperience(e))}
            onPickSuggestion={pickSuggestion}
            onBlank={() => insert(blankDraft())}
            onCreatedLocation={({ place }) => {
              setCreated((c) => [...c, place]);
              insert(fromPlace(place));
            }}
          />
        </aside>
      </div>
    </div>
  );
}
