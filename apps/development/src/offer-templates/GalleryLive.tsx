"use client";

import * as React from "react";
import { TEMPLATES, type TemplateInfo } from "@elkdonis/cms-ui/offer-templates/types";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const FONTS = [
  ["para", "Para"],
  ["gazette", "Gazette"],
  ["quiet", "Quiet"],
  ["marquee", "Marquee"],
  ["ledger", "Ledger"],
  ["rite", "Rite"],
] as const;
const ICONS = ["things", "marks", "stamps", "glyph"] as const;
const MARKS = ["inline", "thumb", "box"] as const;

interface Pick {
  t: string;
  ft: string;
  icons: string;
  tint: "on" | "off";
  mark: string;
  sheet: "natural" | "level";
}
const DEFAULTS: Pick = { t: TEMPLATES[0]!.id, ft: "para", icons: "things", tint: "on", mark: "inline", sheet: "natural" };

function readHash(): Pick {
  const out = { ...DEFAULTS };
  try {
    const p = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const t = p.get("t");
    if (t && TEMPLATES.some((x) => x.id === t)) out.t = t;
    const ft = p.get("ft");
    if (ft && FONTS.some((f) => f[0] === ft)) out.ft = ft;
    const icons = p.get("icons");
    if (icons && (ICONS as readonly string[]).includes(icons)) out.icons = icons;
    if (p.get("tint") === "off") out.tint = "off";
    const mark = p.get("mark");
    if (mark && (MARKS as readonly string[]).includes(mark)) out.mark = mark;
    if (p.get("sheet") === "level") out.sheet = "level";
  } catch {
    /* no hash: defaults */
  }
  return out;
}

function toParams(p: Pick): URLSearchParams {
  const q = new URLSearchParams({ ft: p.ft, icons: p.icons, mark: p.mark });
  if (p.tint === "off") q.set("tint", "off");
  if (p.sheet === "level") q.set("sheet", "level");
  return q;
}

function Seg<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: ReadonlyArray<readonly [T, string]>; onChange: (v: T) => void }) {
  return (
    <div className="gl-sw">
      <span className="gl-sw-label">{label}</span>
      <div className="gl-seg" role="group" aria-label={label}>
        {options.map(([v, text]) => (
          <button key={v} type="button" aria-pressed={v === value} onClick={() => onChange(v)}>
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

/** An iframe drawn at its true size and scaled down by CSS to fit its column. */
function ScaledFrame({ src, width, height, title }: { src: string; width: number; height: number; title: string }) {
  const box = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(0.5);
  React.useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, el.clientWidth / width));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);
  return (
    <div ref={box} className="gl-scaled" style={{ height: Math.round(height * scale) + 2 }}>
      <iframe title={title} src={src} width={width} height={height} style={{ width, height, transform: `scale(${scale})` }} />
    </div>
  );
}

export function GalleryLive() {
  const [pick, setPick] = React.useState<Pick>(DEFAULTS);
  React.useEffect(() => {
    const sync = () => setPick(readHash());
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  function update(patch: Partial<Pick>) {
    const next = { ...pick, ...patch };
    setPick(next);
    try {
      const p = toParams(next);
      p.set("t", next.t);
      history.replaceState(null, "", `#${p.toString()}`);
    } catch {
      /* a blocked history API only loses the shareable hash */
    }
  }

  const info: TemplateInfo = TEMPLATES.find((x) => x.id === pick.t) ?? TEMPLATES[0]!;
  const src = `${BASE}/offer-templates/t/${info.id}?${toParams(pick).toString()}`;

  return (
    <div className="gl-live">
      <nav className="gl-nav" aria-label="Templates">
        <label className="gl-nav-select">
          <span>Template</span>
          <select value={info.id} onChange={(e) => update({ t: e.target.value })}>
            {TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <ul className="gl-rail">
          {TEMPLATES.map((t) => (
            <li key={t.id}>
              <button type="button" aria-current={t.id === info.id} onClick={() => update({ t: t.id })}>
                <span className="gl-rail-name">
                  {t.name}
                  <span className="gl-chip">{t.packet}</span>
                </span>
                <span className="gl-rail-kinds">{t.kinds.join(" · ")}</span>
                <span className="gl-rail-blurb">{t.blurb}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="gl-main">
        <div className="gl-head">
          <div>
            <h2>
              {info.name} <span className="gl-chip">{info.packet}</span>
            </h2>
            <p className="gl-blurb">
              {info.blurb} Suits: {info.kinds.join(", ")}.
            </p>
          </div>
          <a className="gl-open" href={src} target="_blank" rel="noreferrer">
            Open full window ↗
          </a>
        </div>

        <div className="gl-switches">
          <Seg label="Font template" value={pick.ft} options={FONTS} onChange={(ft) => update({ ft })} />
          <Seg label="Icons" value={pick.icons} options={ICONS.map((i) => [i, i] as const)} onChange={(icons) => update({ icons })} />
          <Seg label="Kind tint" value={pick.tint} options={[["on", "On"], ["off", "Off"]] as const} onChange={(tint) => update({ tint })} />
          <Seg label="Phone head mark" value={pick.mark} options={MARKS.map((m) => [m, m] as const)} onChange={(mark) => update({ mark })} />
          <Seg label="Sheet" value={pick.sheet} options={[["natural", "Natural"], ["level", "Level"]] as const} onChange={(sheet) => update({ sheet })} />
        </div>

        <div className="gl-frames">
          <figure className="gl-fig gl-fig-desk">
            <figcaption>Desktop · 1280 × 800, scrolls inside</figcaption>
            <ScaledFrame key={`d-${src}`} src={src} width={1280} height={800} title={`${info.name}, desktop`} />
          </figure>
          <figure className="gl-fig gl-fig-phone">
            <figcaption>Phone · 390 × 844, scrolls inside</figcaption>
            <div className="gl-phone">
              <iframe key={`p-${src}`} title={`${info.name}, phone`} src={src} width={390} height={844} />
            </div>
          </figure>
        </div>
      </div>
    </div>
  );
}
