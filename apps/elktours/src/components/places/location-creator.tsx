"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { Button, Input, Label } from "@elkdonis/primitives";
import type { Place, PlaceInput, ReverseGeocode, StopDraft } from "@/lib/catalogue-types";
import {
  attachPhotoToPinAction,
  createPlaceFromPhoto,
  createPlaceFromPin,
  discardPendingPhotoAction,
  reverseGeocodeAction,
} from "@/lib/custom-place-actions";
import { savePlaceAction } from "@/lib/place-actions";
import type { LatLng } from "@/components/places/pin-map";

const PinMap = dynamic(() => import("@/components/places/pin-map").then((m) => m.PinMap), {
  ssr: false,
  loading: () => <div className="h-64 w-full bg-muted" />,
});

export interface CreatedLocation {
  place: Place;
  stop: StopDraft;
}

type Mode = "pin" | "photo";

function errText(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

/** Every editable field of a saved place, so a position fix never clears the rest. */
function placeInput(p: Place, at: LatLng): PlaceInput {
  return {
    id: p.id,
    title: p.title,
    body: p.body,
    privateNotes: p.privateNotes,
    lat: at.lat,
    lng: at.lng,
    heading: p.heading,
    pitch: p.pitch,
    fov: p.fov,
    address: p.address,
    tags: p.tags,
  };
}

/** A stop draft that follows a corrected pin. */
function moved(stop: StopDraft, at: LatLng): StopDraft {
  return { ...stop, lat: at.lat, lng: at.lng };
}

/**
 * Make a custom location: drop a pin on the map (title and address
 * suggested by reverse geocoding, editable), or upload a photo whose geotag
 * places the pin (drag to correct). A photo with no geotag is kept and the
 * editor is asked for a pin. Used by /manage/places ("New place") and the
 * tour builder's New tab; `onCreated` gets the catalogue place and a stop
 * draft (copy on pick).
 */
export function LocationCreator({
  center,
  onCreated,
  compact = false,
}: {
  center?: LatLng | null;
  onCreated: (created: CreatedLocation) => void;
  /** Narrow column (the builder's picker). */
  compact?: boolean;
}) {
  const [mode, setMode] = React.useState<Mode>("pin");
  const mapClass = compact ? "h-56 w-full" : "h-72 w-full";
  return (
    <div className="space-y-3">
      <div className="flex border border-border" role="group" aria-label="How to add the location">
        {(["pin", "photo"] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => setMode(m)}
            className={`flex-1 px-3 py-1.5 text-sm ${mode === m ? "bg-accent font-medium" : "text-muted-foreground hover:text-foreground"}`}
          >
            {m === "pin" ? "Drop a pin" : "From a photo"}
          </button>
        ))}
      </div>
      {mode === "pin" ? (
        <PinCreator center={center} onCreated={onCreated} mapClass={mapClass} />
      ) : (
        <PhotoCreator center={center} onCreated={onCreated} mapClass={mapClass} />
      )}
    </div>
  );
}

/** Title and address, prefilled from reverse geocoding until the editor types. */
function useNaming() {
  const [title, setTitle] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [reverse, setReverse] = React.useState<ReverseGeocode | null>(null);
  const [looking, setLooking] = React.useState(false);
  const touched = React.useRef({ title: false, address: false });
  const seq = React.useRef(0);

  const lookup = React.useCallback(async (p: LatLng) => {
    const n = ++seq.current;
    setLooking(true);
    const r = await reverseGeocodeAction(p.lat, p.lng).catch(() => null);
    if (n !== seq.current) return; // a later pin won
    setLooking(false);
    setReverse(r);
    if (r?.title && !touched.current.title) setTitle(r.title);
    if (r?.address && !touched.current.address) setAddress(r.address);
  }, []);

  const fields = (idPrefix: string) => (
    <div className="grid gap-2">
      <div>
        <Label htmlFor={`${idPrefix}-title`}>Name</Label>
        <Input
          id={`${idPrefix}-title`}
          value={title}
          placeholder={looking ? "Looking up the place…" : "Name of the place"}
          onChange={(e) => {
            touched.current.title = true;
            setTitle(e.target.value);
          }}
        />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-address`}>Address</Label>
        <Input
          id={`${idPrefix}-address`}
          value={address}
          onChange={(e) => {
            touched.current.address = true;
            setAddress(e.target.value);
          }}
        />
      </div>
      {reverse && (
        <p className="text-xs text-muted-foreground">
          Suggested from{" "}
          <a href={reverse.attributionUrl} target="_blank" rel="noopener" className="underline">
            {reverse.attribution}
          </a>
          {reverse.category ? ` · ${reverse.category.replace(/_/g, " ")}` : ""}
        </p>
      )}
    </div>
  );

  const reset = () => {
    setTitle("");
    setAddress("");
    setReverse(null);
    touched.current = { title: false, address: false };
  };

  return { title, address, lookup, fields, reset };
}

function PinCreator({ center, onCreated, mapClass }: { center?: LatLng | null; onCreated: (c: CreatedLocation) => void; mapClass: string }) {
  const [pin, setPin] = React.useState<LatLng | null>(null);
  const [busy, setBusy] = React.useState(false);
  const naming = useNaming();

  function place(p: LatLng) {
    setPin(p);
    void naming.lookup(p);
  }

  async function create() {
    if (!pin) return;
    setBusy(true);
    const r = await createPlaceFromPin({
      lat: pin.lat,
      lng: pin.lng,
      title: naming.title.trim() || null,
      address: naming.address.trim() || null,
    }).catch((e: unknown) => ({ ok: false as const, error: errText(e, "Could not create the place.") }));
    setBusy(false);
    if (!r.ok) return void toast.error(r.error);
    toast.success(`${r.place.title} added to the catalogue`);
    setPin(null);
    naming.reset();
    onCreated({ place: r.place, stop: r.stop });
  }

  return (
    <div className="space-y-3">
      <PinMap value={pin} onChange={place} center={center} className={mapClass} />
      {pin && (
        <>
          {naming.fields("pin")}
          <Button type="button" disabled={busy} onClick={create}>
            {busy ? "Creating…" : "Create place here"}
          </Button>
        </>
      )}
    </div>
  );
}

type PhotoState =
  | { step: "choose" }
  | { step: "uploading" }
  /** Geotagged: the place exists; the pin can still be corrected before it is used. */
  | { step: "confirm"; created: CreatedLocation; original: LatLng }
  /** No geotag: the photo is kept; a pin is needed to make the place. */
  | { step: "needsPin"; assetId: string };

function PhotoCreator({ center, onCreated, mapClass }: { center?: LatLng | null; onCreated: (c: CreatedLocation) => void; mapClass: string }) {
  const [state, setState] = React.useState<PhotoState>({ step: "choose" });
  const [preview, setPreview] = React.useState<string | null>(null);
  const [pin, setPin] = React.useState<LatLng | null>(null);
  const [busy, setBusy] = React.useState(false);
  const input = React.useRef<HTMLInputElement>(null);
  const naming = useNaming();

  // Revoke the local preview URL when it is replaced or the panel closes.
  React.useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  function restart() {
    setState({ step: "choose" });
    setPreview(null);
    setPin(null);
    naming.reset();
  }

  async function upload(file: File) {
    // HEIC does not preview in most browsers; the upload still works.
    setPreview(URL.createObjectURL(file));
    setState({ step: "uploading" });
    const fd = new FormData();
    fd.append("file", file);
    const r = await createPlaceFromPhoto(fd).catch((e: unknown) => ({ ok: false as const, error: errText(e, "Could not read that photo.") }));
    if (!r.ok) {
      toast.error(r.error);
      return restart();
    }
    if (r.needsPin === false) {
      const at = { lat: r.place.lat ?? r.geo.lat ?? 0, lng: r.place.lng ?? r.geo.lng ?? 0 };
      setPin(at);
      setState({ step: "confirm", created: { place: r.place, stop: r.stop }, original: at });
    } else {
      setState({ step: "needsPin", assetId: r.assetId });
      toast.message("This photo has no location in it. Drop a pin where it was taken.");
    }
  }

  async function confirm() {
    if (state.step !== "confirm" || !pin) return;
    const { created, original } = state;
    if (pin.lat === original.lat && pin.lng === original.lng) {
      toast.success(`${created.place.title} added to the catalogue`);
      onCreated(created);
      return restart();
    }
    setBusy(true);
    const r = await savePlaceAction(placeInput(created.place, pin)).catch((e: unknown) => ({ ok: false as const, error: errText(e, "Could not move the pin.") }));
    setBusy(false);
    if (!r.ok) return void toast.error(r.error);
    toast.success(`${r.place.title} added to the catalogue`);
    onCreated({ place: r.place, stop: moved(created.stop, pin) });
    restart();
  }

  async function attach() {
    if (state.step !== "needsPin" || !pin) return;
    setBusy(true);
    const r = await attachPhotoToPinAction(state.assetId, {
      lat: pin.lat,
      lng: pin.lng,
      title: naming.title.trim() || null,
      address: naming.address.trim() || null,
    }).catch((e: unknown) => ({ ok: false as const, error: errText(e, "Could not create the place.") }));
    setBusy(false);
    if (!r.ok) return void toast.error(r.error);
    toast.success(`${r.place.title} added to the catalogue`);
    onCreated({ place: r.place, stop: r.stop });
    restart();
  }

  async function discard() {
    if (state.step === "needsPin") await discardPendingPhotoAction(state.assetId).catch(() => null);
    restart();
  }

  return (
    <div className="space-y-3">
      {state.step === "choose" && (
        <>
          <p className="text-sm text-muted-foreground">
            A photo taken on a phone usually carries where it was taken. The original stays private; anything shown publicly has its
            location data removed.
          </p>
          <Button type="button" variant="outline" onClick={() => input.current?.click()}>
            Choose a photo
          </Button>
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void upload(f);
            }}
          />
        </>
      )}

      {preview && state.step !== "choose" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="The uploaded photo" className="max-h-56 w-full border border-border bg-muted object-contain" />
      )}

      {state.step === "uploading" && <p className="text-sm text-muted-foreground">Reading the photo…</p>}

      {state.step === "confirm" && (
        <>
          <p className="text-sm">
            Placed from the photo&apos;s location as <strong>{state.created.place.title}</strong>. Drag the pin if it is off.
          </p>
          <PinMap value={pin} onChange={setPin} center={center} className={mapClass} />
          <Button type="button" disabled={busy} onClick={confirm}>
            {busy ? "Saving…" : "Use this location"}
          </Button>
        </>
      )}

      {state.step === "needsPin" && (
        <>
          <p className="text-sm text-amber-800">
            This photo has no location in it. It is kept; drop a pin where it was taken to make the place.
          </p>
          <PinMap
            value={pin}
            onChange={(p) => {
              setPin(p);
              void naming.lookup(p);
            }}
            center={center}
            className={mapClass}
          />
          {pin && naming.fields("photo")}
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={busy || !pin} onClick={attach}>
              {busy ? "Creating…" : "Create place here"}
            </Button>
            <Button type="button" variant="ghost" disabled={busy} onClick={discard}>
              Discard photo
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
