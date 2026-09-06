"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, MapPin, X } from "lucide-react";
import { toast } from "sonner";
import { MapPanel } from "@/components/map/map-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { siteConfig } from "@/config/site";
import type { Criterion, Species } from "@/lib/types";

type Role = "front" | "side" | "detail" | "context";

interface Uploaded {
  mediaId: string;
  role: Role;
  url: string;
  cardUrl: string;
  cardWidth: number;
  cardHeight: number;
  width: number;
  height: number;
}

interface SubmitFormProps {
  species: Species[];
  criteria: Criterion[];
  cityCenter: [number, number];
  cityZoom: number;
}

const ROLE_LABELS: Record<Role, string> = {
  front: "Front-on",
  side: "Side profile",
  detail: "Detail",
  context: "Context",
};

/**
 * The whole submission, on one page.
 *
 * Photos upload as soon as they're chosen rather than on submit, for two
 * reasons: the wait happens while the contributor is still writing, and the
 * server can hand back the EXIF GPS in time to place the map pin for them.
 * That "the pin is already on the right corner" moment is the best thing in
 * the flow, and it only works if the upload happens first.
 */
export function SubmitForm({ species, criteria, cityCenter, cityZoom }: SubmitFormProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [images, setImages] = useState<Uploaded[]>([]);
  const [uploading, setUploading] = useState(0);
  const [title, setTitle] = useState("");
  const [story, setStory] = useState("");
  const [speciesId, setSpeciesId] = useState<string>("");
  const [proposed, setProposed] = useState("");
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [geoSource, setGeoSource] = useState<"pin" | "exif">("pin");
  const [blurLocation, setBlurLocation] = useState(false);
  const [areaName, setAreaName] = useState<string | null>(null);
  const [spottedAt, setSpottedAt] = useState<string | null>(null);
  const [claims, setClaims] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const submitterCriteria = criteria.filter((c) => c.source === "submitter");
  const autoCriteria = criteria.filter((c) => c.source === "auto");

  /** Ask the server which neighbourhood a pin lands in, for live feedback. */
  useEffect(() => {
    if (!pin) {
      setAreaName(null);
      return;
    }
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/areas/resolve?lat=${pin.lat}&lng=${pin.lng}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        setAreaName(data.area?.areaName ?? null);
      } catch {
        /* aborted or offline — the label just stays blank */
      }
    }, 250);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [pin]);

  const nextRole = useCallback(
    (existing: Uploaded[]): Role => {
      if (!existing.some((i) => i.role === "front")) return "front";
      if (!existing.some((i) => i.role === "side")) return "side";
      return "detail";
    },
    []
  );

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    const room = 4 - images.length;
    if (room <= 0) {
      toast.error("Four photos is the most a card can hold.");
      return;
    }

    for (const file of Array.from(files).slice(0, room)) {
      setUploading((n) => n + 1);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          toast.error(data.error ?? "That photo didn't upload.");
          continue;
        }

        setImages((prev) => {
          const role = nextRole(prev);
          return [
            ...prev,
            {
              mediaId: data.id,
              role,
              url: data.url,
              cardUrl: data.card.url,
              cardWidth: data.card.width,
              cardHeight: data.card.height,
              width: data.width,
              height: data.height,
            },
          ];
        });

        // The payoff: the phone already knows where this was taken.
        if (data.exif?.lat != null && data.exif?.lng != null) {
          setPin((current) => {
            if (current) return current; // never overwrite a pin they placed
            setGeoSource("exif");
            toast.success("Found where this was taken — check the pin.");
            return { lat: data.exif.lat, lng: data.exif.lng };
          });
        }
        if (data.exif?.capturedAt) setSpottedAt((c) => c ?? data.exif.capturedAt);
      } catch {
        toast.error("Couldn't reach the server.");
      } finally {
        setUploading((n) => n - 1);
      }
    }

    if (fileRef.current) fileRef.current.value = "";
  }

  function setRole(mediaId: string, role: Role) {
    setImages((prev) =>
      prev.map((i) =>
        i.mediaId === mediaId
          ? { ...i, role }
          : // front and side are exclusive — whoever held it gets demoted
            (role === "front" || role === "side") && i.role === role
            ? { ...i, role: "detail" }
            : i
      )
    );
  }

  async function submit() {
    if (images.length === 0) {
      toast.error("A card needs at least one photo.");
      return;
    }
    if (!title.trim()) {
      toast.error("Give the bird a name.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          story: story.trim() || null,
          images: images.map((i) => ({
            mediaId: i.mediaId,
            role: i.role,
            cardUrl: i.cardUrl,
            cardWidth: i.cardWidth,
            cardHeight: i.cardHeight,
          })),
          speciesId: speciesId || null,
          proposedSpeciesName: speciesId ? null : proposed.trim() || null,
          lat: pin?.lat ?? null,
          lng: pin?.lng ?? null,
          geoSource: pin ? geoSource : "none",
          geoPrecision: blurLocation ? "block" : "exact",
          spottedAt,
          claimedCriteria: [...claims],
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(data.error ?? "Couldn't save that card.");
        return;
      }
      router.push(`/submit/done/${data.slug}`);
    } catch {
      toast.error("Couldn't reach the server.");
    } finally {
      setSubmitting(false);
    }
  }

  const busy = uploading > 0 || submitting;

  return (
    <div className="space-y-10">
      {/* ── 1. Photos ─────────────────────────────────────────────────── */}
      <section>
        <SectionHeading n={1} title="The photos" />
        <p className="mt-1 text-sm text-muted-foreground">
          One is enough. A front-on shot and a side profile make a much better card.
        </p>

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
          multiple
          capture="environment"
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
        />

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((img) => (
            <div key={img.mediaId} className="overflow-hidden rounded-lg border border-border">
              <div className="relative aspect-[3/4] bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.cardUrl} alt="" className="size-full object-cover" />
                <button
                  type="button"
                  onClick={() => setImages((p) => p.filter((i) => i.mediaId !== img.mediaId))}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                  aria-label="Remove this photo"
                >
                  <X className="size-3.5" />
                </button>
              </div>
              <div className="flex flex-wrap gap-1 p-1.5">
                {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(img.mediaId, r)}
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px]",
                      img.role === r
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-accent"
                    )}
                  >
                    {ROLE_LABELS[r]}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {images.length < 4 && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading > 0}
              className="flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-foreground disabled:opacity-60"
            >
              {uploading > 0 ? (
                <Loader2 className="size-6 animate-spin" />
              ) : (
                <Camera className="size-6" />
              )}
              <span className="text-xs">{uploading > 0 ? "Uploading…" : "Add a photo"}</span>
            </button>
          )}
        </div>

        <p className="mt-2 text-xs text-muted-foreground">
          JPEG, PNG or WebP, up to {siteConfig.maxUploadMb}MB. Location and camera details are
          stripped from the file before it&apos;s stored.
        </p>
      </section>

      {/* ── 2. Where ──────────────────────────────────────────────────── */}
      <section>
        <SectionHeading n={2} title="Where you found it" />
        <p className="mt-1 text-sm text-muted-foreground">
          {pin
            ? geoSource === "exif"
              ? "Taken from the photo — drag the pin if it's off."
              : "Drag the pin, or tap the map to move it."
            : "Tap the map where you saw it."}
        </p>

        <MapPanel
          center={pin ? [pin.lat, pin.lng] : cityCenter}
          zoom={pin ? 15 : cityZoom}
          picker
          pickerPosition={pin}
          onPick={(lat, lng) => {
            setPin({ lat, lng });
            setGeoSource("pin");
          }}
          className="mt-4 h-72"
        />

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-sm">
            <MapPin className="size-4 text-primary" />
            {areaName ? (
              <span className="font-medium">{areaName}</span>
            ) : pin ? (
              <span className="text-muted-foreground">Outside the mapped neighbourhoods</span>
            ) : (
              <span className="text-muted-foreground">No location yet</span>
            )}
          </p>

          {pin && (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Switch checked={blurLocation} onCheckedChange={setBlurLocation} />
              Blur this location
            </label>
          )}
        </div>
        {blurLocation && (
          <p className="mt-1 text-xs text-muted-foreground">
            The pin will be shifted about 100m on public maps. Use this if you shot it from home.
          </p>
        )}
      </section>

      {/* ── 3. What it is ─────────────────────────────────────────────── */}
      <section>
        <SectionHeading n={3} title="What it is" />
        <div className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Name this bird</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Cappuccino by the fish shop"
              maxLength={120}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Species</Label>
            <div className="flex flex-wrap gap-2">
              {species.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setSpeciesId(speciesId === s.id ? "" : s.id);
                    setProposed("");
                  }}
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm transition-colors",
                    speciesId === s.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:border-primary"
                  )}
                  title={s.tagline ?? undefined}
                >
                  {s.name}
                </button>
              ))}
            </div>
            {!speciesId && (
              <Input
                value={proposed}
                onChange={(e) => setProposed(e.target.value)}
                placeholder="Or name a new kind — “Tuxedo”, “Sock Foot”…"
                maxLength={80}
                className="mt-2"
              />
            )}
            {!speciesId && proposed.trim() && (
              <p className="text-xs text-muted-foreground">
                New species are reviewed before they join the library. Your card publishes either
                way.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="story">Its story (optional)</Label>
            <Textarea
              id="story"
              value={story}
              onChange={(e) => setStory(e.target.value)}
              placeholder="One line about what it was doing."
              maxLength={2000}
              rows={3}
            />
          </div>
        </div>
      </section>

      {/* ── 4. The rubric ─────────────────────────────────────────────── */}
      <section>
        <SectionHeading n={4} title="How good is the shot?" />
        <p className="mt-1 text-sm text-muted-foreground">
          Tick what applies. These are claims, not scores — the final rating is made by a human.
        </p>

        <div className="mt-4 space-y-2.5">
          {submitterCriteria.map((c) => (
            <label key={c.key} className="flex cursor-pointer items-start gap-3">
              <Checkbox
                checked={claims.has(c.key)}
                onCheckedChange={(on) =>
                  setClaims((prev) => {
                    const next = new Set(prev);
                    if (on) next.add(c.key);
                    else next.delete(c.key);
                    return next;
                  })
                }
                className="mt-0.5"
              />
              <span className="text-sm">
                <span className="font-medium">{c.label}</span>
                {c.hint && (
                  <span className="block text-xs text-muted-foreground">{c.hint}</span>
                )}
              </span>
            </label>
          ))}
        </div>

        {autoCriteria.length > 0 && (
          <p className="mt-4 rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">
            Checked automatically from your photos:{" "}
            {autoCriteria.map((c) => c.label).join(", ")}.
          </p>
        )}
      </section>

      <div className="flex items-center gap-3 border-t border-border pt-6">
        <Button size="lg" onClick={submit} disabled={busy || images.length === 0}>
          {submitting ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" /> Publishing…
            </>
          ) : (
            "Publish this card"
          )}
        </Button>
        <p className="text-xs text-muted-foreground">
          Goes live immediately. No account needed.
        </p>
      </div>
    </div>
  );
}

function SectionHeading({ n, title }: { n: number; title: string }) {
  return (
    <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
      <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
        {n}
      </span>
      {title}
    </h2>
  );
}
