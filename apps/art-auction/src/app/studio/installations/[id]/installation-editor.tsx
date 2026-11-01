"use client";

import * as React from "react";
import Link from "next/link";
import {
  DEFAULT_CROP,
  DEFAULT_FRAME_ID,
  FRAME_RATIOS,
  HallwayExperience,
  KEY_FROM,
  LAMP_POINTS,
  LIGHT_PRESETS,
  LIGHTING_BOUNDS,
  ZOOM_MAX,
  isUncropped,
  placementCrop,
  placementLamp,
  placementRatio,
  presetOf,
  ratioNumber,
  venueIsLit,
  beginTrayDrag,
  endTrayDrag,
  goToPlacement,
  orderInVenue,
  placementScale,
  useHallwayStore,
  SCALE_MAX,
  SCALE_MIN,
  type Crop,
  type FrameRatio,
  type HallwayPiece,
  type KeyFrom,
  type LampAt,
  type LampSettings,
  type Placement,
  type SceneLighting,
} from "@elkdonis/three/hallway";
import { Button } from "@/components/ui/button";
import { ART_FRAME_STYLES } from "@/lib/frame-styles";
import type { Installation, InstallationArtwork, InstallationPiece } from "@/lib/installations";
import {
  renameInstallationAction,
  saveLayoutAction,
  saveSceneAction,
  setInstallationStatusAction,
  setInstallationVenueAction,
} from "../actions";
import { INSTALLATION_VENUES } from "@/lib/installation-venues";
import { venueFor } from "@/lib/venues";

/** Wait this long after the last change before saving the hang. */
const SAVE_DELAY_MS = 600;
/** Undo steps kept. */
const HISTORY = 100;

function sized(url: string, w: number): string {
  return url.includes("?") ? `${url}&w=${w}` : `${url}?w=${w}`;
}

function toPiece(a: InstallationArtwork): HallwayPiece {
  return {
    id: a.id,
    title: a.title,
    imageUrl: sized(a.imageUrl ?? "", 1024),
    artistName: a.artistName,
    heightCm: a.heightCm,
    widthCm: a.widthCm,
  };
}

type SaveState = "saved" | "saving" | "pending" | "error";

/** What undo steps over: the hang and the scene's lighting together. */
interface Doc {
  placements: Placement[];
  lighting: SceneLighting;
}

/** The worse of two save states, for the one status line. */
function worse(a: SaveState, b: SaveState): SaveState {
  const rank: SaveState[] = ["saved", "pending", "saving", "error"];
  return rank[Math.max(rank.indexOf(a), rank.indexOf(b))]!;
}

export function InstallationEditor({
  installation,
  artworks,
  initialPieces,
  saveLayout = saveLayoutAction,
  saveScene = saveSceneAction,
}: {
  installation: Installation;
  artworks: InstallationArtwork[];
  initialPieces: InstallationPiece[];
  /** Where a changed hang is sent. The studio action unless a harness swaps it. */
  saveLayout?: (id: string, pieces: InstallationPiece[]) => Promise<unknown>;
  /** Where changed scene settings (lighting) are sent. */
  saveScene?: (id: string, scene: { lighting: SceneLighting }) => Promise<unknown>;
}) {
  const pieces = React.useMemo(() => artworks.filter((a) => a.imageUrl).map(toPiece), [artworks]);
  const byId = React.useMemo(() => new Map(artworks.map((a) => [a.id, a])), [artworks]);

  const [doc, setDoc] = React.useState<Doc>(() => ({
    placements: initialPieces.map((p) => ({
      pieceId: p.artworkId,
      wallId: p.wallId,
      x: p.x,
      y: p.y,
      frameId: p.frameId,
      scale: p.scale,
      ratio: p.ratio,
      crop: p.crop,
      lamp: p.lamp,
    })),
    lighting: installation.scene.lighting,
  }));
  const { placements, lighting } = doc;
  // The current document, kept in step with every write. The history is kept
  // here rather than inside state updaters: React may call an updater twice
  // (it does in development), which recorded every step twice.
  const current = React.useRef(doc);
  const write = React.useCallback((next: Doc) => {
    current.current = next;
    setDoc(next);
  }, []);
  /** A change outside the history: a stroke's moves (see `beginStroke`). */
  const setDocLive = React.useCallback((next: (d: Doc) => Doc) => write(next(current.current)), [write]);
  const setPlacementsRaw = React.useCallback(
    (next: (all: Placement[]) => Placement[]) =>
      setDocLive((d) => {
        const out = next(d.placements);
        return out === d.placements ? d : { ...d, placements: out };
      }),
    [setDocLive]
  );

  // ── Undo / redo ───────────────────────────────────────────────────────────
  // Every change to the hang or the lighting goes through `changeDoc`, which
  // keeps the previous document. Ctrl-Z steps back, Ctrl-Shift-Z or Ctrl-Y
  // forward; the save timers treat an undo like any other change.
  const past = React.useRef<Doc[]>([]);
  const future = React.useRef<Doc[]>([]);
  const [historyTick, setHistoryTick] = React.useState(0);
  const changeDoc = React.useCallback(
    (next: (d: Doc) => Doc) => {
      const d = current.current;
      const out = next(d);
      if (out === d) return;
      past.current = [...past.current.slice(-(HISTORY - 1)), d];
      future.current = [];
      write(out);
      setHistoryTick((t) => t + 1);
    },
    [write]
  );
  const change = React.useCallback(
    (next: (all: Placement[]) => Placement[]) =>
      changeDoc((d) => {
        const out = next(d.placements);
        return out === d.placements ? d : { ...d, placements: out };
      }),
    [changeDoc]
  );
  const undo = React.useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(current.current);
    write(prev);
    setHistoryTick((t) => t + 1);
  }, [write]);
  const redo = React.useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(current.current);
    write(next);
    setHistoryTick((t) => t + 1);
  }, [write]);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
      } else if (k === "z") {
        e.preventDefault();
        undo();
      } else if (k === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);
  void historyTick;
  const setPlacements = change;
  // A slider stroke is one undo step: the hang is marked when the stroke
  // starts, and the moves inside it bypass the history.
  const stroke = React.useRef(false);
  const beginStroke = React.useCallback(() => {
    if (stroke.current) return;
    stroke.current = true;
    past.current = [...past.current.slice(-(HISTORY - 1)), current.current];
    future.current = [];
    setHistoryTick((t) => t + 1);
  }, []);
  const endStroke = React.useCallback(() => {
    stroke.current = false;
  }, []);
  const [venueId, setVenueId] = React.useState(installation.hallway);
  const venue = React.useMemo(() => venueFor(venueId), [venueId]);
  // Walking order depends on the space: the hallway's route, or a room's way round.
  const ordered = React.useMemo(() => orderInVenue(venue, placements), [venue, placements]);
  const hungIds = React.useMemo(() => new Set(placements.map((p) => p.pieceId)), [placements]);

  const [title, setTitle] = React.useState(installation.title);
  const [status, setStatus] = React.useState(installation.status);
  const [layoutState, setLayoutState] = React.useState<SaveState>("saved");
  const [sceneState, setSceneState] = React.useState<SaveState>("saved");
  const saveState = worse(layoutState, sceneState);
  const selectedId = useHallwayStore((s) => s.selectedId);
  const release = useHallwayStore((s) => s.release);
  const baseSize = useHallwayStore((s) => (selectedId ? s.baseSizes[selectedId] : undefined));

  // ── Saving ────────────────────────────────────────────────────────────────
  const first = React.useRef(true);
  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setLayoutState("pending");
    const timer = window.setTimeout(async () => {
      setLayoutState("saving");
      try {
        await saveLayout(
          installation.id,
          ordered.map((p) => ({
            artworkId: p.pieceId,
            wallId: p.wallId,
            x: p.x,
            y: p.y,
            frameId: p.frameId,
            scale: placementScale(p),
            ratio: placementRatio(p),
            crop: placementCrop(p),
            lamp: p.lamp ?? { at: placementLamp(p) },
            sequence: p.sequence,
          }))
        );
        setLayoutState("saved");
      } catch {
        setLayoutState("error");
      }
    }, SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [ordered, installation.id, saveLayout]);

  // The lighting saves on its own timer: a slider stroke is many renders, and
  // re-sending the whole hang for each would be waste.
  const firstScene = React.useRef(true);
  React.useEffect(() => {
    if (firstScene.current) {
      firstScene.current = false;
      return;
    }
    setSceneState("pending");
    const timer = window.setTimeout(async () => {
      setSceneState("saving");
      try {
        await saveScene(installation.id, { lighting });
        setSceneState("saved");
      } catch {
        setSceneState("error");
      }
    }, SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [lighting, installation.id, saveScene]);

  // Leaving with an unsaved hang loses the last move.
  React.useEffect(() => {
    const onLeave = (event: BeforeUnloadEvent) => {
      if (saveState === "pending" || saveState === "saving") event.preventDefault();
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [saveState]);

  const place = React.useCallback((next: Placement) => {
    setPlacements((all) => [...all.filter((p) => p.pieceId !== next.pieceId), next]);
  }, []);

  const setFrame = (pieceId: string, frameId: string) =>
    setPlacements((all) => all.map((p) => (p.pieceId === pieceId ? { ...p, frameId } : p)));

  const setRatio = (pieceId: string, ratio: FrameRatio) =>
    setPlacements((all) => all.map((p) => (p.pieceId === pieceId ? { ...p, ratio } : p)));

  /** A crop slider moving: no history step of its own (see `beginStroke`). */
  const setCropLive = (pieceId: string, patch: Partial<Crop>) =>
    setPlacementsRaw((all) => all.map((p) => (p.pieceId === pieceId ? { ...p, crop: { ...placementCrop(p), ...patch } } : p)));

  const setLamp = (pieceId: string, at: LampAt) =>
    setPlacements((all) => all.map((p) => (p.pieceId === pieceId ? { ...p, lamp: { at } } : p)));

  // Lighting: a step (a preset, a select, a checkbox) is one undo step; a
  // slider moves live inside a stroke, like the crop sliders.
  const setLighting = (patch: Partial<SceneLighting>) => changeDoc((d) => ({ ...d, lighting: { ...d.lighting, ...patch } }));
  const setLightingLive = (patch: Partial<SceneLighting>) => setDocLive((d) => ({ ...d, lighting: { ...d.lighting, ...patch } }));
  const setLamps = (patch: Partial<LampSettings>) =>
    changeDoc((d) => ({ ...d, lighting: { ...d.lighting, lamps: { ...d.lighting.lamps, ...patch } } }));
  const setLampsLive = (patch: Partial<LampSettings>) =>
    setDocLive((d) => ({ ...d, lighting: { ...d.lighting, lamps: { ...d.lighting.lamps, ...patch } } }));

  const resetFraming = (pieceId: string) =>
    setPlacements((all) => all.map((p) => (p.pieceId === pieceId ? { ...p, ratio: "auto", crop: { ...DEFAULT_CROP } } : p)));

  const takeDown = React.useCallback(
    (pieceId: string) => {
      setPlacements((all) => all.filter((p) => p.pieceId !== pieceId));
      release();
    },
    [setPlacements, release]
  );

  /** The inspector's numbers: x and y in cm on the wall, width and height of the picture in cm. */
  const setNumber = (pieceId: string, field: "x" | "y" | "width" | "height", value: number) => {
    if (!Number.isFinite(value)) return;
    setPlacements((all) =>
      all.map((p) => {
        if (p.pieceId !== pieceId) return p;
        if (field === "x") return { ...p, x: Math.round(value) / 100 };
        if (field === "y") return { ...p, y: Math.round(value) / 100 };
        if (!baseSize) return p;
        const base = field === "width" ? baseSize.width : baseSize.height;
        const scale = Math.min(SCALE_MAX, Math.max(SCALE_MIN, value / 100 / base));
        return { ...p, scale: Math.round(scale * 200) / 200 };
      })
    );
  };

  const commitTitle = async () => {
    const clean = title.trim() || "Untitled collection";
    setTitle(clean);
    if (clean !== installation.title) await renameInstallationAction(installation.id, clean);
  };

  // Placements are coordinates on one space's walls, so moving clears the hang.
  const changeVenue = async (next: string) => {
    if (next === venueId) return;
    if (
      placements.length > 0 &&
      !window.confirm("Moving to another space takes everything off the walls. Carry on?")
    ) {
      return;
    }
    await setInstallationVenueAction(installation.id, next);
    first.current = true;
    setPlacements(() => []);
    past.current = [];
    future.current = [];
    release();
    setVenueId(next);
  };

  const toggleStatus = async () => {
    const next = status === "published" ? "draft" : "published";
    await setInstallationStatusAction(installation.id, next);
    setStatus(next);
  };

  const selected = selectedId ? ordered.find((p) => p.pieceId === selectedId) : undefined;
  const selectedWork = selectedId ? byId.get(selectedId) : undefined;
  const unhung = pieces.filter((p) => !hungIds.has(p.id));

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center gap-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          aria-label="Collection name"
          className="h-10 min-w-[240px] flex-1 rounded-md border border-transparent bg-transparent px-2 font-serif text-2xl tracking-tight hover:border-input focus:border-input"
        />
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {saveState === "saved" ? "All changes saved" : saveState === "error" ? "Could not save — try again" : "Saving…"}
        </span>
        <div className="flex items-center gap-1" role="group" aria-label="History">
          <Button variant="outline" size="sm" onClick={undo} disabled={past.current.length === 0} title="Undo (Ctrl-Z)">
            Undo
          </Button>
          <Button variant="outline" size="sm" onClick={redo} disabled={future.current.length === 0} title="Redo (Ctrl-Shift-Z)">
            Redo
          </Button>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Space</span>
          <select
            value={venueId}
            onChange={(e) => changeVenue(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            {INSTALLATION_VENUES.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
        <Button variant="outline" size="sm" onClick={toggleStatus}>
          {status === "published" ? "Close to visitors" : "Open to visitors"}
        </Button>
        {status === "published" && (
          <Link href={`/installations/${installation.id}`} className="text-sm underline underline-offset-4">
            Walk it as a visitor →
          </Link>
        )}
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-[240px_minmax(0,1fr)_260px]">
        {/* The tray: works not yet on a wall. */}
        <aside className="rounded-lg border border-border bg-card p-3 lg:max-h-[min(72vh,720px)] lg:overflow-y-auto">
          <h3 className="mb-1 text-sm font-semibold">Your works</h3>
          <p className="mb-3 text-xs text-muted-foreground">Drag one onto any wall.</p>
          {unhung.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {pieces.length === 0 ? "Add artworks with images to your store first." : "Everything is hung."}
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-2">
              {unhung.map((piece) => (
                <li key={piece.id}>
                  <TrayItem piece={piece} thumb={sized(byId.get(piece.id)!.imageUrl!, 256)} />
                </li>
              ))}
            </ul>
          )}
        </aside>

        <div className="overflow-hidden rounded-xl border border-border bg-muted">
          <HallwayExperience
            key={venue.id}
            venue={venue}
            pieces={pieces}
            placements={placements}
            editable
            frames={ART_FRAME_STYLES}
            onPlace={place}
            onRemove={takeDown}
            lighting={lighting}
            height="min(72vh, 720px)"
            fallback={<p className="p-8 text-center text-sm">The hallway needs WebGL turned on.</p>}
          />
        </div>

        {/* What is hung, in the order a visitor meets it, and the selected piece. */}
        <aside className="space-y-4 lg:max-h-[min(72vh,720px)] lg:overflow-y-auto">
          {selected && selectedWork && (
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">No. {selected.sequence} on the walk</p>
                  <p className="font-medium leading-snug">{selectedWork.title}</p>
                </div>
                <button type="button" onClick={release} className="text-lg leading-none text-muted-foreground" aria-label="Deselect">
                  ×
                </button>
              </div>
              {venue.slots ? (
                <p className="text-xs text-muted-foreground">
                  This room keeps its own frames: the work fills the one it is in.
                </p>
              ) : (
              <>
              <p className="mb-1.5 text-xs font-semibold">Position and size</p>
              <p className="mb-2 text-[11px] text-muted-foreground">
                Centimetres. Drag a corner in the scene to resize; arrow keys nudge (Shift: 10 cm); Delete takes it down.
              </p>
              <div className="mb-3 grid grid-cols-2 gap-1.5">
                <NumberField label="Along the wall" value={selected.x * 100} onCommit={(v) => setNumber(selected.pieceId, "x", v)} />
                <NumberField label="Centre height" value={selected.y * 100} onCommit={(v) => setNumber(selected.pieceId, "y", v)} />
                <NumberField
                  label="Width"
                  value={baseSize ? baseSize.width * placementScale(selected) * 100 : null}
                  onCommit={(v) => setNumber(selected.pieceId, "width", v)}
                />
                <NumberField
                  label="Height"
                  value={baseSize ? baseSize.height * placementScale(selected) * 100 : null}
                  onCommit={(v) => setNumber(selected.pieceId, "height", v)}
                />
              </div>
              {placementScale(selected) !== 1 && (
                <button
                  type="button"
                  className="mb-3 text-xs underline underline-offset-4"
                  onClick={() => setPlacements((all) => all.map((p) => (p.pieceId === selected.pieceId ? { ...p, scale: 1 } : p)))}
                >
                  Reset to its recorded size (×{placementScale(selected).toFixed(2)} now)
                </button>
              )}
              <p className="mb-1.5 text-xs font-semibold">Framing</p>
              <FramingFields
                imageUrl={selectedWork.imageUrl ? sized(selectedWork.imageUrl, 320) : null}
                imageAspect={baseSize && placementRatio(selected) === "auto" ? baseSize.width / baseSize.height : null}
                ratio={placementRatio(selected)}
                crop={placementCrop(selected)}
                onRatio={(r) => setRatio(selected.pieceId, r)}
                onCrop={(patch) => setCropLive(selected.pieceId, patch)}
                onStrokeStart={beginStroke}
                onStrokeEnd={endStroke}
                onReset={() => resetFraming(selected.pieceId)}
              />
              <p className="mb-1.5 mt-3 text-xs font-semibold">Frame</p>
              <div className="grid grid-cols-2 gap-1.5">
                {ART_FRAME_STYLES.map((f) => {
                  const active = (selected.frameId ?? DEFAULT_FRAME_ID) === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFrame(selected.pieceId, f.id)}
                      aria-pressed={active}
                      className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs ${
                        active ? "border-foreground bg-muted" : "border-border hover:bg-muted/50"
                      }`}
                    >
                      {f.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={f.thumbnailUrl} alt="" className="h-8 w-8 shrink-0 rounded-sm object-cover" />
                      ) : (
                        <span
                          className="inline-block h-4 w-4 shrink-0 rounded-sm"
                          style={{ background: f.colour, boxShadow: "inset 0 0 0 3px rgba(255,255,255,0.15)" }}
                        />
                      )}
                      {f.label}
                    </button>
                  );
                })}
              </div>
              <label className="mt-3 grid gap-0.5 text-[11px] text-muted-foreground">
                <span className="text-xs font-semibold text-foreground">Lamp</span>
                <select
                  value={placementLamp(selected)}
                  onChange={(e) => setLamp(selected.pieceId, e.target.value as LampAt)}
                  className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground"
                >
                  {LAMP_POINTS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {!lighting.lamps.on && <span className="mt-1">Picture lamps are switched off in Lighting.</span>}
              </label>
              </>
              )}
              <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => takeDown(selected.pieceId)}>
                Take it down
              </Button>
            </div>
          )}

          <LightingPanel
            lighting={lighting}
            roomLit={venueIsLit(venue)}
            roomBackground={venue.lights.background}
            lampsApply={!venue.slots}
            onPreset={(next) => changeDoc((d) => ({ ...d, lighting: next }))}
            onLighting={setLighting}
            onLightingLive={setLightingLive}
            onLamps={setLamps}
            onLampsLive={setLampsLive}
            onStrokeStart={beginStroke}
            onStrokeEnd={endStroke}
          />

          <div className="rounded-lg border border-border bg-card p-3">
            <h3 className="mb-1 text-sm font-semibold">On the walls ({ordered.length})</h3>
            <p className="mb-3 text-xs text-muted-foreground">
              In walking order from the entrance. Move a piece along the hall to change its place.
            </p>
            <ol className="space-y-1">
              {ordered.map((p) => {
                const work = byId.get(p.pieceId);
                return (
                  <li key={p.pieceId}>
                    <button
                      type="button"
                      onClick={() => goToPlacement(p)}
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted ${
                        p.pieceId === selectedId ? "bg-muted" : ""
                      }`}
                    >
                      <span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                        {p.sequence}
                      </span>
                      {work?.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={sized(work.imageUrl, 96)} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />
                      )}
                      <span className="truncate">{work?.title ?? "Untitled"}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}

/**
 * The frame's proportion and the crop inside it, with a preview drawn the
 * way the scene crops: cover fit at the zoom, the chosen point kept in place.
 * Sliders move the crop live; one drag is one undo step.
 */
function FramingFields({
  imageUrl,
  imageAspect,
  ratio,
  crop,
  onRatio,
  onCrop,
  onStrokeStart,
  onStrokeEnd,
  onReset,
}: {
  imageUrl: string | null;
  /** The picture's own proportion, for the preview when the ratio is 'auto'. */
  imageAspect: number | null;
  ratio: FrameRatio;
  crop: Crop;
  onRatio: (ratio: FrameRatio) => void;
  onCrop: (patch: Partial<Crop>) => void;
  onStrokeStart: () => void;
  onStrokeEnd: () => void;
  onReset: () => void;
}) {
  const r = ratioNumber(ratio) ?? imageAspect ?? 1;
  const cropped = !isUncropped(ratio, crop);
  const slider = (label: string, key: keyof Crop, min: number, max: number, step: number, format: (v: number) => string) => (
    <label className="grid grid-cols-[64px_1fr_36px] items-center gap-2 text-[11px] text-muted-foreground">
      {label}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={crop[key]}
        aria-label={label}
        onPointerDown={onStrokeStart}
        onPointerUp={onStrokeEnd}
        onFocus={onStrokeStart}
        onBlur={onStrokeEnd}
        onChange={(e) => onCrop({ [key]: Number(e.target.value) })}
        className="w-full accent-foreground"
      />
      <span className="text-right tabular-nums text-foreground">{format(crop[key])}</span>
    </label>
  );
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3">
        <div
          className="w-24 shrink-0 overflow-hidden rounded-sm border border-border bg-muted"
          style={{ aspectRatio: String(r) }}
          data-testid="crop-preview"
        >
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt=""
              className="h-full w-full"
              style={{
                objectFit: "cover",
                objectPosition: `${crop.x}% ${crop.y}%`,
                transform: crop.zoom > 1 ? `scale(${crop.zoom})` : undefined,
                transformOrigin: `${crop.x}% ${crop.y}%`,
              }}
            />
          )}
        </div>
        <label className="grid flex-1 gap-0.5 text-[11px] text-muted-foreground">
          Proportion
          <select
            value={ratio}
            onChange={(e) => onRatio(e.target.value as FrameRatio)}
            className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground"
          >
            {FRAME_RATIOS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <span className="mt-1 leading-snug">
            {ratio === "auto" ? "The frame takes the picture's own shape." : "The picture is cropped to fill the frame."}
          </span>
        </label>
      </div>
      <div className="space-y-1">
        {slider("Zoom", "zoom", 1, ZOOM_MAX, 0.05, (v) => `${v.toFixed(2)}×`)}
        {slider("Across", "x", 0, 100, 1, (v) => `${Math.round(v)}%`)}
        {slider("Down", "y", 0, 100, 1, (v) => `${Math.round(v)}%`)}
      </div>
      {cropped && (
        <button type="button" className="text-xs underline underline-offset-4" onClick={onReset}>
          Show it whole, as shot
        </button>
      )}
    </div>
  );
}

/** A slider that moves live; one drag (or one focus of the keyboard) is one undo step. */
function RangeField({
  label,
  value,
  min,
  max,
  step,
  format,
  disabled,
  onLive,
  onStrokeStart,
  onStrokeEnd,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  disabled?: boolean;
  onLive: (v: number) => void;
  onStrokeStart: () => void;
  onStrokeEnd: () => void;
}) {
  return (
    <label className="grid grid-cols-[72px_1fr_52px] items-center gap-2 text-[11px] text-muted-foreground">
      {label}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={label}
        onPointerDown={onStrokeStart}
        onPointerUp={onStrokeEnd}
        onFocus={onStrokeStart}
        onBlur={onStrokeEnd}
        onChange={(e) => onLive(Number(e.target.value))}
        className="w-full accent-foreground disabled:opacity-40"
      />
      <span className="text-right tabular-nums text-foreground">{format(value)}</span>
    </label>
  );
}

const times = (v: number) => `${v.toFixed(2)}×`;
const warmthLabel = (v: number) => (Math.abs(v) < 0.005 ? "Neutral" : `${v > 0 ? "Warm" : "Cool"} ${Math.round(Math.abs(v) * 100)}`);

/**
 * The scene's light: presets as starting points, then the room (brightness,
 * warmth, the key light's direction and strength, background) and the picture
 * lamps (on, strength, colour, spread). Each piece's lamp position is chosen
 * in the selected piece's card.
 */
function LightingPanel({
  lighting,
  roomLit,
  roomBackground,
  lampsApply,
  onPreset,
  onLighting,
  onLightingLive,
  onLamps,
  onLampsLive,
  onStrokeStart,
  onStrokeEnd,
}: {
  lighting: SceneLighting;
  /** False for a photographed room drawn as captured: only the background applies. */
  roomLit: boolean;
  /** The venue's own background, shown when no colour is chosen. */
  roomBackground: string;
  /** False where the room keeps its own frames (and its own light on them). */
  lampsApply: boolean;
  onPreset: (lighting: SceneLighting) => void;
  onLighting: (patch: Partial<SceneLighting>) => void;
  onLightingLive: (patch: Partial<SceneLighting>) => void;
  onLamps: (patch: Partial<LampSettings>) => void;
  onLampsLive: (patch: Partial<LampSettings>) => void;
  onStrokeStart: () => void;
  onStrokeEnd: () => void;
}) {
  const B = LIGHTING_BOUNDS;
  const preset = presetOf(lighting);
  const stroke = { onStrokeStart, onStrokeEnd };
  return (
    <details open className="rounded-lg border border-border bg-card p-3" data-testid="lighting-panel">
      <summary className="cursor-pointer text-sm font-semibold">Lighting</summary>
      <div className="mt-2 space-y-3">
        {!roomLit && (
          <p className="text-[11px] text-muted-foreground">
            This room is a photographed scan shown as it was captured, so only its background colour changes here.
          </p>
        )}
        <div>
          <p className="mb-1 text-xs font-semibold">Start from</p>
          <div className="flex flex-wrap gap-1" role="group" aria-label="Lighting presets">
            {LIGHT_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={preset === p.id}
                onClick={() => onPreset(p.lighting)}
                className={`rounded-full border px-2.5 py-1 text-xs ${
                  preset === p.id ? "border-foreground bg-muted" : "border-border hover:bg-muted/50"
                }`}
              >
                {p.label}
              </button>
            ))}
            {preset === null && <span className="self-center px-1 text-xs text-muted-foreground">Custom</span>}
          </div>
        </div>

        {roomLit && (
          <div className="space-y-1">
            <p className="text-xs font-semibold">The room</p>
            <RangeField
              label="Brightness"
              value={lighting.brightness}
              min={B.brightness[0]}
              max={B.brightness[1]}
              step={0.05}
              format={times}
              onLive={(v) => onLightingLive({ brightness: v })}
              {...stroke}
            />
            <RangeField
              label="Warmth"
              value={lighting.warmth}
              min={B.warmth[0]}
              max={B.warmth[1]}
              step={0.05}
              format={warmthLabel}
              onLive={(v) => onLightingLive({ warmth: v })}
              {...stroke}
            />
            <label className="grid grid-cols-[72px_1fr] items-center gap-2 text-[11px] text-muted-foreground">
              Light from
              <select
                value={lighting.keyFrom}
                onChange={(e) => onLighting({ keyFrom: e.target.value as KeyFrom })}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground"
              >
                {KEY_FROM.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </label>
            <RangeField
              label="Height"
              value={lighting.keyHeight}
              min={B.keyHeight[0]}
              max={B.keyHeight[1]}
              step={1}
              format={(v) => `${Math.round(v)}°`}
              disabled={lighting.keyFrom === "venue"}
              onLive={(v) => onLightingLive({ keyHeight: v })}
              {...stroke}
            />
            <RangeField
              label="Sunlight"
              value={lighting.keyStrength}
              min={B.keyStrength[0]}
              max={B.keyStrength[1]}
              step={0.05}
              format={times}
              onLive={(v) => onLightingLive({ keyStrength: v })}
              {...stroke}
            />
          </div>
        )}

        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="w-[72px]">Background</span>
          <input
            type="color"
            aria-label="Background colour"
            value={lighting.background ?? roomBackground}
            onFocus={onStrokeStart}
            onBlur={onStrokeEnd}
            onChange={(e) => onLightingLive({ background: e.target.value })}
            className="h-7 w-10 cursor-pointer rounded border border-input bg-background"
          />
          {lighting.background ? (
            <button type="button" className="underline underline-offset-4" onClick={() => onLighting({ background: null })}>
              The room&apos;s own
            </button>
          ) : (
            <span>The room&apos;s own</span>
          )}
        </div>

        {lampsApply && (
          <div className="space-y-1">
            <label className="flex items-center gap-2 text-xs font-semibold">
              <input
                type="checkbox"
                checked={lighting.lamps.on}
                onChange={(e) => onLamps({ on: e.target.checked })}
                className="accent-foreground"
              />
              Picture lamps
            </label>
            <RangeField
              label="Strength"
              value={lighting.lamps.strength}
              min={B.lampStrength[0]}
              max={B.lampStrength[1]}
              step={0.05}
              format={times}
              disabled={!lighting.lamps.on}
              onLive={(v) => onLampsLive({ strength: v })}
              {...stroke}
            />
            <RangeField
              label="Colour"
              value={lighting.lamps.warmth}
              min={B.lampWarmth[0]}
              max={B.lampWarmth[1]}
              step={0.05}
              format={(v) => (Math.abs(v) < 0.005 ? "Bulb" : v > 0 ? `Amber ${Math.round(v * 100)}` : `White ${Math.round(-v * 100)}`)}
              disabled={!lighting.lamps.on}
              onLive={(v) => onLampsLive({ warmth: v })}
              {...stroke}
            />
            <RangeField
              label="Spread"
              value={lighting.lamps.spread}
              min={B.lampSpread[0]}
              max={B.lampSpread[1]}
              step={0.05}
              format={times}
              disabled={!lighting.lamps.on}
              onLive={(v) => onLampsLive({ spread: v })}
              {...stroke}
            />
            <p className="text-[11px] text-muted-foreground">Where each lamp sits is set on the selected piece.</p>
          </div>
        )}
      </div>
    </details>
  );
}

/** A cm field that commits on Enter or blur, so typing does not move the piece mid-keystroke. */
function NumberField({ label, value, onCommit }: { label: string; value: number | null; onCommit: (v: number) => void }) {
  const [text, setText] = React.useState(value == null ? "" : String(Math.round(value)));
  React.useEffect(() => {
    setText(value == null ? "" : String(Math.round(value)));
  }, [value]);
  const commit = () => {
    const v = Number(text);
    if (Number.isFinite(v) && value != null && Math.round(v) !== Math.round(value)) onCommit(v);
  };
  return (
    <label className="grid gap-0.5 text-[11px] text-muted-foreground">
      {label}
      <input
        type="number"
        inputMode="numeric"
        value={text}
        disabled={value == null}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground tabular-nums"
      />
    </label>
  );
}

function TrayItem({ piece, thumb }: { piece: HallwayPiece; thumb: string }) {
  const img = React.useRef<HTMLImageElement>(null);
  return (
    <div
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", piece.id);
        event.dataTransfer.effectAllowed = "copy";
        const el = img.current;
        if (el) event.dataTransfer.setDragImage(el, el.width / 2, el.height / 2);
        const aspect = el && el.naturalHeight ? el.naturalWidth / el.naturalHeight : 1;
        beginTrayDrag(piece, aspect);
      }}
      onDragEnd={() => endTrayDrag()}
      title={piece.title}
      className="cursor-grab rounded-md border border-border bg-background p-1 active:cursor-grabbing"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={img} src={thumb} alt={piece.title} className="aspect-square w-full rounded object-cover" draggable={false} />
      <p className="mt-1 truncate text-[11px] leading-tight">{piece.title}</p>
    </div>
  );
}
