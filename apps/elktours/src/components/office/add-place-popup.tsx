"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  SurfaceFrame,
  SurfaceSkeleton,
  useSurfaceOptional,
  type SurfaceAction,
  type SurfaceDescriptor,
} from "@elkdonis/cms-ui/surface";
import dynamic from "next/dynamic";
import type { Place, PlaceSuggestion } from "@/lib/catalogue-types";
import { pickSuggestionAction, suggestPlacesAction } from "@/lib/place-actions";
import { createPlaceFromPin } from "@/lib/custom-place-actions";
import { setPlaceWebsiteAction } from "@/lib/place-website-actions";
import { getPlaceSheet, listPlaceSheet } from "@/lib/office-actions";
import { PhotoCreator, useNaming } from "@/components/places/location-creator";
import { PlaceForm } from "@/components/places/place-form";
import type { LatLng } from "@/components/places/pin-map";
import { siteConfig } from "@/config/site";

const PinMap = dynamic(() => import("@/components/places/pin-map").then((m) => m.PinMap), {
  ssr: false,
  loading: () => <div className="h-72 w-full bg-muted" />,
});

/** The hub card's descriptor (registered as `office-add-place` in HubSurfaces). */
export const addPlaceDescriptor: SurfaceDescriptor = {
  type: "custom",
  key: "office-add-place",
  title: "Add a place",
  kind: "service",
  size: "wide",
};

/** Paris until another city is listed. */
const CITY_CENTRE = { lat: 48.8566, lng: 2.3522 };

type Way = "search" | "pin" | "photo" | "catalogue";

interface CatalogueRow {
  id: string;
  title: string;
  address: string | null;
  tags: string[];
}

/**
 * Add a place (hub, 2026-11-19), two steps.
 *   1 Where: a search field (our places and OpenStreetMap), or drop a pin, or a photo. Name and address are
 *     suggested from the pin and editable; "Create place here" is in the foot. "Catalogue of places" (foot)
 *     lists the places already made, to open one instead.
 *   2 Details: the place's website (prefilled from the links found for it) and the place form.
 * Places belong to the org; `places.created_by` records who made it.
 */
export function AddPlacePopup(_props: { descriptor: Extract<SurfaceDescriptor, { type: "custom" }> }) {
  const router = useRouter();
  const surface = useSurfaceOptional();
  const [step, setStep] = React.useState<1 | 2>(1);
  const [way, setWay] = React.useState<Way>("search");
  const [placeId, setPlaceId] = React.useState<string | null>(null);
  const [sheet, setSheet] = React.useState<{ place: Place; website: string | null } | null>(null);
  const [website, setWebsite] = React.useState("");
  const [savingLink, setSavingLink] = React.useState(false);

  // search
  const [q, setQ] = React.useState("");
  const [hits, setHits] = React.useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [busyKey, setBusyKey] = React.useState<string | null>(null);
  const seq = React.useRef(0);
  // pin
  const [pin, setPin] = React.useState<LatLng | null>(null);
  const [creating, setCreating] = React.useState(false);
  const naming = useNaming();
  // catalogue
  const [rows, setRows] = React.useState<CatalogueRow[] | null>(null);
  const [filter, setFilter] = React.useState("");

  React.useEffect(() => {
    const needle = q.trim();
    if (needle.length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }
    const n = ++seq.current;
    setSearching(true);
    const t = setTimeout(async () => {
      const r = await suggestPlacesAction({ q: needle, near: CITY_CENTRE }).catch(() => null);
      if (n !== seq.current) return;
      setSearching(false);
      setHits(r?.items ?? []);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  React.useEffect(() => {
    if (way !== "catalogue" || rows) return;
    listPlaceSheet()
      .then(setRows)
      .catch(() => setRows([]));
  }, [way, rows]);

  React.useEffect(() => {
    if (!placeId) return;
    let live = true;
    setSheet(null);
    getPlaceSheet(placeId)
      .then((s) => {
        if (!live) return;
        if (!s) return void toast.error("That place could not be opened.");
        setSheet(s);
        setWebsite(s.website ?? "");
      })
      .catch(() => toast.error("That place could not be opened."));
    return () => {
      live = false;
    };
  }, [placeId]);

  function opened(id: string) {
    setPlaceId(id);
    setStep(2);
    router.refresh();
  }

  async function fromSuggestion(item: PlaceSuggestion) {
    if (item.placeId) return opened(item.placeId);
    setBusyKey(item.key);
    const r = await pickSuggestionAction(item).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "Could not add it." }));
    setBusyKey(null);
    if (!r.ok) return void toast.error(r.error);
    toast.success(`${r.place.title} added to the places`);
    opened(r.place.id);
  }

  async function createHere() {
    if (!pin) return;
    setCreating(true);
    const r = await createPlaceFromPin({ lat: pin.lat, lng: pin.lng, title: naming.title.trim() || null, address: naming.address.trim() || null }).catch(
      (e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "Could not create the place." })
    );
    setCreating(false);
    if (!r.ok) return void toast.error(r.error);
    toast.success(`${r.place.title} added to the places`);
    setPin(null);
    naming.reset();
    opened(r.place.id);
  }

  async function saveLink() {
    if (!placeId) return;
    setSavingLink(true);
    const r = await setPlaceWebsiteAction(placeId, website).catch(() => ({ ok: false as const, error: "Could not save the link." }));
    setSavingLink(false);
    if (!r.ok) return void toast.error(r.error ?? "Could not save the link.");
    toast.success(website.trim() ? "Link saved" : "Link removed");
  }

  const steps = (
    <ol className="mb-4 flex gap-2 text-xs" aria-label="Steps">
      {(["Where", "Details"] as const).map((label, i) => {
        const n = (i + 1) as 1 | 2;
        const current = n === step;
        return (
          <li key={label}>
            <button
              type="button"
              disabled={n === 2 && !placeId}
              onClick={() => setStep(n)}
              aria-current={current ? "step" : undefined}
              className={`rounded-full border px-3 py-1 ${current ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground disabled:opacity-40"}`}
            >
              {n} · {label}
            </button>
          </li>
        );
      })}
    </ol>
  );

  if (step === 1) {
    const ways: Array<[Way, string]> = [
      ["search", "Search"],
      ["pin", "Drop a pin"],
      ["photo", "From a photo"],
    ];
    const actions: SurfaceAction[] = [
      way === "catalogue"
        ? { label: "Back to search", quiet: true, onClick: () => setWay("search") }
        : { label: "Catalogue of places", quiet: true, onClick: () => setWay("catalogue") },
    ];
    if (way === "pin") actions.push({ label: creating ? "Creating…" : "Create place here", primary: true, disabled: !pin || creating, onClick: createHere });
    const status =
      way === "pin" ? (pin ? "Check the name and address, then create" : "Click the map to drop a pin") : way === "catalogue" ? "Open a place already made" : "Type a name or an address";

    return (
      <SurfaceFrame kind="service" kicker="Office" title="Add a place" actions={actions} status={status}>
        {steps}
        <div className="space-y-4 text-sm">
          {way !== "catalogue" && (
            <div className="flex border border-border" role="group" aria-label="How to find the place">
              {ways.map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={way === k}
                  onClick={() => setWay(k)}
                  className={`flex-1 px-3 py-2 ${way === k ? "bg-accent font-medium" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {way === "search" && (
            <>
              <input
                type="search"
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={`A café, a church, an address in ${siteConfig.city}`}
                className="w-full rounded-md border border-input bg-background px-3 py-2.5"
                aria-label="Search places"
              />
              {searching && <p className="text-muted-foreground">Searching…</p>}
              {!searching && q.trim().length >= 2 && hits.length === 0 && <p className="text-muted-foreground">Nothing found. Try another spelling, or drop a pin.</p>}
              {hits.length > 0 && (
                <ul className="divide-y divide-border border border-border">
                  {hits.map((h) => (
                    <li key={h.key}>
                      <button
                        type="button"
                        disabled={busyKey !== null}
                        onClick={() => fromSuggestion(h)}
                        className="flex w-full items-baseline justify-between gap-3 px-3 py-2.5 text-left hover:bg-accent/60 disabled:opacity-60"
                      >
                        <span className="min-w-0">
                          <span className="font-medium">{h.title}</span>
                          {h.address && <span className="block truncate text-xs text-muted-foreground">{h.address}</span>}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {busyKey === h.key ? "Adding…" : h.source === "catalogue" ? "Already in places" : h.category ? h.category.replace(/_/g, " ") : "OpenStreetMap"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {way === "pin" && (
            <>
              <PinMap
                value={pin}
                onChange={(p) => {
                  setPin(p);
                  void naming.lookup(p);
                }}
                center={CITY_CENTRE}
                className="h-72 w-full"
              />
              {pin ? naming.fields("ap-pin") : <p className="text-muted-foreground">The name and address are suggested from the pin; change them as you like.</p>}
            </>
          )}

          {way === "photo" && <PhotoCreator center={CITY_CENTRE} onCreated={({ place }) => opened(place.id)} mapClass="h-72 w-full" />}

          {way === "catalogue" && (
            <>
              <input
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter the places"
                className="w-full rounded-md border border-input bg-background px-3 py-2"
                aria-label="Filter the places"
              />
              {!rows ? (
                <SurfaceSkeleton block />
              ) : (
                <ul className="max-h-[50vh] divide-y divide-border overflow-y-auto border border-border">
                  {rows
                    .filter((r) => {
                      const n = filter.trim().toLowerCase();
                      return !n || r.title.toLowerCase().includes(n) || (r.address ?? "").toLowerCase().includes(n) || r.tags.some((t) => t.includes(n));
                    })
                    .map((r) => (
                      <li key={r.id}>
                        <button type="button" onClick={() => opened(r.id)} className="block w-full px-3 py-2 text-left hover:bg-accent/60">
                          <span className="font-medium">{r.title}</span>
                          {r.address && <span className="block truncate text-xs text-muted-foreground">{r.address}</span>}
                        </button>
                      </li>
                    ))}
                </ul>
              )}
            </>
          )}
        </div>
      </SurfaceFrame>
    );
  }

  const actions: SurfaceAction[] = [
    {
      label: "Add another",
      quiet: true,
      onClick: () => {
        setPlaceId(null);
        setSheet(null);
        setQ("");
        setWay("search");
        setStep(1);
      },
    },
    ...(placeId ? [{ label: "Open full page", href: `/manage/places/${placeId}`, quiet: true }] : []),
    { label: "Done", primary: true, onClick: () => surface?.close() },
  ];

  return (
    <SurfaceFrame kind="service" kicker="Office" title={sheet?.place.title ?? "Add a place"} actions={actions} status="Save the place, then Done">
      {steps}
      {!sheet ? (
        <SurfaceSkeleton block />
      ) : (
        <div className="space-y-6 text-sm">
          <section className="rounded-md border border-border p-3">
            <label htmlFor="ap-website" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Website
            </label>
            <div className="mt-1 flex gap-2">
              <input
                id="ap-website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://"
                className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2"
              />
              <button type="button" onClick={saveLink} disabled={savingLink} className="rounded-md border border-border px-3 py-2 hover:bg-accent disabled:opacity-50">
                {savingLink ? "Saving…" : "Save link"}
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {sheet.website ? "Filled in from the links found for this place." : "No website was found for this place."}
            </p>
          </section>
          <PlaceForm key={sheet.place.id} place={sheet.place} googleMapsKey={siteConfig.googleMapsKey} />
        </div>
      )}
    </SurfaceFrame>
  );
}
