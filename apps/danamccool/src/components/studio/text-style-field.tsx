"use client";

import type { CSSProperties } from "react";
import { FieldLabel } from "@puckeditor/core";
import { ColorField } from "@elkdonis/page-builder";
import { FONTS } from "@/lib/fonts";
import {
  ALL_FONTS_HREF,
  CASES,
  PRESETS,
  ROLE_FONTS,
  TRACKINGS,
  WEIGHTS,
  cleanTextStyle,
  textStyleAttrs,
  type TextStyle,
} from "@/lib/puck/text-style";

// ============================================================================
// The "Text style" control, at the foot of every block's fields.
//
// Built for someone choosing by eye: every typeface is listed by NAME and
// drawn in itself, the presets are drawn as they would look, and a sample
// line shows the result before it reaches the page. The site's own roles
// ("Menu lettering", "Heading font") come first, because those follow the
// Theme; the named typefaces are fixed. See lib/puck/text-style.tsx.
//
// This runs in the editor's own document (the fields panel), not the canvas
// iframe; the site's --dm-* variables are declared there too, by the root
// layout, so the role previews show the real menu and heading faces.
// ============================================================================

const SAMPLE = "Medicine Buddha — Collections";

/** The same variables and rules the page uses, as an inline style for a preview. */
function previewStyle(ts: TextStyle | null): CSSProperties {
  if (!ts) return {};
  const { style } = textStyleAttrs(ts);
  const s: Record<string, string> = { ...style };
  if (style["--ts-font"]) s.fontFamily = style["--ts-font"];
  if (style["--ts-weight"]) s.fontWeight = style["--ts-weight"];
  if (style["--ts-case"]) s.textTransform = style["--ts-case"];
  if (style["--ts-tracking"]) s.letterSpacing = style["--ts-tracking"];
  if (ts.italic) s.fontStyle = "italic";
  if (style["--ts-color"]) s.color = style["--ts-color"];
  return s as CSSProperties;
}

export function TextStyleField({
  value,
  onChange,
  readOnly,
}: {
  value?: unknown;
  onChange: (value: TextStyle | undefined) => void;
  readOnly?: boolean;
}) {
  const ts = cleanTextStyle(value) ?? {};
  const set = (patch: Partial<TextStyle>) => {
    const next = cleanTextStyle({ ...ts, ...patch });
    onChange(next ?? undefined);
  };
  const isSet = Object.keys(ts).length > 0;

  return (
    <FieldLabel label="Text style" el="div">
      {/* Every typeface, once, so the list below can draw each in itself. */}
      {ALL_FONTS_HREF ? <link rel="stylesheet" href={ALL_FONTS_HREF} precedence="default" /> : null}
      <div className="dm-tsf" aria-disabled={readOnly || undefined}>
        <p className="dm-tsf-hint">The words in this block. Anything left “as designed” keeps the block’s own look.</p>

        <div className="dm-tsf-sample" style={previewStyle(ts)} aria-label="Sample">
          {SAMPLE}
        </div>

        <fieldset className="dm-tsf-group">
          <legend>Presets</legend>
          <div className="dm-tsf-presets">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className="dm-tsf-chip"
                style={previewStyle(p.style)}
                disabled={readOnly}
                onClick={() => onChange(cleanTextStyle({ ...p.style, color: ts.color }) ?? undefined)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="dm-tsf-group">
          <legend>Font</legend>
          <ul className="dm-tsf-fonts" role="listbox" aria-label="Font">
            <li>
              <button
                type="button"
                role="option"
                aria-selected={!ts.font}
                className="dm-tsf-font"
                disabled={readOnly}
                onClick={() => set({ font: undefined })}
              >
                As designed
              </button>
            </li>
            {ROLE_FONTS.map((f) => (
              <li key={f.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={ts.font === f.value}
                  className="dm-tsf-font"
                  style={{
                    fontFamily: f.stack,
                    ...(f.value === "menu"
                      ? { textTransform: "var(--dm-nav-case, uppercase)" as never, letterSpacing: "var(--dm-nav-tracking, 0.06em)", fontWeight: "var(--dm-nav-weight, 500)" as never }
                      : {}),
                  }}
                  disabled={readOnly}
                  onClick={() => set({ font: f.value })}
                >
                  {f.label}
                </button>
              </li>
            ))}
            <li className="dm-tsf-sep" role="presentation">Typefaces</li>
            {FONTS.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={ts.font === f.id}
                  className="dm-tsf-font"
                  style={{ fontFamily: f.stack }}
                  disabled={readOnly}
                  onClick={() => set({ font: f.id })}
                >
                  {f.label}
                </button>
              </li>
            ))}
          </ul>
        </fieldset>

        <div className="dm-tsf-row">
          <label>
            <span>Weight</span>
            <select value={ts.weight ?? ""} disabled={readOnly} onChange={(e) => set({ weight: e.target.value || undefined })}>
              {WEIGHTS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Capitals</span>
            <select value={ts.case ?? ""} disabled={readOnly} onChange={(e) => set({ case: e.target.value || undefined })}>
              {CASES.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Letter spacing</span>
            <select value={ts.tracking ?? ""} disabled={readOnly} onChange={(e) => set({ tracking: e.target.value || undefined })}>
              {TRACKINGS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label className="dm-tsf-check">
            <input type="checkbox" checked={!!ts.italic} disabled={readOnly} onChange={(e) => set({ italic: e.target.checked || undefined })} />
            <span>Italic</span>
          </label>
        </div>

        <ColorField
          value={ts.color ?? ""}
          readOnly={readOnly}
          field={{ label: "Text colour" }}
          hint="Empty: the block's own colours."
          onChange={(c) => set({ color: c || undefined })}
        />

        {isSet ? (
          <button type="button" className="dm-tsf-clear" disabled={readOnly} onClick={() => onChange(undefined)}>
            Back to as designed
          </button>
        ) : null}
      </div>
    </FieldLabel>
  );
}
