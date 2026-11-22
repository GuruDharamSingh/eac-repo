"use client";

import type { CSSProperties, ReactNode } from "react";
import "./web.css";
import "./phone.scoped.css";
import "./shapes.scoped.css";
import "./phone-blocks.scoped.css";

// The phone design's primitives, copied from apps/elktours/src/components/mobile/* (cx, roman, shapes, arch-frame,
// porthole, chip, section-header, primary-button, facts, catalogue-row, stop-timeline) with next/link and the router
// taken out. The CSS beside this file is generated from the app's own stylesheets and scoped (scope-css.py).

export const cx = (...p: Array<string | false | null | undefined>) => p.filter(Boolean).join(" ");

const TABLE: Array<[number, string]> = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
export function roman(n: number): string {
  let rest = n;
  let out = "";
  for (const [v, s] of TABLE) while (rest >= v) { out += s; rest -= v; }
  return out;
}

const f = (n: number) => +n.toFixed(2);
export function archPath(x: number, y: number, w: number, h: number, b: number): string {
  const r = Math.max(0, Math.min(w / 2, h - Math.min(b, h / 2)));
  const bb = Math.min(b, w / 2, h - r);
  return [`M${f(x)} ${f(y + r)}`, `L${f(x)} ${f(y + h - bb)}`, `A${f(bb)} ${f(bb)} 0 0 0 ${f(x + bb)} ${f(y + h)}`, `L${f(x + w - bb)} ${f(y + h)}`, `A${f(bb)} ${f(bb)} 0 0 0 ${f(x + w)} ${f(y + h - bb)}`, `L${f(x + w)} ${f(y + r)}`, `A${f(w / 2)} ${f(r)} 0 0 0 ${f(x)} ${f(y + r)}`, "Z"].join("");
}
function ArchStroke({ w, h, b }: { w: number; h: number; b: number }) {
  return (
    <svg className="m-arch-frame" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <path className="is-halo" d={archPath(-4, -4, w + 8, h + 8, b + 4)} />
      <path className="is-line" d={archPath(0.5, 0.5, w - 1, h - 1, b)} />
    </svg>
  );
}

export function ArchFrame({ w, h, bottom = 26, brass, src, alt = "", children }: { w: number; h: number; bottom?: number; brass?: boolean; src?: string | null; alt?: string; children?: ReactNode }) {
  const style = { width: w, height: h } as CSSProperties;
  const clip = { clipPath: `path('${archPath(0, 0, w, h, bottom)}')` } as CSSProperties;
  return (
    <div className={cx("m-arch", brass && "m-frame-brass")} style={style}>
      <div className="m-arch-clip" style={clip}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={alt} className="m-fill" />
        ) : null}
        {children}
      </div>
      {brass ? <ArchStroke w={w} h={h} b={bottom} /> : null}
    </div>
  );
}

export function Porthole({ size, src, verdigris, initial }: { size: number; src?: string | null; verdigris?: boolean; initial?: string }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) } as CSSProperties;
  return (
    <div className={cx("m-porthole", verdigris && "is-verdigris")} style={style}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="m-fill" />
      ) : initial ? (
        <span className="m-porthole-initial">{initial}</span>
      ) : null}
    </div>
  );
}

export function Chip({ children, selected }: { children: ReactNode; selected?: boolean }) {
  return (
    <button type="button" className={cx("m-chip", selected && "is-selected")} aria-pressed={selected ?? false}>
      {children}
    </button>
  );
}
export const ChipRow = ({ children }: { children: ReactNode }) => <div className="m-chip-row">{children}</div>;

export function SectionHeader({ label, more }: { label: string; more?: string }) {
  return (
    <div className="m-section">
      <span className="m-kicker m-section-label">{label}</span>
      <span className="m-rule" aria-hidden="true" />
      {more ? <a href="#" className="m-section-more">{more}</a> : null}
    </div>
  );
}

export const PrimaryButton = ({ children }: { children: ReactNode }) => (
  <a href="#" className="m-btn">
    {children}
  </a>
);

export function FactsStrip({ items }: { items: { label: string; value: string }[] }) {
  return (
    <dl className="m-facts m-facts-strip" style={{ gridTemplateColumns: `repeat(${Math.max(items.length, 1)}, minmax(0, 1fr))` }}>
      {items.map((x, i) => (
        <div key={i} className="m-fact">
          <dt className="m-kicker m-fact-k">{x.label}</dt>
          <dd className="m-fact-v">{x.value}</dd>
        </div>
      ))}
    </dl>
  );
}
export function FactsGrid({ items }: { items: { label: string; value: string }[] }) {
  return (
    <dl className="m-facts m-facts-grid">
      {items.map((x, i) => (
        <div key={i} className="m-fact">
          <dt className="m-kicker m-fact-k">{x.label}</dt>
          <dd className="m-fact-v">{x.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function CatalogueRow({ thumb, kicker, title, meta }: { thumb?: ReactNode; kicker?: string; title: string; meta?: string }) {
  return (
    <a href="#" className="m-row m-cusp">
      {thumb ? <span className="m-row-thumb">{thumb}</span> : null}
      <span className="m-row-text">
        {kicker ? <span className="m-kicker m-row-kicker">{kicker}</span> : null}
        <span className="m-row-title">{title}</span>
        {meta ? <span className="m-row-meta">{meta}</span> : null}
      </span>
      <span className="m-row-chev" aria-hidden="true">{"›"}</span>
    </a>
  );
}

export interface TimelineStop { name: string; when?: string; note?: ReactNode; thumb?: ReactNode; extra?: ReactNode }
export function StopTimeline({ stops, openIndex }: { stops: TimelineStop[]; openIndex: number | null }) {
  return (
    <ol className="m-stops">
      {stops.map((s, i) => {
        const open = openIndex === i;
        return (
          <li key={i} className="m-stop">
            <div className="m-stop-rail">
              <span className="m-stop-num">{roman(i + 1)}</span>
              {i < stops.length - 1 ? <span className="m-stop-line" aria-hidden="true" /> : null}
            </div>
            <div className="m-stop-main">
              <div className="m-stop-body">
                <button type="button" className="m-stop-name" aria-expanded={open}>{s.name}</button>
                {open ? (
                  <div className="m-stop-open m-fade">
                    {s.when ? <span className="m-kicker m-stop-when">{s.when}</span> : null}
                    {s.note ? <p className="m-stop-note">{s.note}</p> : null}
                    {s.extra}
                  </div>
                ) : null}
              </div>
              {s.thumb && !open ? <span className="m-stop-thumb">{s.thumb}</span> : null}
              <button type="button" className="m-stop-ring" tabIndex={-1} aria-hidden="true">{open ? "−" : "+"}</button>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** A phone screen for one block: the app's phone tokens and sheet, 400px wide, drawn at 3x zoom in the tile. */
export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="em-phone">
      <div className="elk-m m-shell">{children}</div>
    </div>
  );
}

/** A block's "blk" wrapper helper. */
export const Blk = ({ className, children }: { className: string; children: ReactNode }) => <div className={`blk ${className}`}>{children}</div>;
