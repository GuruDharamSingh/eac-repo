"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { MediaLibrary, type MediaLibraryFile, type MediaLibrarySource } from "@elkdonis/content/media-library";
import { Button } from "@elkdonis/primitives";
import type { MediaDestination } from "@/lib/media-destination";

interface MediaFieldProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  hint?: string;
  /**
   * Where the file goes (docs/open/ELKTOURS_MEDIA_STRUCTURE_2026-11-26.md §3): a tour's cover or stop, a place.
   * Unset: Media/Images. The server links a file that already belongs there and copies anything else in.
   */
  destination?: MediaDestination;
  /** Which files to offer. Default pictures. */
  accept?: string;
}

const SRC = "/api/media/sources";

/** The sources the picker offers for a destination: its own folder first, then places, the org, the person's own. */
function sourcesFor(dest: MediaDestination | undefined): MediaLibrarySource[] {
  const out: MediaLibrarySource[] = [];
  const tourId = dest?.kind === "tour" ? dest.tourId : null;
  if (tourId) out.push({ key: "tour", label: "This tour", endpoint: `${SRC}/tour?tour=${encodeURIComponent(tourId)}` });
  if (dest?.kind === "place") out.push({ key: "place", label: "This place", endpoint: `${SRC}/place?place=${encodeURIComponent(dest.placeId)}` });
  out.push({ key: "places", label: "Places", endpoint: tourId ? `${SRC}/places?tour=${encodeURIComponent(tourId)}` : `${SRC}/places` });
  out.push({ key: "org", label: "Org", endpoint: `${SRC}/org` });
  out.push({ key: "mine", label: "My files", endpoint: `${SRC}/mine` });
  out.push({ key: "stops", label: "Stop folders", endpoint: `${SRC}/stops` });
  return out;
}

/**
 * Pick a picture: the one picker (@elkdonis/content MediaLibrary) over this site's sources, with upload into the
 * destination's folder. A pick from elsewhere is copied in by /api/media/attach (2026-11-26); the field stores the
 * URL it answers with, as before.
 */
export function MediaField({ value, onChange, label = "Image", hint, destination, accept = "image/*" }: MediaFieldProps) {
  const [open, setOpen] = React.useState(!value);
  const [busy, setBusy] = React.useState(false);
  // Keyed by the destination's content, not its identity: callers pass a fresh object on every render, and a new
  // sources list would make the library fetch again.
  const destJson = JSON.stringify(destination ?? { kind: "general" });
  const sources = React.useMemo(() => sourcesFor(JSON.parse(destJson) as MediaDestination), [destJson]);
  const tourId = destination?.kind === "tour" ? destination.tourId : undefined;

  async function pick(file: MediaLibraryFile) {
    if (file.source === "upload") {
      onChange(file.url);
      setOpen(false);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/media/attach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: file.source, path: file.path, url: file.url, tour: tourId, destination: JSON.parse(destJson) }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; copied?: boolean; error?: string };
      if (!res.ok || !data.url) {
        toast.error(data.error ?? "Could not use that file.");
        return;
      }
      if (data.copied) toast.success("Copied into this tour's folder.".replace("this tour's", destination?.kind === "place" ? "the place's" : destination?.kind === "tour" ? "the tour's" : "the site's"));
      onChange(data.url);
      setOpen(false);
    } catch {
      toast.error("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium">{label}</span>

      {value ? (
        <div className="flex items-start gap-4 rounded-lg border border-border p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="size-24 shrink-0 rounded-md border border-border object-cover" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-muted-foreground">{decodeURI(value.split("/").pop() ?? value)}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
                {open ? "Close the library" : "Change"}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => onChange("")}>
                <Trash2 className="size-4" aria-hidden />
                Remove
              </Button>
            </div>
          </div>
        </div>
      ) : !open ? (
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
          Choose a picture
        </Button>
      ) : null}

      {open ? (
        <div className="elk-media-field max-h-[34rem] overflow-y-auto rounded-lg border border-border p-3" aria-busy={busy}>
          <MediaLibrary
            mode="pick"
            sources={sources}
            value={value || undefined}
            accept={accept}
            rememberAs={`elk-mlib:${destination?.kind ?? "general"}`}
            upload={{ endpoint: "/api/media/upload-to", fields: { destination: destJson }, label: "Upload" }}
            onPick={(f) => void pick(f)}
          />
        </div>
      ) : null}

      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
