"use client";

import { FieldLabel } from "@puckeditor/core";

// ============================================================================
// A bounded number, as something you DRAG.
//
// Puck has no component resize — no handles on the canvas, no grid, nothing.
// Verified in its source, and it is not an oversight: a block's size is the
// host's CSS, and the editor deliberately declines to have an opinion. So the
// only place a width can be changed is the field panel, and the only question
// is whether changing it feels like drawing or like filling in a form.
//
// A number box is the form. You select the text, type 45, tab out, and look at
// the result — and repeat, because a width is something you judge by eye and
// not a value you know in advance. A slider costs one control and turns the
// same prop into a continuous adjustment with the canvas updating as you move,
// which is as close to dragging the image's edge as this editor allows.
//
// It only appears for props that declared a `min` and a `max`. A count of
// posts has no range and stays a box, which is right: you do know that number.
// ============================================================================

export interface SizeFieldProps {
  value?: number;
  onChange: (value: number) => void;
  readOnly?: boolean;
  field?: { label?: string };
  hint?: string;
  min: number;
  max: number;
  step: number;
  /** Shown after the number, e.g. "%". Display only. */
  unit?: string;
}

export function SizeField({
  value,
  onChange,
  readOnly,
  field,
  hint,
  min,
  max,
  step,
  unit,
}: SizeFieldProps) {
  const label = field?.label ?? "Size";
  // An unset prop still has to put the handle somewhere. The midpoint is a
  // lie; the minimum is at least true — and this only shows before the first
  // edit, since a block's declared default is written in on insert.
  const current = typeof value === "number" && Number.isFinite(value) ? value : min;

  return (
    <FieldLabel label={label}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={current}
          disabled={readOnly}
          // `input`, not `change`: the canvas should follow the handle while it
          // moves. React's onChange on a range IS the input event, so this is
          // live already — the note is here because it looks like it is not.
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ flex: 1, minWidth: 0, accentColor: "var(--puck-color-interactive, #0670e0)" }}
          aria-label={label}
        />
        {/* The number stays typable. A slider alone cannot hit an exact value,
            and "make both images 40" is a real thing someone wants to do. */}
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={current}
          disabled={readOnly}
          onChange={(e) => {
            const next = Number(e.target.value);
            if (!Number.isFinite(next)) return;
            // Clamped here as well as in coerceProps: typing 400 into the box
            // should not send a 400 to the canvas and only be caught on reload.
            onChange(Math.min(max, Math.max(min, next)));
          }}
          style={{
            width: "4.5rem",
            padding: "0.3rem 0.4rem",
            border: "1px solid var(--puck-color-border, #d1d5db)",
            borderRadius: 4,
            fontSize: "0.85rem",
          }}
          aria-label={`${label}, exact value`}
        />
        {unit ? (
          <span style={{ fontSize: "0.8rem", opacity: 0.7 }} aria-hidden>
            {unit}
          </span>
        ) : null}
      </div>
      {hint ? (
        <div style={{ fontSize: "0.75rem", opacity: 0.7, marginTop: "0.35rem" }}>{hint}</div>
      ) : null}
    </FieldLabel>
  );
}
