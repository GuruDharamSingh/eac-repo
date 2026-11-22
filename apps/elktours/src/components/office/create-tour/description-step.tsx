"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { RichTextEditor } from "@elkdonis/cms-ui/editor";
import { MediaField } from "@/components/manage/media-field";
import { reverseGeocodeAction } from "@/lib/custom-place-actions";
import { listPlaceSheet } from "@/lib/office-actions";
import { CITIES, CITY_CENTRES, numOrNull, type TourDraft } from "./types";

const PinMap = dynamic(() => import("@/components/places/pin-map").then((m) => m.PinMap), {
  ssr: false,
  loading: () => <div className="h-72 w-full bg-muted" />,
});

const label = "text-xs font-medium uppercase tracking-wider text-muted-foreground";
const field = "mt-1 w-full rounded-md border border-input bg-background px-3 py-2";

type PlaceRow = { id: string; title: string; address: string | null; tags: string[]; lat: number | null; lng: number | null };

/**
 * Step 1, Description: city, title and one-line summary; the meeting point as a pin on the map or one of our
 * places; then price, length, languages and the cover. The longer copy and lists sit under "More about the tour".
 */
export function DescriptionStep({ draft, set }: { draft: TourDraft; set: <K extends keyof TourDraft>(k: K, v: TourDraft[K]) => void }) {
  const lat = numOrNull(draft.meetingLat);
  const lng = numOrNull(draft.meetingLng);
  const pin = lat != null && lng != null ? { lat, lng } : null;
  const labelTouched = React.useRef(Boolean(draft.location));
  const [choosing, setChoosing] = React.useState(false);
  const [places, setPlaces] = React.useState<PlaceRow[] | null>(null);
  const [filter, setFilter] = React.useState("");
  const [looking, setLooking] = React.useState(false);

  React.useEffect(() => {
    if (!choosing || places) return;
    listPlaceSheet()
      .then(setPlaces)
      .catch(() => setPlaces([]));
  }, [choosing, places]);

  async function dropPin(p: { lat: number; lng: number }) {
    set("meetingLat", String(p.lat));
    set("meetingLng", String(p.lng));
    set("meetingPlaceId", null);
    if (labelTouched.current) return;
    setLooking(true);
    const r = await reverseGeocodeAction(p.lat, p.lng).catch(() => null);
    setLooking(false);
    if (!labelTouched.current && (r?.title || r?.address)) set("location", r.title ?? r.address ?? "");
  }

  function choosePlace(p: PlaceRow) {
    if (p.lat == null || p.lng == null) return;
    set("meetingLat", String(p.lat));
    set("meetingLng", String(p.lng));
    set("meetingPlaceId", p.id);
    set("location", p.title);
    labelTouched.current = true;
    setChoosing(false);
  }

  const shown = (places ?? []).filter((p) => {
    const n = filter.trim().toLowerCase();
    return p.lat != null && (!n || p.title.toLowerCase().includes(n) || (p.address ?? "").toLowerCase().includes(n));
  });

  return (
    <div className="grid gap-6 text-sm lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
          <label className="block">
            <span className={label}>City</span>
            <select value={draft.city} onChange={(e) => set("city", e.target.value)} className={field}>
              {CITIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={label}>Title</span>
            <input value={draft.title} onChange={(e) => set("title", e.target.value)} placeholder="Montmartre at golden hour" className={field} autoFocus />
          </label>
        </div>
        <label className="block">
          <span className={label}>One-line summary</span>
          <input value={draft.excerpt} maxLength={300} onChange={(e) => set("excerpt", e.target.value)} placeholder="Shown on the tour's card and at the top of its page" className={field} />
        </label>

        <section aria-label="Meeting point" className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className={label}>Meeting point</span>
            <button type="button" onClick={() => setChoosing((v) => !v)} className="text-xs underline underline-offset-4">
              {choosing ? "Drop a pin instead" : "Choose one of our places"}
            </button>
          </div>
          {choosing ? (
            <div className="space-y-2">
              <input type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter our places" className={field} aria-label="Filter our places" />
              <ul className="max-h-72 divide-y divide-border overflow-y-auto border border-border">
                {!places && <li className="px-3 py-2 text-muted-foreground">Loading…</li>}
                {places && shown.length === 0 && <li className="px-3 py-2 text-muted-foreground">No place matches.</li>}
                {shown.map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => choosePlace(p)} className="block w-full px-3 py-2 text-left hover:bg-accent/60">
                      <span className="font-medium">{p.title}</span>
                      {p.address && <span className="block truncate text-xs text-muted-foreground">{p.address}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <>
              <PinMap value={pin} onChange={dropPin} center={pin ?? CITY_CENTRES[draft.city] ?? CITY_CENTRES.Paris} className="h-72 w-full" />
              <p className="text-xs text-muted-foreground">{pin ? "Drag the pin to adjust it." : "Click the map where the group meets."}</p>
            </>
          )}
          <label className="block">
            <span className={label}>Where exactly</span>
            <input
              value={draft.location}
              onChange={(e) => {
                labelTouched.current = true;
                set("location", e.target.value);
              }}
              placeholder={looking ? "Looking up the place…" : "In front of the fountain, Place Saint-Michel"}
              className={field}
            />
          </label>
        </section>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={label}>Price per person (EUR)</span>
            <input type="number" min={0} step="0.01" value={draft.price} onChange={(e) => set("price", e.target.value)} className={field} />
          </label>
          <label className="block">
            <span className={label}>Length (minutes)</span>
            <input type="number" min={15} step={15} value={draft.durationMinutes} onChange={(e) => set("durationMinutes", e.target.value)} className={field} />
          </label>
        </div>
        <p className="-mt-2 text-xs text-muted-foreground">Leave the price empty for "price on request" (no booking form).</p>
        <label className="block">
          <span className={label}>Languages (one per line)</span>
          <textarea rows={2} value={draft.languages} onChange={(e) => set("languages", e.target.value)} className={field} />
        </label>
        <MediaField value={draft.coverImageUrl} onChange={(url) => set("coverImageUrl", url)} label="Cover image" />

        <details className="rounded-md border border-border p-3">
          <summary className="cursor-pointer select-none font-medium">More about the tour</summary>
          <div className="mt-3 space-y-3">
            <div>
              <span className={label}>Description</span>
              <div className="mt-1">
                <RichTextEditor value={draft.body} onChange={(v) => set("body", v)} toolbar="compact" />
              </div>
            </div>
            <label className="block">
              <span className={label}>Highlights (one per line)</span>
              <textarea rows={3} value={draft.highlights} onChange={(e) => set("highlights", e.target.value)} className={field} />
            </label>
            <label className="block">
              <span className={label}>What the price includes (one per line)</span>
              <textarea rows={2} value={draft.includes} onChange={(e) => set("includes", e.target.value)} className={field} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className={label}>Max per booking</span>
                <input type="number" min={1} max={20} value={draft.maxParty} onChange={(e) => set("maxParty", e.target.value)} className={field} />
              </label>
              <label className="block">
                <span className={label}>Walking</span>
                <input value={draft.effort} onChange={(e) => set("effort", e.target.value)} placeholder="Easy, 3 km, some stairs" className={field} />
              </label>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}
