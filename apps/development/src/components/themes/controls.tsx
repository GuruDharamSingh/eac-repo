"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { hexToHsl, hslToHex, rgbaParts, rgbaString } from "@elkdonis/direct-edit/site";

// Small value controls for the theme editor. The shared Site style editor
// (packages/direct-edit/src/site/SiteStyleEditor.tsx) keeps its controls private
// and bolted to a fixed-position drawer, so these are written to the same rules
// (picker plus exact text, typed values apply on Enter or leaving the field,
// translucent colours as rgba) and use its exported helpers for the conversions.

export type VarKind = "hsl" | "color" | "rgba" | "length" | "font" | "background" | "choice" | "text";

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const HSL = /^\d{1,3}(?:\.\d+)? \d{1,3}(?:\.\d+)?% \d{1,3}(?:\.\d+)?%$/;
const LENGTH = /^(?:0|-?\d+(?:\.\d+)?(?:px|rem|em|%))$/;

export function inferKind(value: string, declared?: string, themeKind?: string): VarKind {
  if (declared === "hsl" || declared === "color" || declared === "rgba" || declared === "length" || declared === "font" || declared === "background" || declared === "choice") return declared;
  const v = value.trim();
  if (HEX.test(v) || /^#[0-9a-f]{8}$/i.test(v)) return /^#[0-9a-f]{8}$/i.test(v) ? "rgba" : "color";
  if (HSL.test(v)) return "hsl";
  if (/^rgba?\(/i.test(v)) return "rgba";
  if (themeKind === "font") return "font";
  if (LENGTH.test(v)) return "length";
  if (themeKind === "background" || /gradient\(/.test(v)) return "background";
  return "text";
}

const expand = (hex: string) => (/^#[0-9a-f]{3}$/i.test(hex) ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex);

/** The swatch colour a value shows as (for a chip next to the name), or null when it is not a colour. */
export function swatchOf(value: string, kind: VarKind): string | null {
  const v = value.trim();
  if (kind === "hsl") return `hsl(${v})`;
  if (kind === "color" || kind === "rgba") return v;
  return null;
}

const ui: Record<string, CSSProperties> = {
  input: { font: "inherit", padding: "4px 6px", border: "1px solid var(--dev-line)", borderRadius: 5, width: "100%", minWidth: 0, background: "#0f1115", color: "var(--dev-ink)" },
  picker: { width: 34, height: 26, padding: 0, border: "1px solid var(--dev-line)", borderRadius: 5, background: "none", flex: "none" },
  note: { fontSize: 11, color: "var(--dev-muted)" },
};

/** A text field that applies on Enter or blur and follows outside changes (a reset). */
function Applied({ value, onApply, placeholder, valid }: { value: string; onApply: (v: string) => void; placeholder?: string; valid?: (v: string) => boolean }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const commit = () => {
    const t = text.trim();
    if (t && t !== value && (!valid || valid(t))) onApply(t);
    else setText(value);
  };
  return <input value={text} placeholder={placeholder} style={ui.input} onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />;
}

export interface FontOption {
  label: string;
  stack: string;
}

export function VarControl({ kind, value, onChange, fonts, options }: { kind: VarKind; value: string; onChange: (v: string) => void; fonts?: FontOption[]; options?: readonly { value: string; label: string }[] }) {
  if (kind === "color") {
    const hex = HEX.test(value.trim()) ? expand(value.trim()) : "#000000";
    return (
      <>
        <input type="color" value={hex} style={ui.picker} onChange={(e) => onChange(e.target.value)} />
        <Applied value={value} onApply={onChange} placeholder="#rrggbb" valid={(v) => HEX.test(v)} />
      </>
    );
  }
  if (kind === "hsl") {
    const hex = hslToHex(value) ?? "#000000";
    return (
      <>
        <input type="color" value={hex} style={ui.picker} onChange={(e) => onChange(hexToHsl(e.target.value) ?? value)} />
        <Applied value={value} onApply={onChange} placeholder="40 50% 57%" valid={(v) => HSL.test(v)} />
      </>
    );
  }
  if (kind === "rgba") {
    const p = rgbaParts(value) ?? { hex: "#000000", a: 1 };
    return (
      <>
        <input type="color" value={p.hex} style={ui.picker} onChange={(e) => onChange(rgbaString(e.target.value, p.a))} />
        <input type="number" min={0} max={100} step={1} value={Math.round(p.a * 100)} title="Opacity %" style={{ ...ui.input, width: 54, flex: "none" }} onChange={(e) => Number.isFinite(Number(e.target.value)) && onChange(rgbaString(p.hex, Number(e.target.value) / 100))} />
        <Applied value={value} onApply={onChange} placeholder="rgba(0, 0, 0, 0.5)" valid={(v) => Boolean(rgbaParts(v))} />
      </>
    );
  }
  if (kind === "length") {
    const m = /^(-?\d+(?:\.\d+)?)(px|rem|em)$/.exec(value.trim());
    const max = m && m[2] === "px" ? 64 : 4;
    return (
      <>
        {m ? <input type="range" min={0} max={max} step={m[2] === "px" ? 1 : 0.05} value={Number(m[1])} style={{ flex: 1, minWidth: 0 }} onChange={(e) => onChange(`${e.target.value}${m[2]}`)} /> : null}
        <div style={{ width: m ? 76 : "100%", flex: "none" }}>
          <Applied value={value} onApply={onChange} placeholder="0.5rem" valid={(v) => LENGTH.test(v)} />
        </div>
      </>
    );
  }
  if (kind === "choice" && options) {
    return (
      <select value={value} style={ui.input} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }
  if (kind === "font" && fonts && fonts.length) {
    const known = fonts.some((f) => f.stack === value);
    return (
      <select value={value} style={ui.input} onChange={(e) => onChange(e.target.value)}>
        {known ? null : <option value={value}>{value.length > 34 ? `${value.slice(0, 34)}...` : value}</option>}
        {fonts.map((f) => (
          <option key={f.label} value={f.stack}>
            {f.label}
          </option>
        ))}
      </select>
    );
  }
  return <Applied value={value} onApply={onChange} />;
}
