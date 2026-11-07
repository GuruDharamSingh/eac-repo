"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { OPEN_SPOT_ID, ratioNumber, type FrameRatio } from "@elkdonis/three/hallway/model";
import type { HomeLoft as HomeLoftData, LoftWork } from "@/lib/landing-loft";

// The loft section under the hero. Frosted over until the visitor asks for
// the scene: behind the frost, the hang on one white wall as a still; the
// button swaps in the 3D loft (loaded only then, with its 7 MB model). The
// hang is the landing installation as put on the page at /admin/loft
// (docs/open/LOFT_SCENE_EDITOR_BRIEF_2026-10-29.md, phase 4).

const HomeLoftScene = dynamic(() => import("./home-loft-scene").then((m) => m.HomeLoftScene), {
  ssr: false,
  loading: () => <div className="hl-loading">Opening the loft…</div>,
});

const PICK_KEY = "collect-art:home-loft-pick";
/** The wall height the still shows above the floor line, in metres. */
const WALL_M = 3.2;
/** A work with no recorded size hangs this tall, as in the scene (`fitPiece`). */
const DEFAULT_HEIGHT_M = 1.1;

function sized(url: string, w: number): string {
  return url.includes("?") ? `${url}&w=${w}` : `${url}?w=${w}`;
}

interface StillFrame {
  id: string;
  imageUrl: string | null;
  /** Centre along the wall and centre height, metres; size in metres. */
  x: number;
  y: number;
  w: number;
  h: number;
  ratio: FrameRatio;
  crop: { x: number; y: number; zoom: number };
}

/** A work's size on the wall: the recorded height (or the default) times the scale, the width by its frame. */
function frameSize(heightCm: number | null, widthCm: number | null, scale: number, ratio: FrameRatio) {
  const h = ((heightCm ?? 0) > 0 ? heightCm! / 100 : DEFAULT_HEIGHT_M) * scale;
  const r = ratioNumber(ratio) ?? (heightCm && widthCm ? widthCm / heightCm : 0.8);
  return { w: h * r, h };
}

/**
 * The hang as a still: the wall with the most works on it, each frame at its
 * place and size relative to the others. Positions are in metres on the wall,
 * scaled into the band above the floor line.
 */
function StillWall({ frames, free }: { frames: StillFrame[]; free: StillFrame | null }) {
  const all = free ? [...frames, free] : frames;
  if (all.length === 0) return null;
  const pad = 0.5;
  const left = Math.min(...all.map((f) => f.x - f.w / 2)) - pad;
  const right = Math.max(...all.map((f) => f.x + f.w / 2)) + pad;
  const span = Math.max(1, right - left);
  const box = (f: StillFrame): React.CSSProperties => ({
    left: `${((f.x - f.w / 2 - left) / span) * 100}%`,
    bottom: `${((f.y - f.h / 2) / WALL_M) * 100}%`,
    width: `${(f.w / span) * 100}%`,
    height: `${(f.h / WALL_M) * 100}%`,
  });
  return (
    <div className="hl-hang" style={{ "--hl-span": span, "--hl-wall": WALL_M } as React.CSSProperties}>
      {frames.map((f) => (
        <span key={f.id} className="hl-frame is-placed" style={box(f)}>
          {f.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={sized(f.imageUrl, 640)}
              alt=""
              style={{
                objectFit: f.ratio === "auto" && f.crop.zoom <= 1.001 ? "contain" : "cover",
                objectPosition: `${f.crop.x}% ${f.crop.y}%`,
                transform: f.crop.zoom > 1 ? `scale(${f.crop.zoom})` : undefined,
                transformOrigin: `${f.crop.x}% ${f.crop.y}%`,
              }}
            />
          )}
        </span>
      ))}
      {free && (
        <span className="hl-frame is-placed is-free" style={box(free)}>
          Hang a painting here
        </span>
      )}
    </div>
  );
}

export function HomeLoft({ loft }: { loft: HomeLoftData }) {
  const [open, setOpen] = React.useState(false);
  const [pick, setPick] = React.useState<LoftWork | null>(null);
  const spot = loft.scene.openSpot;

  // The visitor's pick for the free spot outlives the visit, on this device only.
  React.useEffect(() => {
    try {
      const id = window.localStorage.getItem(PICK_KEY);
      const w = id ? loft.pool.find((p) => p.id === id) : null;
      if (w) setPick(w);
    } catch {
      /* storage blocked: the pick lasts the page */
    }
  }, [loft.pool]);

  const onPick = React.useCallback((w: LoftWork | null) => {
    setPick(w);
    try {
      if (w) window.localStorage.setItem(PICK_KEY, w.id);
      else window.localStorage.removeItem(PICK_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  // The still shows the wall with the most on it (the free spot counts).
  const byId = React.useMemo(() => new Map(loft.works.map((w) => [w.id, w])), [loft.works]);
  const counts = new Map<string, number>();
  for (const p of loft.pieces) counts.set(p.wallId, (counts.get(p.wallId) ?? 0) + 1);
  if (spot) counts.set(spot.wallId, (counts.get(spot.wallId) ?? 0) + 1);
  const wall = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const frames: StillFrame[] = loft.pieces
    .filter((p) => p.wallId === wall)
    .map((p) => {
      const w = byId.get(p.artworkId);
      const ratio = (p.ratio as FrameRatio) || "auto";
      return { id: p.artworkId, imageUrl: w?.imageUrl ?? null, x: p.x, y: p.y, ratio, crop: p.crop, ...frameSize(w?.heightCm ?? null, w?.widthCm ?? null, p.scale, ratio) };
    });
  let free: StillFrame | null = null;
  if (spot && spot.wallId === wall) {
    const at = { x: spot.x, y: spot.y, ratio: "auto" as FrameRatio, crop: { x: 50, y: 50, zoom: 1 } };
    if (pick) frames.push({ id: pick.id, imageUrl: pick.imageUrl, ...at, ...frameSize(pick.heightCm, pick.widthCm, spot.scale, "auto") });
    else free = { id: OPEN_SPOT_ID, imageUrl: null, ...at, ...frameSize(100, 80, spot.scale, "auto") };
  }

  const count = loft.pieces.length + (pick && spot ? 1 : 0);
  const lede = spot
    ? pick
      ? `${count} ${count === 1 ? "work" : "works"} on the wall; one is your pick.`
      : `${count} ${count === 1 ? "work" : "works"} on the wall and one spot free: click it to hang a painting of your choosing.`
    : `${count} ${count === 1 ? "work" : "works"} on the wall.`;

  return (
    <section className="hl" aria-labelledby="home-loft">
      <div className="hl-head">
        <div>
          <p className="hl-kicker">The loft</p>
          <h2 id="home-loft" className="hl-title">A virtual scene, hung from the market</h2>
        </div>
        <p className="hl-lede">{lede}</p>
      </div>

      {open ? (
        <div className="hl-stage">
          <HomeLoftScene loft={loft} pick={pick} onPick={onPick} />
          <button type="button" className="hl-close" onClick={() => setOpen(false)}>
            Close the scene
          </button>
        </div>
      ) : (
        <div className="hl-still">
          <div className="hl-wall" aria-hidden="true">
            <StillWall frames={frames} free={free} />
          </div>
          <div className="hl-frost">
            <button type="button" className="hl-open" onClick={() => setOpen(true)}>
              View the virtual scene
            </button>
            <p className="hl-frost-note">Needs 3D graphics; loads a 7 MB room.</p>
          </div>
        </div>
      )}
    </section>
  );
}
