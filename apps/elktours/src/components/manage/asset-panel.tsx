"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, Switch } from "@elkdonis/primitives";
import type { AssetKind, TourAsset } from "@/lib/catalogue-types";
import {
  archiveAssetAction,
  copyPlaceAssetToStopAction,
  setAssetVisibleAction,
  upsertAssetAction,
} from "@/lib/asset-actions";

export interface AssetPanelStop {
  id: string;
  position: number;
  title: string;
  placeId: string | null;
}

const KIND_LABEL: Record<AssetKind, string> = {
  film: "Film",
  poster: "Poster",
  image: "Image",
  still: "Street View still",
  map3d: "3D map (live)",
  streetview: "Street View (live)",
  document: "Document",
};

/** What an upload becomes, from its MIME type. */
function kindFor(mime: string): AssetKind {
  if (mime.startsWith("video/")) return "film";
  if (mime.startsWith("image/")) return "image";
  return "document";
}

/**
 * Upload a file to the org's Private media (shown only once switched on;
 * switching on copies it to public Media/, lib/asset-actions).
 */
async function uploadPrivate(file: File): Promise<{ url: string; mimeType: string }> {
  const form = new FormData();
  form.append("file", file);
  form.append("visibility", "ORGANIZATION");
  form.append("title", file.name);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  const json = (await res.json().catch(() => ({}))) as { url?: string; mimeType?: string; error?: string };
  if (!res.ok || !json.url) throw new Error(json.error ?? "Upload failed");
  return { url: json.url, mimeType: json.mimeType ?? file.type };
}

/**
 * /manage/tours/[id]/assets: everything a tour shows, each with its own
 * visible switch. The tour first, then one block per stop; the catalogue
 * media of a stop's place is offered under it ("Use for this stop" copies it
 * in, hidden). Live features (3D map, Street View) are switches with no file.
 * Nothing new is shown until it is switched on.
 */
export function AssetPanel({
  tourId,
  stops,
  assets: initial,
  placeAssets,
}: {
  tourId: string;
  stops: AssetPanelStop[];
  assets: TourAsset[];
  /** Catalogue assets per place id, offered to the stops that use the place. */
  placeAssets: Record<string, TourAsset[]>;
}) {
  const router = useRouter();
  const [assets, setAssets] = React.useState(initial);
  const [busy, setBusy] = React.useState<string | null>(null);
  React.useEffect(() => setAssets(initial), [initial]);

  const put = (a: TourAsset) => setAssets((list) => (list.some((x) => x.id === a.id) ? list.map((x) => (x.id === a.id ? a : x)) : [...list, a]));

  async function toggle(a: TourAsset, visible: boolean) {
    setBusy(a.id);
    put({ ...a, visible });
    const res = await setAssetVisibleAction(a.id, visible).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "Failed" }));
    setBusy(null);
    if (!res.ok) {
      put(a);
      toast.error(res.error);
      return;
    }
    put(res.asset);
    toast.success(visible ? "Shown on the tour page." : "Hidden from the tour page.");
    router.refresh();
  }

  async function upload(scope: { stopId: string | null }, file: File, replace?: TourAsset) {
    const key = replace?.id ?? `new-${scope.stopId ?? "tour"}`;
    setBusy(key);
    try {
      const { url, mimeType } = await uploadPrivate(file);
      const res = await upsertAssetAction(
        replace
          ? { id: replace.id, threadId: replace.threadId, stopId: replace.stopId, kind: replace.kind, role: replace.role, url, mimeType, source: "upload", visible: replace.visible }
          : { threadId: tourId, stopId: scope.stopId, kind: kindFor(mimeType), url, mimeType, source: "upload", visible: false, role: scope.stopId ? null : "gallery" }
      );
      if (!res.ok) throw new Error(res.error);
      put(res.asset);
      toast.success(replace ? "Replaced." : "Added, hidden until you switch it on.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(null);
    }
  }

  async function archive(a: TourAsset) {
    if (!confirm(`Remove this ${KIND_LABEL[a.kind].toLowerCase()}? It is kept in the history.`)) return;
    setBusy(a.id);
    const res = await archiveAssetAction(a.id).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "Failed" }));
    setBusy(null);
    if (!res.ok) return void toast.error(res.error);
    setAssets((list) => list.filter((x) => x.id !== a.id));
    router.refresh();
  }

  async function adoptPlaceAsset(placeAssetId: string, stopId: string) {
    setBusy(`${placeAssetId}:${stopId}`);
    const res = await copyPlaceAssetToStopAction(placeAssetId, stopId).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "Failed" }));
    setBusy(null);
    if (!res.ok) return void toast.error(res.error);
    put(res.asset);
    toast.success("Added to the stop, hidden until you switch it on.");
    router.refresh();
  }

  const live = assets.filter((a) => !a.archivedAt);
  const tourAssets = live.filter((a) => !a.stopId);

  return (
    <div className="space-y-8">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Every picture, film and live view the tour page can show. Only what is switched <strong>on</strong> appears on the
        site. New uploads and delivered fly-over films start switched off.
      </p>

      <AssetGroup
        title="Whole tour"
        assets={tourAssets}
        busy={busy}
        onToggle={toggle}
        onReplace={(a, f) => upload({ stopId: null }, f, a)}
        onArchive={archive}
        onUpload={(f) => upload({ stopId: null }, f)}
        uploading={busy === "new-tour"}
      />

      {stops.map((s, i) => {
        const offered = (s.placeId ? placeAssets[s.placeId] ?? [] : []).filter(
          (pa) => !live.some((a) => a.stopId === s.id && (a.meta?.fromPlaceAssetId === pa.id || (a.url && a.url === pa.url)))
        );
        return (
          <AssetGroup
            key={s.id}
            title={`${i + 1}. ${s.title}`}
            assets={live.filter((a) => a.stopId === s.id)}
            busy={busy}
            onToggle={toggle}
            onReplace={(a, f) => upload({ stopId: s.id }, f, a)}
            onArchive={archive}
            onUpload={(f) => upload({ stopId: s.id }, f)}
            uploading={busy === `new-${s.id}`}
          >
            {offered.length > 0 && (
              <div className="mt-3 rounded-md border border-dashed border-border p-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">From the places catalogue</p>
                <ul className="mt-2 flex flex-wrap gap-3">
                  {offered.map((pa) => (
                    <li key={pa.id} className="w-36">
                      <Preview asset={pa} />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="mt-1 w-full"
                        disabled={busy === `${pa.id}:${s.id}`}
                        onClick={() => adoptPlaceAsset(pa.id, s.id)}
                      >
                        Use for this stop
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </AssetGroup>
        );
      })}
    </div>
  );
}

function AssetGroup({
  title,
  assets,
  busy,
  onToggle,
  onReplace,
  onArchive,
  onUpload,
  uploading,
  children,
}: {
  title: string;
  assets: TourAsset[];
  busy: string | null;
  onToggle: (a: TourAsset, visible: boolean) => void;
  onReplace: (a: TourAsset, f: File) => void;
  onArchive: (a: TourAsset) => void;
  onUpload: (f: File) => void;
  uploading: boolean;
  children?: React.ReactNode;
}) {
  const sorted = [...assets].sort((a, b) => a.position - b.position || a.kind.localeCompare(b.kind));
  return (
    <section className="border-t border-border pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="font-serif text-lg">{title}</h3>
        <FileButton label={uploading ? "Uploading…" : "Upload"} disabled={uploading} onFile={onUpload} />
      </div>
      {sorted.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Nothing registered here yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border border border-border">
          {sorted.map((a) => (
            <AssetRow
              key={a.id}
              asset={a}
              busy={busy === a.id}
              onToggle={(v) => onToggle(a, v)}
              onReplace={(f) => onReplace(a, f)}
              onArchive={() => onArchive(a)}
            />
          ))}
        </ul>
      )}
      {children}
    </section>
  );
}

function AssetRow({
  asset: a,
  busy,
  onToggle,
  onReplace,
  onArchive,
}: {
  asset: TourAsset;
  busy: boolean;
  onToggle: (visible: boolean) => void;
  onReplace: (f: File) => void;
  onArchive: () => void;
}) {
  const isLive = a.kind === "map3d" || a.kind === "streetview";
  const stale = typeof a.meta?.payload_sha256 === "string" && a.meta?.stale === true;
  return (
    <li className="flex flex-wrap items-center gap-4 p-3">
      <div className="w-36 shrink-0">
        <Preview asset={a} />
      </div>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium">
          {KIND_LABEL[a.kind]}
          {a.role && <span className="ml-2 text-xs font-normal text-muted-foreground">{a.role}</span>}
          {a.variant && <span className="ml-1 text-xs font-normal text-muted-foreground">· {a.variant}</span>}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {[
            `Source: ${a.source}`,
            a.isPrivateFile ? "private file (copied to public when shown)" : null,
            a.seconds ? `${Math.round(a.seconds)} s` : null,
            a.renderRequestId ? "from a fly-over request" : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {(a.attribution || a.licenceNote) && (
          <p className="mt-0.5 text-xs text-muted-foreground">{[a.attribution, a.licenceNote].filter(Boolean).join(" · ")}</p>
        )}
        {stale && <p className="mt-0.5 text-xs text-amber-700">Film is older than the route.</p>}
      </div>
      <div className="flex items-center gap-3">
        {!isLive && <FileButton label="Replace" small onFile={onReplace} disabled={busy} />}
        {!isLive && (
          <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onArchive}>
            Remove
          </Button>
        )}
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={a.visible} disabled={busy} onCheckedChange={(v) => onToggle(Boolean(v))} aria-label={`Show ${KIND_LABEL[a.kind]}`} />
          <span className={a.visible ? "font-medium" : "text-muted-foreground"}>{a.visible ? "On" : "Off"}</span>
        </label>
      </div>
    </li>
  );
}

function Preview({ asset: a }: { asset: TourAsset }) {
  if (a.kind === "film" && a.url) {
    return (
      <video
        src={a.url}
        poster={typeof a.meta?.poster === "string" ? a.meta.poster : undefined}
        muted
        playsInline
        preload="metadata"
        controls
        className="aspect-video w-full bg-black object-contain"
      />
    );
  }
  if (a.url && (a.kind === "image" || a.kind === "poster" || a.kind === "still")) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={a.url} alt={a.altText ?? ""} loading="lazy" className="aspect-video w-full bg-muted object-cover" />;
  }
  if (a.kind === "document" && a.url) {
    return (
      <a href={a.url} target="_blank" rel="noopener" className="flex aspect-video w-full items-center justify-center bg-muted text-xs underline">
        Open document
      </a>
    );
  }
  return (
    <div className="flex aspect-video w-full items-center justify-center bg-muted text-center text-xs text-muted-foreground">
      {a.kind === "map3d" ? "3D route map" : a.kind === "streetview" ? "Live Street View" : KIND_LABEL[a.kind]}
    </div>
  );
}

function FileButton({ label, onFile, disabled, small }: { label: string; onFile: (f: File) => void; disabled?: boolean; small?: boolean }) {
  const input = React.useRef<HTMLInputElement>(null);
  return (
    <>
      <Button type="button" size="sm" variant={small ? "ghost" : "outline"} disabled={disabled} onClick={() => input.current?.click()}>
        {label}
      </Button>
      <input
        ref={input}
        type="file"
        accept="image/*,video/mp4,video/webm,application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onFile(f);
        }}
      />
    </>
  );
}
