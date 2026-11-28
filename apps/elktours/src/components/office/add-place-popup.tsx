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
import type { Place, PlaceSuggestion, TourAsset } from "@/lib/catalogue-types";
import { pickSuggestionAction, suggestPlacesAction } from "@/lib/place-actions";
import { createPlaceFromPin } from "@/lib/custom-place-actions";
import { setPlaceWebsiteAction } from "@/lib/place-website-actions";
import { getPlaceSheet, listPlaceSheet } from "@/lib/office-actions";
import { archiveAssetAction, listAssetsAction, upsertAssetAction } from "@/lib/asset-actions";
import { MediaField } from "@/components/manage/media-field";
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
  size: "full",
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

/** When the sheet is opened from a tour's route: every place it lands on becomes the next stop. */
export interface AsStop {
  /** The number the next stop would get. */
  next: number;
  /** Place ids already on the route, with their stop numbers. */
  onRoute: Map<string, number>;
  /** Add the place as the next stop (the route step fetches it again, so edits made here come along). */
  add: (placeId: string) => void | Promise<void>;
  /** Show a place already on the route in the stop editor. */
  focus?: (placeId: string) => void;
}

/**
 * The sheet's state, shared by the hub popup and the tour editor's route step (2026-11-26). `asStop` set: opening,
 * picking or creating a place also adds it to the route.
 */
export function useAddPlace({ centre = CITY_CENTRE, asStop, initialQuery = "" }: { centre?: LatLng | null; asStop?: AsStop; initialQuery?: string } = {}) {
  const router = useRouter();
  const near = centre ?? CITY_CENTRE;
  const [way, setWay] = React.useState<Way>("search");
  const [placeId, setPlaceId] = React.useState<string | null>(null);
  const [sheet, setSheet] = React.useState<{ place: Place; website: string | null } | null>(null);
  const [website, setWebsite] = React.useState("");
  const [savingLink, setSavingLink] = React.useState(false);
  /** The stop number the opened place has on the route (added just now or already there). */
  const [stopNo, setStopNo] = React.useState<number | null>(null);

  // search
  const [q, setQ] = React.useState(initialQuery);
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
      const r = await suggestPlacesAction({ q: needle, near }).catch(() => null);
      if (n !== seq.current) return;
      setSearching(false);
      setHits(r?.items ?? []);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function opened(id: string) {
    setPlaceId(id);
    setWay("search");
    if (asStop) {
      const already = asStop.onRoute.get(id);
      if (already != null) {
        setStopNo(already);
        asStop.focus?.(id);
      } else {
        setStopNo(asStop.next);
        await asStop.add(id);
      }
    } else router.refresh();
  }

  async function fromSuggestion(item: PlaceSuggestion) {
    if (item.placeId) return opened(item.placeId);
    setBusyKey(item.key);
    const r = await pickSuggestionAction(item).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "Could not add it." }));
    setBusyKey(null);
    if (!r.ok) return void toast.error(r.error);
    toast.success(`${r.place.title} added to the places`);
    await opened(r.place.id);
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
    await opened(r.place.id);
  }

  async function saveLink() {
    if (!placeId) return;
    setSavingLink(true);
    const r = await setPlaceWebsiteAction(placeId, website).catch(() => ({ ok: false as const, error: "Could not save the link." }));
    setSavingLink(false);
    if (!r.ok) return void toast.error(r.error ?? "Could not save the link.");
    toast.success(website.trim() ? "Link saved" : "Link removed");
  }

  function another() {
    setPlaceId(null);
    setSheet(null);
    setStopNo(null);
    setQ("");
    setPin(null);
    naming.reset();
    setWay("search");
  }

  /** What a result row's action says: in a route, the stop it would become. */
  function verb(id: string | null | undefined, fallback: string): string {
    if (!asStop) return fallback;
    const n = id ? asStop.onRoute.get(id) : undefined;
    return n != null ? `Stop ${n} · open it` : `Add as stop ${asStop.next}`;
  }

  return {
    asStop, near, way, setWay, placeId, sheet, website, setWebsite, savingLink, stopNo,
    q, setQ, hits, searching, busyKey, pin, setPin, creating, naming, rows, filter, setFilter,
    opened, fromSuggestion, createHere, saveLink, another, verb,
  };
}

export type AddPlaceModel = ReturnType<typeof useAddPlace>;

/**
 * Add a place (hub, 2026-11-19; one sheet since 2026-11-26, design "Place 1",
 * https://claude.ai/artifact/Cb3HPqZoGYKi4gTjm3YQNF).
 *   Find it (top): a search field (our places and OpenStreetMap) beside the map. Clicking the map drops a pin; the name
 *     and address are suggested and editable, and "Create place here" makes it. "From a photo" and "Our places" swap the
 *     results column for the photo start or the catalogue.
 *   About the place (below, on the same sheet, once a place is chosen or made): its website, its pictures (filed in
 *     Places/<slug>/ through the picker) and the place form.
 * The tour editor's route step draws the same body (`AddPlaceBody` with `asStop`), where each place becomes the next stop.
 * Places belong to the org; `places.created_by` records who made it.
 */
export function AddPlacePopup(_props: { descriptor: Extract<SurfaceDescriptor, { type: "custom" }> }) {
  const surface = useSurfaceOptional();
  const m = useAddPlace();
  const { placeId, pin, creating } = m;
  const actions: SurfaceAction[] = [
    ...(placeId
      ? [
          { label: "Add another", quiet: true, onClick: m.another },
          { label: "Open full page", href: `/manage/places/${placeId}`, quiet: true },
        ]
      : []),
    ...(!placeId && pin ? [{ label: creating ? "Creating…" : "Create place here", primary: true, disabled: creating, onClick: m.createHere }] : []),
    ...(placeId ? [{ label: "Done", primary: true, onClick: () => surface?.close() }] : []),
  ];
  const status = placeId
    ? "Saved as you go: the website with Save link, the details with Save place"
    : pin
      ? "Check the name and address, then create"
      : "Search by name, or click the map where the place is";

  return (
    <SurfaceFrame kind="service" kicker="Office" title={m.sheet?.place.title ?? "Add a place"} actions={actions} status={status}>
      <AddPlaceBody m={m} />
    </SurfaceFrame>
  );
}

/** The sheet's body: Find it, then About the place. `head` replaces the Find heading's right side (the route's Back). */
export function AddPlaceBody({ m, head, mapClass = "h-72 w-full" }: { m: AddPlaceModel; head?: React.ReactNode; mapClass?: string }) {
  const { way, setWay, placeId, sheet, pin, creating, naming, asStop } = m;
  const isCatalogue = way === "catalogue";
  const createLabel = asStop ? `Create and add as stop ${asStop.next}` : "Create place here";
  return (
    <div className="space-y-8 text-sm">
      <section aria-labelledby="ap-find" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="ap-find" className="text-lg font-semibold">
            {placeId ? "Find another place" : asStop ? `Find stop ${asStop.next}` : "Find it"}
          </h3>
          <div className="flex flex-wrap gap-2">
            <button type="button" aria-pressed={way === "photo"} onClick={() => setWay(way === "photo" ? "search" : "photo")} className={`rounded-md border px-3 py-1.5 ${way === "photo" ? "border-foreground bg-accent" : "border-dashed border-border hover:bg-accent"}`}>
              From a photo
            </button>
            <button type="button" aria-pressed={isCatalogue} onClick={() => setWay(isCatalogue ? "search" : "catalogue")} className={`rounded-md border px-3 py-1.5 ${isCatalogue ? "border-foreground bg-accent" : "border-dashed border-border hover:bg-accent"}`}>
              Our places
            </button>
            {head}
          </div>
        </div>

        {way === "photo" ? (
          <PhotoCreator center={m.near} onCreated={({ place }) => void m.opened(place.id)} mapClass={mapClass} />
        ) : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_26rem]">
            <div className="min-w-0 space-y-2">
              {isCatalogue ? (
                <>
                  <input
                    type="search"
                    value={m.filter}
                    onChange={(e) => m.setFilter(e.target.value)}
                    placeholder="Filter our places"
                    className="w-full rounded-md border border-input bg-background px-3 py-2.5"
                    aria-label="Filter our places"
                  />
                  {!m.rows ? (
                    <SurfaceSkeleton block />
                  ) : (
                    <ul className="max-h-72 divide-y divide-border overflow-y-auto border border-border">
                      {m.rows
                        .filter((r) => {
                          const n = m.filter.trim().toLowerCase();
                          return !n || r.title.toLowerCase().includes(n) || (r.address ?? "").toLowerCase().includes(n) || r.tags.some((t) => t.includes(n));
                        })
                        .map((r) => (
                          <li key={r.id}>
                            <button type="button" onClick={() => void m.opened(r.id)} aria-current={placeId === r.id ? "true" : undefined} className="flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left hover:bg-accent/60 aria-[current=true]:bg-accent">
                              <span className="min-w-0">
                                <span className="font-medium">{r.title}</span>
                                {r.address && <span className="block truncate text-xs text-muted-foreground">{r.address}</span>}
                              </span>
                              {asStop && <span className="shrink-0 text-xs underline underline-offset-4">{m.verb(r.id, "")}</span>}
                            </button>
                          </li>
                        ))}
                    </ul>
                  )}
                </>
              ) : (
                <>
                  <label htmlFor="ap-q" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    A name or an address
                  </label>
                  <input
                    id="ap-q"
                    type="search"
                    autoFocus
                    value={m.q}
                    onChange={(e) => m.setQ(e.target.value)}
                    placeholder={`A café, a church, an address in ${siteConfig.city}`}
                    className="w-full rounded-md border border-input bg-background px-3 py-2.5"
                  />
                  {m.searching && <p className="text-muted-foreground">Searching…</p>}
                  {!m.searching && m.q.trim().length >= 2 && m.hits.length === 0 && <p className="text-muted-foreground">Nothing found. Try another spelling, or click the map.</p>}
                  {m.hits.length > 0 && (
                    <ul className="max-h-72 divide-y divide-border overflow-y-auto border border-border">
                      {m.hits.map((h) => (
                        <li key={h.key} className={h.source === "catalogue" ? "bg-accent/30" : undefined}>
                          <button
                            type="button"
                            disabled={m.busyKey !== null}
                            onClick={() => void m.fromSuggestion(h)}
                            className="flex w-full items-baseline justify-between gap-3 px-3 py-2.5 text-left hover:bg-accent/60 disabled:opacity-60"
                          >
                            <span className="min-w-0">
                              <span className="font-medium">{h.title}</span>
                              {h.address && <span className="block truncate text-xs text-muted-foreground">{h.address}</span>}
                            </span>
                            <span className="shrink-0 text-xs">
                              {m.busyKey === h.key ? (
                                "Adding…"
                              ) : (
                                <span className="underline underline-offset-4">
                                  {m.verb(h.placeId, h.source === "catalogue" ? "Already ours · open it" : `Use this${h.category ? ` · ${h.category.replace(/_/g, " ")}` : ""}`)}
                                </span>
                              )}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {!m.hits.length && !m.q.trim() && !pin && <p className="text-muted-foreground">Our places come first; anything else is found on OpenStreetMap.</p>}
                </>
              )}
            </div>
            <div className="space-y-2">
              <PinMap
                value={pin}
                onChange={(p) => {
                  m.setPin(p);
                  void naming.lookup(p);
                }}
                center={m.near}
                className={mapClass}
              />
              {pin ? (
                <div className="space-y-2">
                  {naming.fields("ap-pin")}
                  <button type="button" disabled={creating} onClick={() => void m.createHere()} className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-50">
                    {creating ? "Creating…" : createLabel}
                  </button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Not found? Click the map at the door. The name and address are suggested from the pin.</p>
              )}
            </div>
          </div>
        )}
      </section>

      {placeId && (
        <section aria-labelledby="ap-about" className="space-y-5 border-t border-border pt-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 id="ap-about" className="text-lg font-semibold">
              {asStop && m.stopNo != null && sheet ? `Stop ${m.stopNo}: ${sheet.place.title}` : "About the place"}
            </h3>
            <span className="text-xs text-muted-foreground">
              {asStop ? "The place's own details, shared by every tour that stops here; the stop's line and notes are in the stop editor below" : "Filled in from the map and its links; change anything"}
            </span>
          </div>
          {!sheet ? (
            <SurfaceSkeleton block />
          ) : (
            <>
              <div className="grid gap-5 lg:grid-cols-2">
                <div>
                  <label htmlFor="ap-website" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Website
                  </label>
                  <div className="mt-1 flex gap-2">
                    <input
                      id="ap-website"
                      value={m.website}
                      onChange={(e) => m.setWebsite(e.target.value)}
                      placeholder="https://"
                      className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2"
                    />
                    <button type="button" onClick={() => void m.saveLink()} disabled={m.savingLink} className="rounded-md border border-border px-3 py-2 hover:bg-accent disabled:opacity-50">
                      {m.savingLink ? "Saving…" : "Save link"}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {sheet.website ? "Filled in from the links found for this place." : "No website was found for this place."}
                  </p>
                </div>
                <PlacePictures placeId={sheet.place.id} />
              </div>
              <PlaceForm key={sheet.place.id} place={sheet.place} googleMapsKey={siteConfig.googleMapsKey} />
            </>
          )}
        </section>
      )}
    </div>
  );
}

/**
 * The place's own pictures: a strip of its shown pictures and a picker that files new ones in Places/<slug>/
 * (the picker's place destination; a picture from elsewhere is copied in without its location). Each picture added
 * here is a shown place picture (tour_assets, place_id), so every tour stopping at the place can use it.
 */
function PlacePictures({ placeId }: { placeId: string }) {
  const [list, setList] = React.useState<TourAsset[] | null>(null);
  const load = React.useCallback(async () => {
    const rows = await listAssetsAction({ placeId }).catch(() => [] as TourAsset[]);
    setList(rows.filter((a) => (a.kind === "image" || a.kind === "still") && !!a.url && !a.archivedAt && a.visible));
  }, [placeId]);
  React.useEffect(() => {
    void load();
  }, [load]);

  async function add(url: string) {
    if (!url) return;
    const top = Math.max(-1, ...(list ?? []).map((a) => a.position));
    const r = await upsertAssetAction({ placeId, kind: "image", url, source: "upload", visible: true, position: top + 1 }).catch(() => ({ ok: false as const, error: "Could not add the picture." }));
    if (!r.ok) return void toast.error(r.error);
    toast.success("Picture added to the place");
    await load();
  }
  async function remove(a: TourAsset) {
    if (!window.confirm("Take this picture off the place? The file stays in the place's folder.")) return;
    const r = await archiveAssetAction(a.id).catch(() => ({ ok: false as const, error: "Could not remove it." }));
    if (!r.ok) return void toast.error(r.error);
    await load();
  }

  return (
    <div className="space-y-2">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Pictures</span>
      {list && list.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {list.map((a) => (
            <li key={a.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.url!} alt={a.altText ?? ""} className="h-16 w-24 border border-border object-cover" />
              <button type="button" onClick={() => remove(a)} aria-label="Take this picture off the place" className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-background/90 text-xs">
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {list && list.length === 0 && <p className="text-xs text-muted-foreground">No pictures yet.</p>}
      <MediaField value="" onChange={(url) => void add(url)} label="Add a picture" destination={{ kind: "place", placeId }} />
    </div>
  );
}
