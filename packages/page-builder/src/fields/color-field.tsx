"use client";

import { FieldLabel } from "@puckeditor/core";

// ============================================================================
// A colour, for a `string` prop declared `format: "color"`.
//
// The browser's own picker for choosing, a hex box for typing one you already
// know (her violet is #795ff0, not something you find by dragging), and a way
// back to EMPTY — which is not a colour but "the theme's", and has to stay
// reachable: a native colour input can never be cleared once touched.
// ============================================================================

export interface ColorFieldProps {
  value?: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  field?: { label?: string };
  hint?: string;
}

const HEX6 = /^#[0-9a-f]{6}$/i;

export function ColorField({ value, onChange, readOnly, field, hint }: ColorFieldProps) {
  const label = field?.label ?? "Colour";
  const current = typeof value === "string" ? value : "";
  // The native input only understands #rrggbb; anything else shows as black
  // there but stays as typed in the box.
  const swatch = HEX6.test(current) ? current : "#000000";

  return (
    <FieldLabel label={label} el="div">
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <input
          type="color"
          value={swatch}
          disabled={readOnly}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: 36, height: 30, padding: 0, border: "1px solid var(--puck-color-border, #d1d5db)", borderRadius: 4, background: "none" }}
          aria-label={`${label}, picker`}
        />
        <input
          type="text"
          value={current}
          placeholder="Theme"
          disabled={readOnly}
          spellCheck={false}
          onChange={(e) => onChange(e.target.value.trim())}
          style={{
            flex: 1,
            minWidth: 0,
            padding: "0.3rem 0.4rem",
            border: "1px solid var(--puck-color-border, #d1d5db)",
            borderRadius: 4,
            fontSize: "0.85rem",
            fontFamily: "ui-monospace, monospace",
          }}
          aria-label={`${label}, hex value`}
        />
        {current ? (
          <button
            type="button"
            disabled={readOnly}
            onClick={() => onChange("")}
            style={{ fontSize: "0.8rem", padding: "0.3rem 0.5rem", border: "1px solid var(--puck-color-border, #d1d5db)", borderRadius: 4, background: "none", cursor: "pointer" }}
          >
            Reset
          </button>
        ) : null}
      </div>
      {hint ? <div style={{ fontSize: "0.75rem", opacity: 0.7, marginTop: "0.35rem" }}>{hint}</div> : null}
    </FieldLabel>
  );
}
