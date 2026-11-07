"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { RichTextEditor } from "@elkdonis/cms-ui/editor";
import { Button, Input, Label } from "@elkdonis/primitives";
import { PlaceSearch } from "@/components/manage/place-search";
import { StreetView } from "@/components/tours/street-view";
import { savePlaceAction } from "@/lib/place-actions";
import type { Place } from "@/lib/catalogue-types";
import "@/components/tours/tour-story.css";

const TourMap = dynamic(() => import("@/components/tours/tour-map").then((m) => m.TourMap), { ssr: false });

const str = (v: number | null) => (v == null ? "" : String(v));
const num = (v: string) => (v.trim() === "" || !Number.isFinite(Number(v)) ? null : Number(v));

/** Edit one catalogue place. Saving never touches stops already copied from it. */
export function PlaceForm({ place, googleMapsKey }: { place: Place; googleMapsKey: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [title, setTitle] = useState(place.title);
  const [address, setAddress] = useState(place.address ?? "");
  const [tags, setTags] = useState(place.tags.join(", "));
  const [body, setBody] = useState(place.body ?? "");
  const [excerpt, setExcerpt] = useState(place.excerpt ?? "");
  const [isPublic, setIsPublic] = useState(place.isPublic ?? true);
  const [notes, setNotes] = useState(place.privateNotes ?? "");
  const [lat, setLat] = useState(str(place.lat));
  const [lng, setLng] = useState(str(place.lng));
  const [heading, setHeading] = useState(str(place.heading));
  const [pitch, setPitch] = useState(str(place.pitch));
  const [fov, setFov] = useState(str(place.fov));
  const [search, setSearch] = useState("");

  const pos = num(lat) != null && num(lng) != null ? { lat: num(lat)!, lng: num(lng)! } : null;

  function save() {
    if (!title.trim()) return void toast.error("A place needs a title.");
    start(async () => {
      const r = await savePlaceAction({
        id: place.id,
        title: title.trim(),
        body: body || null,
        excerpt: excerpt.trim() || null,
        isPublic,
        privateNotes: notes || null,
        lat: num(lat),
        lng: num(lng),
        heading: num(heading),
        pitch: num(pitch),
        fov: num(fov),
        address: address.trim() || null,
        tags: [...new Set(tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))],
      }).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "Could not save the place." }));
      if (!r.ok) return void toast.error(r.error);
      toast.success("Place saved");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="place-title">Title</Label>
            <Input id="place-title" value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="place-address">Address</Label>
            <Input id="place-address" value={address} onChange={(e) => setAddress(e.target.value)} className="mt-1" />
          </div>
        </div>
        <div>
          <Label htmlFor="place-tags">Tags <span className="text-muted-foreground">(comma separated)</span></Label>
          <Input id="place-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="church, gothic, île de la cité" className="mt-1" />
        </div>
        <div>
          <Label>Position</Label>
          <PlaceSearch
            value={search}
            onChange={setSearch}
            onPick={(hit) => { setLat(String(hit.lat)); setLng(String(hit.lng)); if (!address) setAddress(hit.label); setSearch(""); }}
            placeholder="Search to move the place"
          />
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="Lat" inputMode="decimal" aria-label="Latitude" />
            <Input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="Lng" inputMode="decimal" aria-label="Longitude" />
            <Input value={heading} onChange={(e) => setHeading(e.target.value)} placeholder="Heading 0–360" inputMode="decimal" aria-label="Heading" />
            <Input value={pitch} onChange={(e) => setPitch(e.target.value)} placeholder="Pitch" inputMode="decimal" aria-label="Pitch" />
            <Input value={fov} onChange={(e) => setFov(e.target.value)} placeholder="FOV" inputMode="decimal" aria-label="Field of view" />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">The default Street View pose, copied into a stop when the place is picked.</p>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="mt-1" />
          <span>
            <span className="font-medium">Public</span>
            <span className="block text-muted-foreground">Shown on the public Places page. Off keeps it in the catalogue for tours only.</span>
          </span>
        </label>
        <div>
          <Label htmlFor="place-excerpt">Short excerpt <span className="text-muted-foreground">(one line for cards, up to 200 characters)</span></Label>
          <Input id="place-excerpt" value={excerpt} maxLength={200} onChange={(e) => setExcerpt(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label>Public copy</Label>
          <div className="mt-1">
            <RichTextEditor value={body} onChange={setBody} toolbar="compact" />
          </div>
        </div>
        <div>
          <Label>Private notes <span className="text-muted-foreground">(company knowledge, never shown to visitors)</span></Label>
          <div className="mt-1">
            <RichTextEditor value={notes} onChange={setNotes} toolbar="compact" />
          </div>
        </div>
        <Button type="button" onClick={save} disabled={pending}>{pending ? "Saving…" : "Save place"}</Button>
        <p className="text-xs text-muted-foreground">Tours keep their own copy of each stop. Use “Reset stop to catalogue” in a tour to pull these changes in.</p>
      </div>

      <aside className="space-y-3 lg:sticky lg:top-24 lg:self-start">
        <div className="tour-story__map h-56">
          <TourMap stops={pos ? [{ id: place.id, title: title || "Place", ...pos }] : []} activeIndex={pos ? 0 : -1} className="h-full" />
        </div>
        <div className="tour-story__view h-48">
          <StreetView
            pose={pos ? { ...pos, heading: num(heading), pitch: num(pitch), fov: num(fov) } : null}
            title={title}
            apiKey={googleMapsKey}
            className="h-full w-full"
          />
        </div>
      </aside>
    </div>
  );
}
