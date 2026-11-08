/// <reference path="../grapick.d.ts" />
"use client";
// (the reference, which must come first, carries grapick's declaration into apps and packages
// that compile this source)

import { useEffect, useRef } from "react";
import { cssColorToHex } from "../color";
import { gradientCss } from "../css";
import type { GradientSpec, GradientStop } from "../spec";

// ============================================================================
// The draggable stop bar, on Grapick (MIT, GrapesJS; 15 KB, no dependencies;
// last released 2021, so it is wrapped narrowly here and easy to replace).
//
// Grapick supplies the interaction: drag a stop, click the bar to add one,
// pull a stop off the bar to remove it, the native colour picker on the
// selected stop, touch included. Two things are ours:
//   - the strip is painted with OUR ramp (Grapick's updatePreview is replaced),
//     so it shows the OKLCH blend the page will get, not sRGB
//   - colours come back as hex through cssColorToHex
// Grapick is imported only when the bar mounts (editor-only code).
// ============================================================================

// grapick.min.css 0.1.13 (MIT), inlined so no app has to import a stylesheet from node_modules
const GRAPICK_CSS = `.grp-wrapper{background-image:url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMCAIAAADZF8uwAAAAGUlEQVQYV2M4gwH+YwCGIasIUwhT25BVBADtzYNYrHvv4gAAAABJRU5ErkJggg==")}.grp-preview{position:absolute;top:0;left:0;width:100%;height:100%;cursor:crosshair}.grp-handler{width:4px;margin-left:-2px;user-select:none;-webkit-user-select:none;height:100%}.grp-handler-close{color:rgba(0,0,0,0.4);border-radius:100%;box-shadow:0 2px 10px rgba(0,0,0,0.25);background-color:#fff;text-align:center;width:15px;height:15px;margin-left:-5px;line-height:10px;font-size:21px;cursor:pointer}.grp-handler-close-c{position:absolute;top:-17px}.grp-handler-drag{background-color:rgba(0,0,0,0.5);cursor:col-resize;width:100%;height:100%}.grp-handler-selected .grp-handler-drag{background-color:rgba(255,255,255,0.8)}.grp-handler-cp-c{display:none}.grp-handler-selected .grp-handler-cp-c{display:block}.grp-handler-cp-wrap{width:15px;height:15px;margin-left:-8px;border:3px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,0.25);overflow:hidden;border-radius:100%;cursor:pointer}.grp-handler-cp-wrap input[type=color]{opacity:0;cursor:pointer}
.eac-stopbar{padding:20px 8px 6px}.eac-stopbar .grp-wrapper{border-radius:4px}`;

interface GrapickHandler {
  getColor(): string;
  getPosition(): number;
  setColor(color: string, complete?: number): void;
}
interface GrapickInstance {
  addHandler(position: number, color: string, select?: number, options?: { silent?: boolean }): GrapickHandler;
  getHandlers(): GrapickHandler[];
  clear(options?: { silent?: boolean }): void;
  on(event: string, fn: (...a: unknown[]) => void): void;
  destroy(): void;
  updatePreview(): void;
  previewEl?: HTMLElement;
}

const same = (a: GradientStop[], b: GradientStop[]) =>
  a.length === b.length && a.every((s, i) => s.color === b[i].color && Math.round(s.at) === Math.round(b[i].at));

export function StopBar({ spec, onStops }: { spec: GradientSpec; onStops: (stops: GradientStop[]) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const gp = useRef<GrapickInstance | null>(null);
  const specRef = useRef(spec);
  specRef.current = spec;
  const onStopsRef = useRef(onStops);
  onStopsRef.current = onStops;
  const last = useRef<GradientStop[]>(spec.stops);

  const read = (): GradientStop[] =>
    (gp.current?.getHandlers() ?? [])
      .map((h) => ({ color: cssColorToHex(h.getColor()) ?? "#000000", at: Math.round(h.getPosition()) }))
      .sort((a, b) => a.at - b.at);

  const paint = (stops: GradientStop[]) => {
    const el = gp.current?.previewEl;
    if (el && stops.length >= 2) el.style.backgroundImage = gradientCss({ ...specRef.current, kind: "linear", angle: 90, shader: "none", stops });
  };

  useEffect(() => {
    let alive = true;
    let instance: GrapickInstance | null = null;
    import("grapick").then((mod) => {
      if (!alive || !host.current) return;
      const Grapick = ((mod as { default?: unknown }).default ?? mod) as new (o: Record<string, unknown>) => GrapickInstance;
      instance = new Grapick({ el: host.current, height: "22px", emptyColor: specRef.current.stops[0]?.color ?? "#000000" });
      gp.current = instance;
      // our ramp, not Grapick's sRGB one
      instance.updatePreview = () => paint(read());
      for (const s of specRef.current.stops) instance.addHandler(s.at, s.color, 0, { silent: true });
      paint(specRef.current.stops);
      instance.on("change", () => {
        // a stop added by clicking the bar arrives as rgba(r, g, b, 255), which the colour
        // input refuses; hand it back to Grapick as hex (same stops, so no second update)
        for (const h of instance?.getHandlers() ?? []) {
          const hex = cssColorToHex(h.getColor());
          if (hex && h.getColor() !== hex) h.setColor(hex, 0);
        }
        const stops = read();
        if (stops.length < 2 || same(stops, last.current)) return;
        last.current = stops;
        onStopsRef.current(stops);
      });
    });
    return () => { alive = false; instance?.destroy(); gp.current = null; };
  }, []);

  // stops changed from outside (sliders, presets, generators): rebuild the handles quietly
  useEffect(() => {
    const g = gp.current;
    if (!g || same(spec.stops, last.current)) { paint(spec.stops); return; }
    last.current = spec.stops;
    g.clear({ silent: true });
    for (const s of spec.stops) g.addHandler(s.at, s.color, 0, { silent: true });
    paint(spec.stops);
  });

  return (
    <div className="eac-stopbar">
      <style>{GRAPICK_CSS}</style>
      <div ref={host} aria-label="Gradient stops: drag to move, click the bar to add, drag off to remove" />
    </div>
  );
}
