"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import type { RouteItem, RoutePreview } from "@/lib/catalogue-types";
import {
  previewRouteAction,
  suggestionAllowanceAction,
  suggestRouteAction,
  suggestSpotAction,
  suggestSpotFromPhotoAction,
} from "@/lib/suggestion-actions";
import type { LatLng } from "@/components/places/pin-map";
import type { CataloguePlaceView } from "@/components/places/catalogue-view";

const PinMap = dynamic(() => import("@/components/places/pin-map").then((m) => m.PinMap), {
  ssr: false,
  loading: () => <div className="h-64 w-full bg-muted" />,
});
const PlacesMap = dynamic(() => import("@/components/places/places-map").then((m) => m.PlacesMap), {
  ssr: false,
  loading: () => <div className="h-72 w-full bg-muted" />,
});

type Allowance = Awaited<ReturnType<typeof suggestionAllowanceAction>>;

function errText(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

const field = "w-full rounded-md border border-border bg-background p-2 text-sm";
const primaryBtn = "bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50";

/**
 * "Suggest a spot" and "Suggest a route" on the public catalogue. Signed-in
 * followers may suggest (rate-limited, lib/suggestion-actions.ts); a signed-in
 * visitor who does not follow yet gets a one-click Follow, a signed-out one a
 * sign-in link. Suggestions go to the editors' queue (/manage/suggestions);
 * nothing is published by suggesting.
 */
export function VisitorSuggest({ places }: { places: CataloguePlaceView[] }) {
  const [allow, setAllow] = React.useState<Allowance | null>(null);
  const [mode, setMode] = React.useState<"spot" | "route" | null>(null);
  const load = React.useCallback(async () => {
    setAllow(await suggestionAllowanceAction().catch(() => ({ signedIn: false, canSuggest: false, usedToday: 0, limit: 0 })));
  }, []);
  React.useEffect(() => {
    void load();
  }, [load]);

  if (!allow) return null;

  let gate: React.ReactNode = null;
  if (!allow.signedIn) {
    gate = (
      <p className="text-sm text-muted-foreground">
        <a href={`/login?next=${encodeURIComponent("/places")}`} className="underline underline-offset-4">
          Sign in
        </a>{" "}
        and follow us to suggest a spot or a walk.
      </p>
    );
  } else if (!allow.canSuggest && allow.usedToday < allow.limit) {
    gate = <FollowToSuggest onFollowed={load} />;
  } else if (allow.usedToday >= allow.limit) {
    gate = <p className="text-sm text-muted-foreground">Thank you: that is today&apos;s {allow.limit} suggestions. Come back tomorrow.</p>;
  }

  return (
    <section className="space-y-4 border border-border bg-card p-5" aria-labelledby="suggest-title">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="suggest-title" className="font-serif text-2xl">
          Know a place we should show?
        </h2>
        {!gate && (
          <div className="flex gap-2" role="group" aria-label="Suggest">
            <button type="button" aria-pressed={mode === "spot"} onClick={() => setMode(mode === "spot" ? null : "spot")} className={`border px-3 py-1.5 text-sm ${mode === "spot" ? "border-primary" : "border-border"}`}>
              Suggest a spot
            </button>
            <button type="button" aria-pressed={mode === "route"} onClick={() => setMode(mode === "route" ? null : "route")} className={`border px-3 py-1.5 text-sm ${mode === "route" ? "border-primary" : "border-border"}`}>
              Suggest a route
            </button>
          </div>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        Suggest a spot, or a walk through places you love. The guides read every suggestion; accepted ones are added with your name.
      </p>
      {gate}
      {!gate && mode === "spot" && <SuggestSpot onDone={() => { setMode(null); void load(); }} />}
      {!gate && mode === "route" && <SuggestRoute places={places} onDone={() => { setMode(null); void load(); }} />}
      {!gate && allow.limit > 0 && <p className="text-xs text-muted-foreground">{allow.usedToday} of {allow.limit} suggestions used today.</p>}
    </section>
  );
}

function FollowToSuggest({ onFollowed }: { onFollowed: () => void }) {
  const [busy, setBusy] = React.useState(false);
  return (
    <p className="text-sm text-muted-foreground">
      Follow us to suggest a spot or a walk.{" "}
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const res = await fetch("/api/center/follow", { method: "POST" }).catch(() => null);
          setBusy(false);
          if (!res?.ok) return void toast.error("Could not follow just now.");
          toast.success("You follow us now");
          onFollowed();
        }}
        className="font-medium text-foreground underline underline-offset-4 disabled:opacity-50"
      >
        {busy ? "Following…" : "Follow"}
      </button>
    </p>
  );
}

/** A spot: a pin (or a photo whose geotag places it), a title and why. */
function SuggestSpot({ onDone }: { onDone: () => void }) {
  const [how, setHow] = React.useState<"pin" | "photo">("pin");
  const [pin, setPin] = React.useState<LatLng | null>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [needsPin, setNeedsPin] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [why, setWhy] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return void toast.error("Give the spot a name.");
    setBusy(true);
    try {
      if (how === "photo" && file) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("title", title.trim());
        if (why.trim()) fd.append("why", why.trim());
        if (pin) {
          fd.append("lat", String(pin.lat));
          fd.append("lng", String(pin.lng));
        }
        const r = await suggestSpotFromPhotoAction(fd);
        if (!r.ok) throw new Error(r.error);
        if ("needsPin" in r && r.needsPin) {
          setNeedsPin(true);
          toast.message("The photo has no location in it. Drop a pin where it was taken, then send again.");
          return;
        }
      } else {
        if (!pin) throw new Error("Drop a pin on the map first.");
        const r = await suggestSpotAction({ title: title.trim(), why: why.trim() || null, lat: pin.lat, lng: pin.lng });
        if (!r.ok) throw new Error(r.error);
      }
      toast.success("Thank you. The guides will look at it.");
      onDone();
    } catch (x) {
      toast.error(errText(x, "Could not send the suggestion."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex border border-border" role="group" aria-label="How">
        {(["pin", "photo"] as const).map((h) => (
          <button key={h} type="button" aria-pressed={how === h} onClick={() => setHow(h)} className={`flex-1 px-3 py-1.5 text-sm ${how === h ? "bg-accent font-medium" : "text-muted-foreground"}`}>
            {h === "pin" ? "Drop a pin" : "From a photo"}
          </button>
        ))}
      </div>
      {how === "photo" && (
        <div className="space-y-2">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              setNeedsPin(false);
              setPreview(f ? URL.createObjectURL(f) : null);
            }}
            className="text-sm"
          />
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Your photo" className="max-h-56 w-full border border-border bg-muted object-contain" />
          )}
          <p className="text-xs text-muted-foreground">The photo stays private; only the guides see it.</p>
        </div>
      )}
      {(how === "pin" || needsPin) && <PinMap value={pin} onChange={setPin} />}
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What is it called?" maxLength={200} className={field} />
      <textarea value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Why should a walk stop here?" rows={3} maxLength={2000} className={field} />
      <button type="submit" disabled={busy || (how === "photo" && !file)} className={primaryBtn}>
        {busy ? "Sending…" : "Send the suggestion"}
      </button>
    </form>
  );
}

type Leg = { key: string; item: RouteItem; title: string; lat: number; lng: number };

/** A walk: catalogue places and the visitor's own spots, in order, with the walking line. */
function SuggestRoute({ places, onDone }: { places: CataloguePlaceView[]; onDone: () => void }) {
  const mapped = places.filter((p): p is CataloguePlaceView & { lat: number; lng: number } => p.lat != null && p.lng != null);
  const [legs, setLegs] = React.useState<Leg[]>([]);
  const [q, setQ] = React.useState("");
  const [own, setOwn] = React.useState<LatLng | null>(null);
  const [ownTitle, setOwnTitle] = React.useState("");
  const [preview, setPreview] = React.useState<RoutePreview | null>(null);
  const [title, setTitle] = React.useState("");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  // The walking line follows the list (2-15 items).
  React.useEffect(() => {
    if (legs.length < 2) return setPreview(null);
    let live = true;
    const t = window.setTimeout(async () => {
      const r = await previewRouteAction(legs.map((l) => l.item)).catch(() => null);
      if (live) setPreview(r && r.ok ? r.preview : null);
    }, 400);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [legs]);

  const add = (l: Leg) => {
    if (legs.length >= 15) return void toast.error("Up to 15 stops.");
    setLegs((list) => [...list, l]);
  };
  const move = (i: number, d: -1 | 1) =>
    setLegs((list) => {
      const j = i + d;
      if (j < 0 || j >= list.length) return list;
      const next = list.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const needle = q.trim().toLowerCase();
  const choices = mapped.filter((p) => !legs.some((l) => l.key === p.id) && (!needle || p.title.toLowerCase().includes(needle))).slice(0, 30);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (legs.length < 2) return void toast.error("A walk needs at least two stops.");
    if (!title.trim()) return void toast.error("Give the walk a title.");
    setBusy(true);
    const r = await suggestRouteAction({ title: title.trim(), note: note.trim() || null, items: legs.map((l) => l.item) }).catch((x: unknown) => ({ ok: false as const, error: errText(x, "Could not send.") }));
    setBusy(false);
    if (!r.ok) return void toast.error(r.error);
    toast.success("Thank you. The guides will look at your walk.");
    onDone();
  }

  return (
    <form onSubmit={submit} className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start">
      <div className="space-y-3">
        <p className="text-sm font-medium">1. Pick the stops, in order</p>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the places" className={field} />
        <ul className="max-h-52 divide-y divide-border overflow-auto border border-border text-sm">
          {choices.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 px-2 py-1.5">
              <span className="truncate">{p.title}</span>
              <button type="button" onClick={() => add({ key: p.id, item: { placeId: p.id }, title: p.title, lat: p.lat, lng: p.lng })} className="shrink-0 underline underline-offset-4">
                Add
              </button>
            </li>
          ))}
          {choices.length === 0 && <li className="px-2 py-1.5 text-muted-foreground">No more places match.</li>}
        </ul>
        <details className="text-sm">
          <summary className="cursor-pointer underline underline-offset-4">Add a spot of your own</summary>
          <div className="mt-2 space-y-2">
            <PinMap value={own} onChange={setOwn} className="h-56 w-full" />
            <div className="flex gap-2">
              <input value={ownTitle} onChange={(e) => setOwnTitle(e.target.value)} placeholder="Its name" className={field} />
              <button
                type="button"
                disabled={!own || !ownTitle.trim()}
                onClick={() => {
                  if (!own) return;
                  add({ key: `own-${Date.now()}`, item: { lat: own.lat, lng: own.lng, title: ownTitle.trim() }, title: ownTitle.trim(), lat: own.lat, lng: own.lng });
                  setOwn(null);
                  setOwnTitle("");
                }}
                className="shrink-0 border border-border px-3 text-sm disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        </details>

        <ol className="space-y-1 text-sm">
          {legs.map((l, i) => (
            <li key={l.key} className="flex items-center gap-2 border border-border px-2 py-1">
              <span className="w-5 text-right font-medium">{i + 1}.</span>
              <span className="min-w-0 flex-1 truncate">
                {l.title}
                {"placeId" in l.item ? "" : " (your spot)"}
              </span>
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${l.title} up`} className="px-1 disabled:opacity-30">↑</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === legs.length - 1} aria-label={`Move ${l.title} down`} className="px-1 disabled:opacity-30">↓</button>
              <button type="button" onClick={() => setLegs((list) => list.filter((x) => x.key !== l.key))} aria-label={`Remove ${l.title}`} className="px-1">✕</button>
            </li>
          ))}
        </ol>

        <p className="text-sm font-medium">2. Name it</p>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="A title for the walk" maxLength={200} className={field} />
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="A note for the guides (optional)" rows={3} maxLength={2000} className={field} />
        <button type="submit" disabled={busy || legs.length < 2} className={primaryBtn}>
          {busy ? "Sending…" : "Send the walk"}
        </button>
      </div>

      <div className="space-y-1 md:sticky md:top-20">
        <PlacesMap
          places={[...mapped, ...legs.filter((l) => !("placeId" in l.item)).map((l) => ({ id: l.key, title: l.title, lat: l.lat, lng: l.lng }))]}
          route={legs.map((l) => ({ id: l.key, title: l.title, lat: l.lat, lng: l.lng }))}
          legs={preview?.legs ?? null}
          className="h-80 w-full"
        />
        <p className="text-xs text-muted-foreground">
          {preview ? `About ${preview.km.toFixed(1)} km on foot${preview.source === "straight" ? " (straight lines: walking directions were unavailable)" : ""}.` : legs.length < 2 ? "Add two or more stops to see the walk." : "Working out the walk…"}{" "}
          Walking directions © OpenStreetMap contributors.
        </p>
      </div>
    </form>
  );
}
