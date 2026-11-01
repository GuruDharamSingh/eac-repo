"use client";

import * as React from "react";
import { CENTRED, MAX_ZOOM, coverFrameStyle, frameOrNull, type CoverFrame } from "./cover-frame";

export interface CoverFramerShape {
  /** What the box is, e.g. "Card on a phone". */
  label: string;
  /** Width over height. */
  aspect: number;
}

export interface CoverFramerProps {
  /** The picture to frame. */
  src: string;
  /** The stored frame; null = centred, no zoom. */
  frame: CoverFrame | null;
  /** Called with null when the picture is back to centred and unzoomed. */
  onChange: (frame: CoverFrame | null) => void;
  /** The box the picture is framed in (the main, draggable one). Default 16:9. */
  shape?: CoverFramerShape;
  /** Other boxes the same picture is shown in, drawn small beside the main one. */
  alsoShapes?: CoverFramerShape[];
  /** Laid over the main box, e.g. the card's title as it will read. */
  overlay?: React.ReactNode;
}

const clamp = (n: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, Math.round(n * 10) / 10));

/**
 * A cover's preview and its framing, in one: the picture in the box it will
 * be shown in, dragged to choose what stays in view, zoomed with the slider,
 * the wheel or +/−, and moved with the arrow keys when the box has focus.
 * Smaller previews show the same frame in the other boxes the picture is
 * used in (a portrait card, a wide banner). Nothing is cut from the file:
 * the frame is a focal point and a zoom (`coverFrameStyle`), so one picture
 * fits every box.
 *
 * Styles: `.eac-coverframe*` in files-card.css.
 */
export function CoverFramer({
  src,
  frame,
  onChange,
  shape = { label: "Wide", aspect: 16 / 9 },
  alsoShapes = [],
  overlay,
}: CoverFramerProps) {
  const f = frame ?? CENTRED;
  const boxRef = React.useRef<HTMLDivElement>(null);
  const from = React.useRef<{ x: number; y: number; fx: number; fy: number; w: number; h: number } | null>(null);
  const zoomId = React.useId();
  const set = (patch: Partial<CoverFrame>) => onChange(frameOrNull({ ...f, ...patch }));

  // The wheel zooms; React's onWheel is passive, so the page would scroll too.
  React.useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const z = Math.min(MAX_ZOOM, Math.max(1, Math.round((f.zoom - e.deltaY * 0.0015) * 100) / 100));
      if (z !== f.zoom) onChange(frameOrNull({ ...f, zoom: z }));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [f, onChange]);

  function onKeyDown(e: React.KeyboardEvent) {
    const step = e.shiftKey ? 10 : 2;
    const moves: Record<string, Partial<CoverFrame>> = {
      ArrowLeft: { fx: clamp(f.fx + step) },
      ArrowRight: { fx: clamp(f.fx - step) },
      ArrowUp: { fy: clamp(f.fy + step) },
      ArrowDown: { fy: clamp(f.fy - step) },
    };
    if (e.key === "+" || e.key === "=") set({ zoom: Math.min(MAX_ZOOM, Math.round((f.zoom + 0.25) * 100) / 100) });
    else if (e.key === "-") set({ zoom: Math.max(1, Math.round((f.zoom - 0.25) * 100) / 100) });
    else if (moves[e.key]) set(moves[e.key]);
    else return;
    e.preventDefault();
  }

  return (
    <div className="eac-coverframe">
      <div className="eac-coverframe__main">
        <div
          ref={boxRef}
          className="eac-coverframe__box is-live"
          style={{ aspectRatio: String(shape.aspect) }}
          tabIndex={0}
          role="group"
          aria-label={`${shape.label}: drag the picture to choose what shows; arrow keys move it, + and − zoom`}
          onKeyDown={onKeyDown}
          onPointerDown={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            from.current = { x: e.clientX, y: e.clientY, fx: f.fx, fy: f.fy, w: r.width, h: r.height };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            const p = from.current;
            if (!p) return;
            set({
              fx: clamp(p.fx - ((e.clientX - p.x) / p.w) * (100 / f.zoom)),
              fy: clamp(p.fy - ((e.clientY - p.y) / p.h) * (100 / f.zoom)),
            });
          }}
          onPointerUp={() => {
            from.current = null;
          }}
          onPointerCancel={() => {
            from.current = null;
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" draggable={false} style={coverFrameStyle(f)} />
          {overlay && <div className="eac-coverframe__overlay">{overlay}</div>}
        </div>
        <span className="eac-coverframe__label">{shape.label}</span>
      </div>

      <div className="eac-coverframe__side">
        <div className="eac-coverframe__tools">
          <label htmlFor={zoomId}>Zoom</label>
          <button type="button" aria-label="Zoom out" disabled={f.zoom <= 1} onClick={() => set({ zoom: Math.max(1, Math.round((f.zoom - 0.25) * 100) / 100) })}>
            −
          </button>
          <input
            id={zoomId}
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.05}
            value={f.zoom}
            onChange={(e) => set({ zoom: Number(e.target.value) })}
          />
          <button type="button" aria-label="Zoom in" disabled={f.zoom >= MAX_ZOOM} onClick={() => set({ zoom: Math.min(MAX_ZOOM, Math.round((f.zoom + 0.25) * 100) / 100) })}>
            +
          </button>
          <button type="button" disabled={!frame} onClick={() => onChange(null)}>
            Centre
          </button>
        </div>
        <p className="eac-coverframe__hint">Drag the picture to choose what shows. The whole file is kept; only the view changes.</p>
        {alsoShapes.length > 0 && (
          <div className="eac-coverframe__also">
            {alsoShapes.map((s) => (
              <figure key={s.label} className="eac-coverframe__mini">
                <div className="eac-coverframe__box" style={{ aspectRatio: String(s.aspect) }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" draggable={false} style={coverFrameStyle(f)} />
                </div>
                <figcaption>{s.label}</figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
