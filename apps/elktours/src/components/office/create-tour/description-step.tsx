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

/** The sections of the description: who the tour is, its meeting point, price and practicalities, and the long text. */
export type DescriptionPart = "identity" | "meeting" | "practical" | "about";

type PlaceRow = { id: string; title: string; address: string | null; tags: string[]; lat: number | null; lng: number | null };

/**
 * Step 1, Description (layout: design take A, 2026-11-26, https://claude.ai/artifact/Cb3HPqZoGYKi4gTjm3YQNF): title, summary,
 * languages and the cover side by side; then, each across the frame, the meeting point (map or one of our places),
 * price and practicalities, and "More about the tour" (open).
 */
export function DescriptionStep({
  draft,
  set,
  tourId = null,
  only,
}: {
  draft: TourDraft;
  set: <K extends keyof TourDraft>(k: K, v: TourDraft[K]) => void;
  /** The saved tour, once it has one: its cover is filed in the tour's own folder (2026-11-26). */
  tourId?: string | null;
  /** The edit suite shows one section at a time; the wizard leaves this out and gets all four. */
  only?: DescriptionPart;
}) {
  const show = (part: DescriptionPart) => !only || only === part;
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
    <div className="space-y-8 text-sm">
      {/* The tour: who it is and its cover, side by side; everything below runs the frame's full width (design take A, 2026-11-26). */}
      {show("identity") && (
      <div className="grid gap-6 lg:grid-cols-2">
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
            <textarea rows={2} value={draft.excerpt} maxLength={300} onChange={(e) => set("excerpt", e.target.value)} placeholder="Shown on the tour's card and at the top of its page" className={`${field} resize-none`} />
          </label>
          <LanguagesField value={draft.languages} onChange={(v) => set("languages", v)} />
        </div>
        <MediaField
          value={draft.coverImageUrl}
          onChange={(url) => set("coverImageUrl", url)}
          label="Cover"
          preview="large"
          destination={tourId ? { kind: "tour", tourId, slot: "cover" } : { kind: "general", context: draft.title ? `${draft.title}-cover` : null }}
          hint={tourId ? undefined : "Until the tour is saved, the cover is filed in the site's media folder."}
        />
      </div>
      )}

      {show("meeting") && (
      <section aria-labelledby="ct-meet" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="ct-meet" className="text-lg font-semibold">Meeting point</h3>
          <button type="button" onClick={() => setChoosing((v) => !v)} className="underline underline-offset-4">
            {choosing ? "Drop a pin instead" : "Choose one of our places"}
          </button>
        </div>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
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
            <PinMap value={pin} onChange={dropPin} center={pin ?? CITY_CENTRES[draft.city] ?? CITY_CENTRES.Paris} className="h-72 w-full" />
          )}
          <div className="space-y-2">
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
            <p className="text-xs text-muted-foreground">
              {pin ? `Pin at ${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}. Drag it to correct it.` : "Click the map where the group meets."} The meeting point is the
              route's first stop.
            </p>
          </div>
        </div>
      </section>
      )}

      {show("practical") && (
      <section aria-labelledby="ct-practical" className="space-y-3">
        <h3 id="ct-practical" className="text-lg font-semibold">Price and practicalities</h3>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <label className="block">
            <span className={label}>Price per person (EUR)</span>
            <input type="number" min={0} step="0.01" value={draft.price} onChange={(e) => set("price", e.target.value)} className={field} />
          </label>
          <label className="block">
            <span className={label}>Length (minutes)</span>
            <input type="number" min={15} step={15} value={draft.durationMinutes} onChange={(e) => set("durationMinutes", e.target.value)} className={field} />
          </label>
          <label className="block">
            <span className={label}>Max per booking</span>
            <input type="number" min={1} max={20} value={draft.maxParty} onChange={(e) => set("maxParty", e.target.value)} className={field} />
          </label>
          <label className="block">
            <span className={label}>Walking</span>
            <input value={draft.effort} onChange={(e) => set("effort", e.target.value)} placeholder="Easy, 3 km, some stairs" className={field} />
          </label>
        </div>
        <p className="text-xs text-muted-foreground">Leave the price empty for "price on request" (no booking form).</p>
      </section>
      )}

      {show("about") && (
      <details open className="group border-t border-border pt-5">
        <summary className="flex cursor-pointer select-none items-baseline justify-between gap-3">
          <span className="text-lg font-semibold">More about the tour</span>
          <span className="text-xs text-muted-foreground">Shown under "About" on the tour page</span>
        </summary>
        <div className="mt-3 space-y-4">
          <div>
            <span className={label}>Description</span>
            <div className="mt-1">
              <RichTextEditor value={draft.body} onChange={(v) => set("body", v)} toolbar="compact" />
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="block">
              <span className={label}>Highlights (one per line)</span>
              <textarea rows={4} value={draft.highlights} onChange={(e) => set("highlights", e.target.value)} className={field} />
            </label>
            <label className="block">
              <span className={label}>What the price includes (one per line)</span>
              <textarea rows={4} value={draft.includes} onChange={(e) => set("includes", e.target.value)} className={field} />
            </label>
          </div>
        </div>
      </details>
      )}
    </div>
  );
}

/** The tour's languages as chips; stored as before, one per line (TourDraft.languages). */
function LanguagesField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const list = value.split("\n").map((l) => l.trim()).filter(Boolean);
  const [adding, setAdding] = React.useState("");
  const add = () => {
    const v = adding.trim();
    if (v && !list.some((l) => l.toLowerCase() === v.toLowerCase())) onChange([...list, v].join("\n"));
    setAdding("");
  };
  return (
    <div>
      <span className={label} id="ct-lang">
        Languages
      </span>
      <div className="mt-1 flex flex-wrap items-center gap-2" aria-labelledby="ct-lang">
        {list.map((l) => (
          <span key={l} className="inline-flex h-8 items-center gap-1 rounded-full border border-border pl-3 pr-1">
            {l}
            <button type="button" aria-label={`Remove ${l}`} onClick={() => onChange(list.filter((x) => x !== l).join("\n"))} className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-accent">
              ×
            </button>
          </span>
        ))}
        <input
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            }
          }}
          onBlur={add}
          placeholder="+ Add a language"
          aria-label="Add a language"
          className="h-8 w-40 rounded-full border border-dashed border-border bg-transparent px-3"
        />
      </div>
    </div>
  );
}
