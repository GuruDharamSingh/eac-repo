"use client";

// ============================================================================
// Editor adapters. Not wired into the editors yet (2026-11-07): this is the
// surface they will use.
//
//   Puck            gradientField({ label })  -> a custom field for a block's
//                   `fields`; the stored prop is a GradientSpec
//   direct editor   mountGradientControl(host, { value, onChange }) -> a React
//                   island in its DOM panel (same createRoot pattern as
//                   direct-edit/src/puck/mount.ts)
//   blocks          gradientDecls(spec) -> [["background", css]] in the
//                   direct-edit `Decl` shape, for morph / part styles
// ============================================================================

import { createRoot, type Root } from "react-dom/client";
import { GradientControl, type GradientControlProps } from "./GradientControl";
import { cleanGradient, type GradientSpec } from "../spec";
import { gradientCss, baseColor } from "../css";

export interface GradientFieldOptions {
  label?: string;
  shaders?: boolean;
  clearable?: boolean;
}

/** A Puck custom field. Use as `fields: { background: gradientField({ label: "Background" }) }`. */
export function gradientField(opts: GradientFieldOptions = {}) {
  return {
    type: "custom" as const,
    label: opts.label ?? "Gradient",
    render: ({ value, onChange }: { value: unknown; onChange: (v: GradientSpec | undefined) => void }) => (
      <GradientControl value={value} onChange={onChange} shaders={opts.shaders} clearable={opts.clearable} label={opts.label} />
    ),
  };
}

export interface MountedControl {
  update(value: unknown): void;
  destroy(): void;
}

/** Mount the control into a plain DOM host (the direct editor's panel). */
export function mountGradientControl(host: HTMLElement, props: Omit<GradientControlProps, "value"> & { value: unknown }): MountedControl {
  const root: Root = createRoot(host);
  let current = props.value;
  const render = () => root.render(<GradientControl {...props} value={current} onChange={(v) => { current = v; props.onChange(v); render(); }} />);
  render();
  return {
    update(v) { current = v; render(); },
    destroy() { root.unmount(); },
  };
}

/** CSS declarations for a spec, in direct-edit's `Decl` ([property, value]) shape. Empty when invalid. */
export function gradientDecls(value: unknown): Array<[string, string]> {
  const spec = cleanGradient(value);
  if (!spec) return [];
  return [["background-color", baseColor(spec)], ["background", gradientCss(spec)]];
}
