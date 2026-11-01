"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import type { HomeLoft as HomeLoftData, LoftHung, LoftWork } from "@/lib/home-sections";
import { DEFAULT_CROP, cropStyles } from "@/lib/loft-crop";

// The loft section under the hero. Frosted over until the visitor asks for
// the scene: behind the frost, the hung works on a white wall as a still; the
// button swaps in the 3D loft (loaded only then, with its 7 MB model). The
// owners' hang (works, frame proportion, crop) comes from site settings for
// now; the scene editor replaces it (docs/open/LOFT_SCENE_EDITOR_BRIEF_2026-10-29.md).

const HomeLoftScene = dynamic(() => import("./home-loft-scene").then((m) => m.HomeLoftScene), {
  ssr: false,
  loading: () => <div className="hl-loading">Opening the loft…</div>,
});

const PICK_KEY = "collect-art:home-loft-pick";

function sized(url: string, w: number): string {
  return url.includes("?") ? `${url}&w=${w}` : `${url}?w=${w}`;
}

export function HomeLoft({ loft }: { loft: HomeLoftData }) {
  const [open, setOpen] = React.useState(false);
  const [pick, setPick] = React.useState<LoftWork | null>(null);

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

  const onWall: LoftHung[] = [...loft.hung.slice(0, 2), ...(pick ? [{ ...pick, ratio: "auto" as const, crop: DEFAULT_CROP }] : [])];
  const free = onWall.length < 3;

  return (
    <section className="hl" aria-labelledby="home-loft">
      <div className="hl-head">
        <div>
          <p className="hl-kicker">The loft</p>
          <h2 id="home-loft" className="hl-title">A virtual scene, hung from the market</h2>
        </div>
        <p className="hl-lede">
          {onWall.length} {onWall.length === 1 ? "work" : "works"} on the wall
          {free ? " and one spot free: click it to hang a painting of your choosing." : "; the third is your pick."}
        </p>
      </div>

      {open ? (
        <div className="hl-stage">
          <HomeLoftScene hung={loft.hung} pool={loft.pool} pick={pick} onPick={onPick} />
          <button type="button" className="hl-close" onClick={() => setOpen(false)}>
            Close the scene
          </button>
        </div>
      ) : (
        <div className="hl-still">
          <div className="hl-wall" aria-hidden="true">
            {onWall.map((w) => {
              const st = cropStyles(w.ratio, w.crop);
              return (
                <span key={w.id} className="hl-frame" style={st.frame}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={sized(w.imageUrl, 640)} alt="" style={st.img} />
                </span>
              );
            })}
            {free && <span className="hl-frame is-free">Hang a painting here</span>}
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
