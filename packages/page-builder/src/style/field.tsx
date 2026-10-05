"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { FieldLabel } from "@puckeditor/core";
import {
  ALIGNS,
  BORDER_SIDES,
  BORDER_STYLES,
  COLOR_TOKENS,
  HIDE_ON,
  HOVERS,
  RADIUS_STEPS,
  SHADOWS,
  STYLE_PRESETS,
  cleanCustomCss,
  cleanStyle,
  contrastRatio,
  type StyleSettings,
} from "./schema";

// ============================================================================
// The control for "Style", at the foot of every block's fields.
//
// Editor-only (the published config has the wrapper and no control). The value
// is the plain object `cleanStyle` reads; every change goes through it, so what
// is stored is already clean. Sections open and close so a block with a long
// field list is not buried: Spacing, Look, Layout, Behaviour, Custom CSS.
// ============================================================================

type Value = StyleSettings & Record<string, unknown>;

const ink = "var(--puck-color-grey-02, #2b2b2b)";
const faint = "var(--puck-color-grey-05, #6b6b6b)";
const line = "var(--puck-color-grey-09, #d4d4d4)";

const box: CSSProperties = {
  width: "100%",
  padding: "5px 6px",
  font: "inherit",
  fontSize: 13,
  border: `1px solid ${line}`,
  borderRadius: 4,
  background: "var(--puck-color-white, #fff)",
  color: ink,
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: "grid", gridTemplateColumns: "92px 1fr", alignItems: "center", gap: 8, fontSize: 12, color: ink }}>
      <span>{label}</span>
      <span style={{ minWidth: 0 }}>{children}</span>
    </label>
  );
}

function Slider({
  label,
  value,
  min = 0,
  max,
  step = 1,
  onChange,
  unit = "px",
  readOnly,
}: {
  label: string;
  value: number | undefined;
  min?: number;
  max: number;
  step?: number;
  unit?: string;
  readOnly?: boolean;
  onChange: (v: number | undefined) => void;
}) {
  const v = value ?? 0;
  return (
    <Row label={label}>
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={v}
          disabled={readOnly}
          onChange={(e) => onChange(Number(e.target.value) || undefined)}
          style={{ flex: 1, minWidth: 0 }}
          aria-label={label}
        />
        <span style={{ width: 52, textAlign: "right", fontSize: 12, color: faint, fontVariantNumeric: "tabular-nums" }}>
          {v ? `${v}${unit}` : "—"}
        </span>
      </span>
    </Row>
  );
}

function Pick<T extends string>({
  label,
  value,
  options,
  onChange,
  empty,
  readOnly,
}: {
  label: string;
  value: T | undefined;
  options: ReadonlyArray<{ value: T; label: string }>;
  empty: string;
  readOnly?: boolean;
  onChange: (v: T | undefined) => void;
}) {
  return (
    <Row label={label}>
      <select
        value={value ?? ""}
        disabled={readOnly}
        onChange={(e) => onChange((e.target.value || undefined) as T | undefined)}
        style={box}
      >
        <option value="">{empty}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Row>
  );
}

/** A palette token or a hex of your own. */
function ColorChoice({
  label,
  value,
  onChange,
  readOnly,
}: {
  label: string;
  value: string | undefined;
  readOnly?: boolean;
  onChange: (v: string | undefined) => void;
}) {
  const isToken = !value || COLOR_TOKENS.some((t) => t.value === value);
  const [custom, setCustom] = useState(!isToken);
  const hex = value && /^#[0-9a-f]{6}$/i.test(value) ? value : "#888888";
  return (
    <Row label={label}>
      <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <select
          value={custom ? "__custom" : (value ?? "")}
          disabled={readOnly}
          onChange={(e) => {
            if (e.target.value === "__custom") {
              setCustom(true);
              onChange(hex);
            } else {
              setCustom(false);
              onChange(e.target.value || undefined);
            }
          }}
          style={{ ...box, flex: 1, minWidth: 0 }}
        >
          <option value="">None</option>
          {COLOR_TOKENS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
          <option value="__custom">My own colour…</option>
        </select>
        {custom ? (
          <input
            type="color"
            value={hex}
            disabled={readOnly}
            onChange={(e) => onChange(e.target.value)}
            aria-label={`${label}, colour`}
            style={{ width: 34, height: 28, padding: 0, border: `1px solid ${line}`, borderRadius: 4, background: "none" }}
          />
        ) : null}
      </span>
    </Row>
  );
}

function Section({ title, hint, open, children }: { title: string; hint?: string; open?: boolean; children: ReactNode }) {
  return (
    <details open={open} style={{ borderTop: `1px solid ${line}`, padding: "6px 0" }}>
      <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 600, color: ink, padding: "2px 0" }}>
        {title}
        {hint ? <span style={{ fontWeight: 400, color: faint }}> · {hint}</span> : null}
      </summary>
      <div style={{ display: "grid", gap: 8, padding: "8px 0 4px" }}>{children}</div>
    </details>
  );
}

const RADIUS_OPTIONS = [
  { value: "theme", label: "The site's own" },
  ...RADIUS_STEPS.map((n) => ({ value: String(n), label: n === 0 ? "Square" : n === 999 ? "Pill" : `${n}px` })),
];

const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function StyleField({
  value,
  onChange,
  readOnly,
  field,
}: {
  value?: unknown;
  onChange: (v: Value | undefined) => void;
  readOnly?: boolean;
  field?: { label?: string };
}) {
  const current = (cleanStyle(value) ?? {}) as Value;
  // Replace the whole object so cleared keys really go; undefined when empty.
  const set = (patch: Partial<StyleSettings>) => {
    const next = { ...current, ...patch } as Record<string, unknown>;
    for (const k of Object.keys(next)) if (next[k] === undefined || next[k] === "") delete next[k];
    onChange(Object.keys(next).length ? (next as Value) : undefined);
  };
  const dirty = Object.keys(current).length > 0;
  const css = cleanCustomCss(current.custom);

  const bgHex = current.bg && /^#/.test(current.bg) ? current.bg : undefined;
  const colorHex = current.color && /^#/.test(current.color) ? current.color : undefined;
  const ratio = contrastRatio(colorHex, bgHex);

  return (
    <FieldLabel label={field?.label ?? "Style"} el="div">
      <div style={{ display: "grid", gap: 4 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {STYLE_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={readOnly}
              onClick={() => onChange({ ...p.style } as Value)}
              style={{ ...box, width: "auto", cursor: "pointer", padding: "3px 8px", fontSize: 12 }}
              title={`Start from “${p.label}”. Replaces the settings below.`}
            >
              {p.label}
            </button>
          ))}
          {dirty ? (
            <button
              type="button"
              disabled={readOnly}
              onClick={() => onChange(undefined)}
              style={{ ...box, width: "auto", cursor: "pointer", padding: "3px 8px", fontSize: 12, color: faint }}
            >
              Reset
            </button>
          ) : null}
        </div>

        <Section title="Spacing" hint="space inside and around">
          <Slider label="Inside, top & bottom" value={current.padY} max={240} step={4} readOnly={readOnly} onChange={(v) => set({ padY: v })} />
          <Slider label="Inside, sides" value={current.padX} max={240} step={4} readOnly={readOnly} onChange={(v) => set({ padX: v })} />
          <Slider label="Space above" value={current.marginTop} max={320} step={4} readOnly={readOnly} onChange={(v) => set({ marginTop: v })} />
          <Slider label="Space below" value={current.marginBottom} max={320} step={4} readOnly={readOnly} onChange={(v) => set({ marginBottom: v })} />
        </Section>

        <Section title="Look" hint="colour, border, shadow">
          <ColorChoice label="Background" value={current.bg} readOnly={readOnly} onChange={(v) => set({ bg: v })} />
          {current.bg ? (
            <Slider
              label="Background see-through"
              value={current.bgOpacity ? 100 - current.bgOpacity : undefined}
              min={0}
              max={95}
              step={5}
              unit="%"
              readOnly={readOnly}
              onChange={(v) => set({ bgOpacity: v ? 100 - v : undefined })}
            />
          ) : null}
          <ColorChoice label="Text colour" value={current.color} readOnly={readOnly} onChange={(v) => set({ color: v })} />
          {ratio !== null && ratio < 4.5 ? (
            <p style={{ margin: 0, fontSize: 12, color: "#b3261e" }}>
              Contrast is {ratio.toFixed(1)}:1; 4.5:1 is the least that reads comfortably.
            </p>
          ) : null}
          <Slider label="Border width" value={current.borderWidth} max={16} readOnly={readOnly} onChange={(v) => set({ borderWidth: v })} />
          {current.borderWidth ? (
            <>
              <Pick
                label="Border style"
                value={current.borderStyle}
                options={BORDER_STYLES.map((b) => ({ value: b, label: title(b) }))}
                empty="Solid"
                readOnly={readOnly}
                onChange={(v) => set({ borderStyle: v })}
              />
              <ColorChoice label="Border colour" value={current.borderColor} readOnly={readOnly} onChange={(v) => set({ borderColor: v })} />
              <Pick
                label="Which sides"
                value={current.borderSides}
                options={BORDER_SIDES.map((b) => ({
                  value: b,
                  label: b === "all" ? "All four" : b === "x" ? "Left and right" : b === "y" ? "Top and bottom" : title(b),
                }))}
                empty="All four"
                readOnly={readOnly}
                onChange={(v) => set({ borderSides: v })}
              />
            </>
          ) : null}
          <Pick
            label="Corners"
            value={current.radius === undefined ? undefined : String(current.radius)}
            options={RADIUS_OPTIONS}
            empty="As designed"
            readOnly={readOnly}
            onChange={(v) => set({ radius: v === undefined ? undefined : v === "theme" ? "theme" : Number(v) })}
          />
          <Pick
            label="Shadow"
            value={current.shadow}
            options={SHADOWS.map((s) => ({ value: s, label: title(s) }))}
            empty="None"
            readOnly={readOnly}
            onChange={(v) => set({ shadow: v })}
          />
          <Slider
            label="See-through"
            value={current.opacity ? 100 - current.opacity : undefined}
            max={90}
            step={5}
            unit="%"
            readOnly={readOnly}
            onChange={(v) => set({ opacity: v ? 100 - v : undefined })}
          />
        </Section>

        <Section title="Layout" hint="width and height">
          <Slider label="Widest" value={current.maxWidth} min={0} max={1600} step={20} readOnly={readOnly} onChange={(v) => set({ maxWidth: v })} />
          {current.maxWidth ? (
            <Pick
              label="Sits"
              value={current.align}
              options={ALIGNS.map((a) => ({ value: a, label: a === "start" ? "Left" : a === "end" ? "Right" : "Centred" }))}
              empty="Left"
              readOnly={readOnly}
              onChange={(v) => set({ align: v })}
            />
          ) : null}
          <Slider label="Least height" value={current.minHeight} max={1200} step={20} readOnly={readOnly} onChange={(v) => set({ minHeight: v })} />
        </Section>

        <Section title="Behaviour" hint="visibility, hover, links">
          <Pick
            label="Hide on"
            value={current.hideOn}
            options={HIDE_ON.map((h) => ({ value: h, label: h === "mobile" ? "Phones" : "Larger screens" }))}
            empty="Never"
            readOnly={readOnly}
            onChange={(v) => set({ hideOn: v })}
          />
          <Pick
            label="On hover"
            value={current.hover}
            options={HOVERS.map((h) => ({ value: h, label: h === "lift" ? "Lift" : h === "glow" ? "Glow" : "Brighten" }))}
            empty="Nothing"
            readOnly={readOnly}
            onChange={(v) => set({ hover: v })}
          />
          <Row label="Link target">
            <input
              value={current.anchor ?? ""}
              disabled={readOnly}
              placeholder="e.g. visiting"
              spellCheck={false}
              onChange={(e) => set({ anchor: e.target.value.trim() || undefined })}
              style={box}
              aria-label="Anchor id; link to it with #name"
            />
          </Row>
          <Row label="Class names">
            <input
              value={current.className ?? ""}
              disabled={readOnly}
              placeholder="for the site's own CSS"
              spellCheck={false}
              onChange={(e) => set({ className: e.target.value || undefined })}
              style={box}
            />
          </Row>
        </Section>

        <Section title="Custom CSS" hint={css.kept.length ? `${css.kept.length} applied` : "properties only"} open={Boolean(current.custom)}>
          <textarea
            value={current.custom ?? ""}
            disabled={readOnly}
            rows={5}
            spellCheck={false}
            placeholder={"border-bottom: 2px solid var(--blk-accent);\nbackground: linear-gradient(135deg, #222, #444);"}
            onChange={(e) => set({ custom: e.target.value || undefined })}
            style={{ ...box, fontFamily: "ui-monospace, monospace", fontSize: 12, resize: "vertical" }}
            aria-label="Custom CSS declarations"
          />
          <p style={{ margin: 0, fontSize: 11, color: faint, lineHeight: 1.4 }}>
            One <code>property: value;</code> per line, applied to this block. Colour, border, shadow, gradient, filter,
            transform, spacing, size and type properties work; links, scripts and positioning are left out. Use the
            site&rsquo;s colours as <code>var(--blk-accent)</code>, <code>var(--blk-bg-soft)</code> and so on.
          </p>
          {css.rejected.length ? (
            <ul style={{ margin: 0, padding: "0 0 0 16px", fontSize: 12, color: "#b3261e" }}>
              {css.rejected.map((r, i) => (
                <li key={i}>
                  <code>{r.line.slice(0, 60)}</code> ignored: {r.reason}
                </li>
              ))}
            </ul>
          ) : null}
        </Section>
      </div>
    </FieldLabel>
  );
}

