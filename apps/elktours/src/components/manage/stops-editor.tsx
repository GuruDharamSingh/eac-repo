"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type { TourStop } from "@elkdonis/commerce/server";
import { RichTextEditor } from "@elkdonis/cms-ui/editor";
import { MediaField } from "@/components/manage/media-field";
import { PlaceSearch } from "@/components/manage/place-search";
import { StreetView } from "@/components/tours/street-view";
import { saveStopsAction } from "@/lib/tour-actions";
import { Button, Input, Label } from "@elkdonis/primitives";
import "@/components/tours/tour-story.css";

const TourMap = dynamic(() => import("@/components/tours/tour-map").then((m) => m.TourMap), { ssr: false });

interface Draft {
  key: string;
  id: string | null;
  title: string;
  body: string;
  guideNotes: string;
  lat: string;
  lng: string;
  heading: string;
  pitch: string;
  fov: string;
  imageUrl: string;
  durationMinutes: string;
}

function fromStop(s: TourStop): Draft {
  return {
    key: s.id,
    id: s.id,
    title: s.title,
    body: s.body ?? "",
    guideNotes: s.guideNotes ?? "",
    lat: s.lat != null ? String(s.lat) : "",
    lng: s.lng != null ? String(s.lng) : "",
    heading: s.heading != null ? String(s.heading) : "",
    pitch: s.pitch != null ? String(s.pitch) : "",
    fov: s.fov != null ? String(s.fov) : "",
    imageUrl: s.imageUrl ?? "",
    durationMinutes: s.durationMinutes != null ? String(s.durationMinutes) : "",
  };
}

function blank(): Draft {
  return { key: `new-${Math.random().toString(36).slice(2)}`, id: null, title: "", body: "", guideNotes: "", lat: "", lng: "", heading: "", pitch: "", fov: "", imageUrl: "", durationMinutes: "" };
}

const num = (v: string) => (v.trim() === "" ? null : Number(v));

/**
 * The stops of a tour, in order. Each has a place (search → coordinates), a
 * Street View pose, a photo and a paragraph. The map on the right previews
 * the route; the Street View slot under it shows the selected stop as a
 * visitor will see it, so the heading can be tuned by eye.
 */
export function StopsEditor({ tourId, initial, googleMapsKey }: { tourId: string; initial: TourStop[]; googleMapsKey: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [stops, setStops] = useState<Draft[]>(initial.map(fromStop));
  const [selected, setSelected] = useState(0);

  const update = (i: number, patch: Partial<Draft>) =>
    setStops((list) => list.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const move = (i: number, dir: -1 | 1) =>
    setStops((list) => {
      const j = i + dir;
      if (j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j]!, next[i]!];
      setSelected(j);
      return next;
    });
  const remove = (i: number) => setStops((list) => list.filter((_, j) => j !== i));

  function save() {
    start(async () => {
      const r = await saveStopsAction(
        tourId,
        stops.map((s) => ({
          id: s.id,
          title: s.title,
          body: s.body,
          guideNotes: s.guideNotes,
          lat: num(s.lat),
          lng: num(s.lng),
          heading: num(s.heading),
          pitch: num(s.pitch),
          fov: num(s.fov),
          imageUrl: s.imageUrl || null,
          durationMinutes: num(s.durationMinutes),
        }))
      );
      if (!r.ok) return void toast.error(r.error);
      toast.success("Stops saved");
      router.refresh();
    });
  }

  const placed = stops
    .map((s, i) => ({ i, s, lat: num(s.lat), lng: num(s.lng) }))
    .filter((x) => x.lat != null && x.lng != null && Number.isFinite(x.lat) && Number.isFinite(x.lng));
  const mapStops = placed.map((x) => ({ id: x.s.key, title: x.s.title || `Stop ${x.i + 1}`, lat: x.lat!, lng: x.lng! }));
  const activeMapIndex = placed.findIndex((x) => x.i === selected);
  const sel = stops[selected];
  const selPose = sel && num(sel.lat) != null && num(sel.lng) != null
    ? { lat: num(sel.lat)!, lng: num(sel.lng)!, heading: num(sel.heading), pitch: num(sel.pitch), fov: num(sel.fov) }
    : null;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-4">
        {stops.length === 0 && (
          <p className="border border-dashed border-border p-6 text-sm text-muted-foreground">
            No stops yet. Add the places the tour visits, in order.
          </p>
        )}
        {stops.map((s, i) => (
          <details
            key={s.key}
            open={i === selected}
            onToggle={(e) => { if ((e.target as HTMLDetailsElement).open) setSelected(i); }}
            className="border border-border bg-card"
          >
            <summary className="flex cursor-pointer items-center gap-3 px-4 py-3">
              <span className="tour-pin is-active" style={{ transform: "none" }}>{i + 1}</span>
              <span className="flex-1 font-medium">{s.title || "Untitled stop"}</span>
              <span className="text-xs text-muted-foreground">{s.lat && s.lng ? "placed" : "no position"}</span>
            </summary>
            <div className="space-y-4 border-t border-border p-4">
              <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
                <div>
                  <Label>Title</Label>
                  <Input value={s.title} onChange={(e) => update(i, { title: e.target.value })} className="mt-1" />
                </div>
                <div>
                  <Label>Minutes here</Label>
                  <Input type="number" min={0} value={s.durationMinutes} onChange={(e) => update(i, { durationMinutes: e.target.value })} className="mt-1" />
                </div>
              </div>
              <div>
                <Label>Place</Label>
                <PlaceSearch
                  value={s.title && !s.lat ? "" : ""}
                  onChange={() => undefined}
                  onPick={(hit) => update(i, { lat: String(hit.lat), lng: String(hit.lng), title: s.title || hit.label.split(",")[0] || s.title })}
                  placeholder="Search an address or landmark to place this stop"
                />
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <Input value={s.lat} onChange={(e) => update(i, { lat: e.target.value })} placeholder="Lat" inputMode="decimal" />
                  <Input value={s.lng} onChange={(e) => update(i, { lng: e.target.value })} placeholder="Lng" inputMode="decimal" />
                  <Input value={s.heading} onChange={(e) => update(i, { heading: e.target.value })} placeholder="Heading 0–360" inputMode="decimal" />
                  <Input value={s.pitch} onChange={(e) => update(i, { pitch: e.target.value })} placeholder="Pitch" inputMode="decimal" />
                  <Input value={s.fov} onChange={(e) => update(i, { fov: e.target.value })} placeholder="FOV" inputMode="decimal" />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Heading is the compass direction the Street View faces (0 north, 90 east). Open the stop in Street View, turn to the view you want, and copy the numbers from the URL.
                </p>
              </div>
              <MediaField value={s.imageUrl} onChange={(url) => update(i, { imageUrl: url })} label="Photo (shown where Street View is not)" />
              <div>
                <Label>What happens here</Label>
                <div className="mt-1">
                  <RichTextEditor value={s.body} onChange={(html) => update(i, { body: html })} toolbar="compact" />
                </div>
              </div>
              <div>
                <Label>Guide notes <span className="text-muted-foreground">(private: history, talking points — printed from the Notes page, never shown to visitors)</span></Label>
                <div className="mt-1">
                  <RichTextEditor value={s.guideNotes} onChange={(html) => update(i, { guideNotes: html })} toolbar="compact" />
                </div>
              </div>
              <div className="flex gap-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp className="size-4" /> Up</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => move(i, 1)} disabled={i === stops.length - 1}><ArrowDown className="size-4" /> Down</Button>
                <Button type="button" variant="ghost" size="sm" className="ml-auto text-destructive" onClick={() => remove(i)}><Trash2 className="size-4" /> Remove</Button>
              </div>
            </div>
          </details>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => { setStops((l) => [...l, blank()]); setSelected(stops.length); }}>
            <Plus className="size-4" /> Add a stop
          </Button>
          <Button type="button" onClick={save} disabled={pending}>{pending ? "Saving…" : "Save stops"}</Button>
        </div>
      </div>

      <aside className="space-y-3 lg:sticky lg:top-24 lg:self-start">
        <div className="tour-story__map h-72">
          <TourMap stops={mapStops} activeIndex={activeMapIndex} onSelect={(mi) => setSelected(placed[mi]?.i ?? 0)} className="h-full" />
        </div>
        <div className="tour-story__view h-56">
          <StreetView pose={selPose} imageUrl={sel?.imageUrl || null} title={sel?.title ?? ""} apiKey={googleMapsKey} className="h-full w-full" />
        </div>
        <p className="text-xs text-muted-foreground">
          {googleMapsKey ? "Live Street View at the selected stop's pose." : "No Google Maps key is set: visitors see the photo with a link to Street View. Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to embed the panorama."}
        </p>
      </aside>
    </div>
  );
}
