import type { CSSProperties, ReactNode } from "react";
import { cx } from "./cx";
import { archPath, ArchStroke } from "./shapes";

export interface ArchFrameProps {
  /** Width in px (a plain number: the pointed-arch outline is generated for the exact size). */
  w: number;
  h: number;
  /** Bottom corner radius (number = px). */
  bottom?: number;
  /** Double gold frame, drawn as an SVG stroke that follows the arch outline. */
  brass?: boolean;
  src?: string | null;
  alt?: string;
  /** How the picture sits in the arch: focal point in percent and a zoom (the cms-ui CoverFrame convention). */
  frame?: { fx: number; fy: number; zoom: number } | null;
  children?: ReactNode;
}

/** cms-ui's coverFrameStyle, kept here so the phone bundle does not pull @elkdonis/cms-ui/files. */
export function frameStyle(f: { fx: number; fy: number; zoom: number } | null | undefined): CSSProperties | undefined {
  if (!f) return undefined;
  return { objectPosition: `${f.fx}% ${f.fy}%`, ...(f.zoom !== 1 ? { transform: `scale(${f.zoom})`, transformOrigin: `${f.fx}% ${f.fy}%` } : {}) };
}

/** Pointed-arch picture frame for tours and places (see shapes.tsx). */
export function ArchFrame({ w, h, bottom = 26, brass, src, alt = "", frame, children }: ArchFrameProps) {
  const style = { width: w, height: h } as CSSProperties;
  const clip = { clipPath: `path('${archPath(0, 0, w, h, bottom)}')` } as CSSProperties;
  return (
    <div className={cx("m-arch", brass && "m-frame-brass")} style={style}>
      <div className="m-arch-clip" style={clip}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={alt} className="m-fill" loading="lazy" style={frameStyle(frame)} />
        ) : null}
        {children}
      </div>
      {brass ? <ArchStroke w={w} h={h} b={bottom} /> : null}
    </div>
  );
}
