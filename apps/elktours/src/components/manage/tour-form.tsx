"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { RichTextEditor } from "@elkdonis/cms-ui/editor";
import { MediaField } from "@/components/manage/media-field";
import { PlaceSearch } from "@/components/manage/place-search";
import { saveTourAction, type TourFormValues } from "@/lib/tour-actions";
import type { Tour } from "@/lib/tours";
import { Button, Input, Label, Textarea } from "@elkdonis/primitives";

/** Create or edit the tour's own facts; stops and departures have their own tabs. */
export function TourForm({ tour }: { tour?: Tour }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [f, setF] = useState({
    title: tour?.title ?? "",
    excerpt: tour?.excerpt ?? "",
    body: tour?.body ?? "",
    coverImageUrl: tour?.coverImageUrl ?? "",
    price: tour?.price != null ? String(tour.price) : "",
    durationMinutes: tour?.durationMinutes != null ? String(tour.durationMinutes) : "",
    location: tour?.location ?? "",
    meetingLat: tour?.details.meetingPoint?.lat != null ? String(tour.details.meetingPoint.lat) : "",
    meetingLng: tour?.details.meetingPoint?.lng != null ? String(tour.details.meetingPoint.lng) : "",
    highlights: tour?.details.highlights.join("\n") ?? "",
    includes: tour?.details.includes.join("\n") ?? "",
    languages: tour?.details.languages.join("\n") ?? "English",
    maxParty: tour?.details.maxParty != null ? String(tour.details.maxParty) : "",
    effort: tour?.details.effort ?? "",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  function submit(status: "draft" | "published") {
    const input: TourFormValues = { ...f, status };
    start(async () => {
      const r = await saveTourAction(input, tour?.id);
      if (!r.ok) return void toast.error(r.error);
      toast.success(status === "published" ? "Published" : "Saved");
      if (!tour) router.push(`/manage/tours/${r.id}?tab=stops`);
      else router.refresh();
    });
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(tour?.status === "published" ? "published" : "draft"); }} className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-6">
        <div>
          <Label htmlFor="title">Title</Label>
          <Input id="title" value={f.title} onChange={(e) => set("title", e.target.value)} required className="mt-1" />
        </div>
        <div>
          <Label htmlFor="excerpt">One-line summary</Label>
          <Textarea id="excerpt" value={f.excerpt} onChange={(e) => set("excerpt", e.target.value)} rows={2} maxLength={300} className="mt-1" />
        </div>
        <div>
          <Label>Description</Label>
          <div className="mt-1">
            <RichTextEditor value={f.body} onChange={(html) => set("body", html)} />
          </div>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <Label htmlFor="highlights">Highlights <span className="text-muted-foreground">(one per line)</span></Label>
            <Textarea id="highlights" value={f.highlights} onChange={(e) => set("highlights", e.target.value)} rows={5} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="includes">What is included <span className="text-muted-foreground">(one per line)</span></Label>
            <Textarea id="includes" value={f.includes} onChange={(e) => set("includes", e.target.value)} rows={5} className="mt-1" />
          </div>
        </div>
        <div>
          <Label htmlFor="location">Meeting point</Label>
          <PlaceSearch
            id="location"
            value={f.location}
            onChange={(v) => set("location", v)}
            onPick={(hit) => { set("location", hit.label); set("meetingLat", String(hit.lat)); set("meetingLng", String(hit.lng)); }}
            placeholder="Where the group gathers — search an address or landmark"
          />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Input value={f.meetingLat} onChange={(e) => set("meetingLat", e.target.value)} placeholder="Latitude" inputMode="decimal" />
            <Input value={f.meetingLng} onChange={(e) => set("meetingLng", e.target.value)} placeholder="Longitude" inputMode="decimal" />
          </div>
        </div>
      </div>

      <aside className="space-y-6">
        <MediaField value={f.coverImageUrl} onChange={(url) => set("coverImageUrl", url)} label="Cover image" />
        <div>
          <Label htmlFor="price">Price per person (EUR)</Label>
          <Input id="price" type="number" min={0} step="0.01" value={f.price} onChange={(e) => set("price", e.target.value)} className="mt-1" />
          <p className="mt-1 text-xs text-muted-foreground">Leave empty for "price on request" (no booking form).</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="duration">Length (min)</Label>
            <Input id="duration" type="number" min={0} step={15} value={f.durationMinutes} onChange={(e) => set("durationMinutes", e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="maxParty">Max per booking</Label>
            <Input id="maxParty" type="number" min={1} max={20} value={f.maxParty} onChange={(e) => set("maxParty", e.target.value)} className="mt-1" />
          </div>
        </div>
        <div>
          <Label htmlFor="languages">Languages <span className="text-muted-foreground">(one per line)</span></Label>
          <Textarea id="languages" value={f.languages} onChange={(e) => set("languages", e.target.value)} rows={2} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="effort">Walking</Label>
          <Input id="effort" value={f.effort} onChange={(e) => set("effort", e.target.value)} placeholder="Easy, 3 km, a few stairs" className="mt-1" />
        </div>

        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" disabled={pending} onClick={() => submit("draft")}>
            {tour?.status === "published" ? "Unpublish & save" : "Save draft"}
          </Button>
          <Button type="button" disabled={pending} onClick={() => submit("published")}>
            {tour?.status === "published" ? "Save" : "Publish"}
          </Button>
        </div>
      </aside>
    </form>
  );
}
