import type { JSX } from "react";

// Surface icons transcribed from design/Surface Icon.dc.html (build()).
// Path data is copied verbatim from the design. Drawn on a 20-unit grid,
// rendered with viewBox "1.25 1.25 17.5 17.5" (about 14% larger than the grid).
// Colour is currentColor. Stroke 1.5 for things and marks, 2 for stamps.

export type SurfaceIconKind = "evt" | "svc" | "ser" | "art" | "wr" | "talk" | "pf" | "share" | "fol" | "done";
export type SurfaceIconSet = "things" | "marks" | "stamps" | "glyph";

type IconShape = {
  /** filled path (fill currentColor) */
  f?: string;
  /** stroked path (stroke currentColor, fill none) */
  s?: string;
  /** knock-out stroke, #24282a, width 2 (stamps only) */
  k?: string;
  /** fill-rule evenodd on the filled path */
  e?: boolean;
};

const SHAPES: Record<Exclude<SurfaceIconSet, "glyph">, Record<SurfaceIconKind, IconShape>> = {
  things: {
    evt: { s: "M3 5.5H17V8.5A1.5 1.5 0 0 0 17 11.5V14.5H3V11.5A1.5 1.5 0 0 0 3 8.5Z M12.5 7.5v1M12.5 9.5v1M12.5 11.5v1" },
    svc: { s: "M3.25 10a6.75 6.75 0 1 0 13.5 0a6.75 6.75 0 1 0 -13.5 0 M10 6v4.25l2.75 2" },
    ser: { s: "M3.25 8.25h9.5v8.5h-9.5Z M5.75 8.25V5.75h9.5v8.5h-2.5 M8.25 5.75V3.25h9.5v8.5h-2.5" },
    art: { s: "M4.25 3.25h11.5v8.5H4.25Z M7.5 11.75 5.5 17.25 M12.5 11.75l2 5.5 M10 11.75v3.5 M6.75 9.25 9 7l1.5 1.5 2.75-2.75" },
    wr: { f: "M8.9 10.25a1.1 1.1 0 1 0 2.2 0a1.1 1.1 0 1 0 -2.2 0", s: "M10 2.75 14.75 8.25 12.25 15.25H7.75L5.25 8.25Z M10 2.75V8.75 M7 17.75h6" },
    talk: { s: "M7.25 6.5V3.25h9.5v7h-2.5 M3.25 6.5h10v7.25H8.25l-3 2.5v-2.5h-2Z" },
    pf: { s: "M6.75 6.75a3.25 3.25 0 1 0 6.5 0a3.25 3.25 0 1 0 -6.5 0 M3.75 17.25c0-3.6 2.8-6 6.25-6s6.25 2.4 6.25 6" },
    share: { s: "M8.25 4.25h-4v11.5h11.5v-4 M11 3.25h5.75V9 M16.75 3.25 9.25 10.75" },
    fol: { s: "M5.25 13.75V9a4.75 4.75 0 0 1 9.5 0v4.75l1.5 1.5H3.75Z M8.25 17.75h3.5" },
    done: { s: "M4.25 10.25 8.25 14.25 15.75 6" },
  },
  marks: {
    evt: { f: "M6.75 10a3.25 3.25 0 1 0 6.5 0a3.25 3.25 0 1 0 -6.5 0", s: "M2.25 10h15.5" },
    svc: { s: "M2.5 10a4.75 4.75 0 1 0 9.5 0a4.75 4.75 0 1 0 -9.5 0 M8 10a4.75 4.75 0 1 0 9.5 0a4.75 4.75 0 1 0 -9.5 0" },
    ser: { f: "M2 10a2 2 0 1 0 4 0a2 2 0 1 0 -4 0 M8 10a2 2 0 1 0 4 0a2 2 0 1 0 -4 0", s: "M14.25 10a1.75 1.75 0 1 0 3.5 0a1.75 1.75 0 1 0 -3.5 0" },
    art: { f: "M7.25 7.25h5.5v5.5h-5.5Z", s: "M3.25 3.25h13.5v13.5H3.25Z" },
    wr: { f: "M11.25 4H9a3.5 3.5 0 0 0 0 7h2.25Z", s: "M11.25 4v13 M14.75 4v13 M11.25 4h5" },
    talk: { f: "M3.75 12a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0 M11.25 12a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0", s: "M3.75 12c0-3.5 1.5-5.75 4.25-6.75 M11.25 12c0-3.5 1.5-5.75 4.25-6.75" },
    pf: { f: "M7 6.75a3 3 0 1 0 6 0a3 3 0 1 0 -6 0", s: "M4.5 17.25a5.5 5.5 0 0 1 11 0" },
    share: { s: "M5.5 14.5 14.5 5.5 M7.75 5.5h6.75v6.75" },
    fol: { s: "M10 4v12 M4 10h12" },
    done: { s: "M4.25 10.25 8.25 14.25 15.75 6" },
  },
  stamps: {
    evt: { f: "M2.5 2.75h15v2.5h-15Z M3 5.25h5.75c-.4 4.6-2.3 8-5.75 9.75Z M17 5.25h-5.75c.4 4.6 2.3 8 5.75 9.75Z", s: "M2.5 17.25h15" },
    svc: { f: "M3.25 5h13.5v3.25H3.25Z M10.5 10.5h3.75v3.75H10.5Z", s: "M3.25 5h13.5v11.75H3.25Z M7 2.5v3.5M13 2.5v3.5" },
    ser: { s: "M15.75 10a5.75 5.75 0 0 0-10.2-3.65 M5.25 2.75v3.75H9 M4.25 10a5.75 5.75 0 0 0 10.2 3.65 M14.75 17.25V13.5H11" },
    art: { f: "M10 2.75a7.25 7.25 0 1 0 0 14.5c1.25 0 1.7-.85 1.35-1.7-.45-1.05-.1-2.2 1.25-2.2h1.4a3.75 3.75 0 0 0 3.75-3.75c0-3.8-3.4-6.85-7.75-6.85Z M4.95 9.25a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0 -2.6 0 M7.45 6a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0 -2.6 0 M11.45 6.25a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0 -2.6 0", e: true },
    wr: { f: "M2.25 4.75c3-1 5.5-.6 7 .9V17c-1.5-1.4-4-1.8-7-.9Z M17.75 4.75c-3-1-5.5-.6-7 .9V17c1.5-1.4 4-1.8 7-.9Z" },
    talk: { f: "M2.75 3.75h14.5v10H9.25l-4.5 3.5v-3.5h-2Z" },
    pf: { f: "M6.5 6.5a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0 -7 0 M3.25 17.5c0-4 3-6.75 6.75-6.75s6.75 2.75 6.75 6.75Z" },
    share: { f: "M2.25 9.25 17.75 2.25 12.75 17.75 9.75 10.25Z", k: "M9.75 10.25 17.75 2.25" },
    fol: { f: "M4.75 14V9a5.25 5.25 0 0 1 10.5 0v5l1.75 1.75H3Z M8 17h4v1.25H8Z" },
    done: { f: "M2.75 10a7.25 7.25 0 1 0 14.5 0a7.25 7.25 0 1 0 -14.5 0", k: "M6.5 10.25 9 12.75 13.75 7.75" },
  },
};

const GLYPHS: Record<SurfaceIconKind, string> = {
  evt: "◆",
  svc: "◇",
  ser: "◎",
  art: "▣",
  wr: "◉",
  talk: "☰",
  pf: "●",
  share: "↗",
  fol: "+",
  done: "✓",
};

export function SurfaceIcon({
  kind,
  set = "things",
  size = 17,
  className,
}: {
  kind: SurfaceIconKind;
  set?: SurfaceIconSet;
  size?: number;
  className?: string;
}): JSX.Element {
  if (set === "glyph") {
    return (
      <span
        className={className}
        aria-hidden="true"
        style={{ display: "grid", placeItems: "center", width: size, height: size, lineHeight: 1 }}
      >
        {GLYPHS[kind]}
      </span>
    );
  }
  const shape = SHAPES[set][kind] ?? SHAPES.things[kind];
  const kids: JSX.Element[] = [];
  if (shape.f) {
    kids.push(<path key="f" d={shape.f} fill="currentColor" fillRule={shape.e ? "evenodd" : "nonzero"} />);
  }
  if (shape.s) {
    kids.push(<path key="s" d={shape.s} fill="none" stroke="currentColor" strokeLinejoin="miter" />);
  }
  if (shape.k) {
    kids.push(<path key="k" d={shape.k} fill="none" stroke="#24282a" strokeWidth={2} />);
  }
  return (
    <svg
      className={className}
      viewBox="1.25 1.25 17.5 17.5"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={set === "stamps" ? 2 : 1.5}
      strokeLinejoin="miter"
      strokeLinecap="butt"
      aria-hidden="true"
    >
      {kids}
    </svg>
  );
}
