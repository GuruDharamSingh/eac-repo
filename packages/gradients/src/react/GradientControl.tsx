"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import {
  cleanGradient, DEFAULT_GRADIENT, KINDS, PRESETS, SPACES, stopsFrom,
  type GradientKind, type GradientSpec, type GradientStop,
} from "../spec";
import { gradientCss } from "../css";
import { generate, harmony, HARMONIES, type Harmony } from "../generate";
import { BON_MINERAL, ELEMENTAL, LOGO_INK } from "../palettes";
import { GradientBackground } from "./GradientBackground";
import { StopBar } from "./StopBar";
import { OWN_SHADERS } from "../spec";
import { PAPER_SHADERS } from "../paper";

const SHADER_LABEL: Record<string, string> = {
  mineral: "Mineral (pigment wash)", aurora: "Aurora", halo: "Halo rings", silk: "Silk",
  "mesh-flow": "Mesh flow", "grain-wave": "Grain wave", "grain-sphere": "Grain sphere", "grain-ripple": "Grain ripple",
  warp: "Warp", swirl: "Swirl", "smoke-ring": "Smoke ring",
};

// ============================================================================
// The gradient control: one panel of sliders for any gradient prop.
//
// Built for a ~280px editor sidebar (Puck's fields column, the direct editor's
// panel). Colours follow Puck's CSS variables with fallbacks, so it looks at
// home in Puck and stays legible elsewhere. The value is whatever is stored;
// every change goes through cleanGradient, so what is written back is clean.
// ============================================================================

export interface GradientControlProps {
  value: GradientSpec | unknown;
  onChange: (next: GradientSpec | undefined) => void;
  /**
   * Shader choices: true = all; "own" = only the Elkdonis shaders (they draw synchronously per
   * frame, so frame-by-frame video renders can use them; Paper loads lazily); false = none.
   */
  shaders?: boolean | "own";
  /** Offer "No gradient". */
  clearable?: boolean;
  label?: string;
}

const ink = "var(--puck-color-grey-02, #2b2b2b)";
const faint = "var(--puck-color-grey-05, #6b6b6b)";
const line = "var(--puck-color-grey-09, #d4d4d4)";
const paper = "var(--puck-color-white, #fff)";
const accent = "var(--puck-color-azure-04, #2f6fde)";

const box: CSSProperties = { width: "100%", padding: "4px 6px", font: "inherit", fontSize: 12, border: `1px solid ${line}`, borderRadius: 4, background: paper, color: ink, minWidth: 0 };
const btn: CSSProperties = { ...box, width: "auto", cursor: "pointer", padding: "4px 8px" };

const USES: Record<string, GradientKind[]> = {
  angle: ["linear", "conic", "bands"],
  center: ["radial", "conic", "halo", "mesh"],
  count: ["mesh", "halo"],
  seed: ["mesh"],
  steps: ["bands"],
  scale: ["mesh", "halo"],
};
const uses = (k: string, kind: GradientKind) => USES[k]?.includes(kind) ?? true;

export function GradientControl({ value, onChange, shaders = true, clearable = true, label }: GradientControlProps) {
  const spec = cleanGradient(value);
  const [open, setOpen] = useState<Record<string, boolean>>({ stops: true, shape: true });
  const [harmonyBase, setHarmonyBase] = useState("#2CA6A4");
  const [harmonyKind, setHarmonyKind] = useState<Harmony>("analogous");
  const [copied, setCopied] = useState(false);

  if (!spec) {
    return (
      <div style={{ display: "grid", gap: 8 }}>
        {label && <Label>{label}</Label>}
        <button type="button" style={btn} onClick={() => onChange(DEFAULT_GRADIENT)}>Add a gradient</button>
        <PresetRow onPick={(s) => onChange(s)} />
      </div>
    );
  }

  const set = (patch: Partial<GradientSpec>) => {
    const next = cleanGradient({ ...spec, ...patch });
    if (next) onChange(next);
  };
  const setStops = (stops: GradientStop[]) => set({ stops });
  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));
  const css = gradientCss(spec);

  return (
    <div style={{ display: "grid", gap: 10, color: ink, fontSize: 12 }}>
      {label && <Label>{label}</Label>}
      {/* CSS-only swatch: the block itself shows the shader; one WebGL context per panel would hit the browser's cap */}
      <GradientBackground value={{ ...spec, shader: "none", paper: 0 }} style={{ height: 84, borderRadius: 6, border: `1px solid ${line}`, overflow: "hidden" }} />
      {(spec.shader !== "none" || spec.paper > 0) && <div style={{ color: faint, fontSize: 11, marginTop: -4 }}>Shows the CSS fallback; {spec.shader !== "none" ? `the ${SHADER_LABEL[spec.shader] ?? spec.shader} shader` : "the paper surface"} draws on the block.</div>}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button type="button" style={btn} onClick={() => set({ ...generate(Math.floor(Math.random() * 9999)), shader: spec.shader })} title="A new gradient from the logo ink">Surprise</button>
        <button type="button" style={btn} onClick={() => setStops([...spec.stops].reverse().map((s) => ({ ...s, at: 100 - s.at })))}>Reverse</button>
        <button
          type="button"
          style={btn}
          onClick={() => {
            try { navigator.clipboard.writeText(`background: ${css};`).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1200); }); } catch { /* clipboard refused */ }
          }}
        >{copied ? "Copied" : "Copy CSS"}</button>
        {clearable && <button type="button" style={{ ...btn, color: faint }} onClick={() => onChange(undefined)}>Remove</button>}
      </div>

      <Section title="Presets" open={!!open.presets} onToggle={() => toggle("presets")}>
        <PresetRow onPick={(s) => onChange(s)} />
      </Section>

      <Section title="Kind" open onToggle={() => {}} fixed>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
          {KINDS.map((k) => (
            <button key={k} type="button" aria-pressed={spec.kind === k} onClick={() => set({ kind: k, ...(k === "halo" || k === "mesh" ? { base: spec.base ?? "#0B0B0D" } : null) })}
              style={{ ...btn, width: "100%", textTransform: "capitalize", ...(spec.kind === k ? { borderColor: accent, color: accent, fontWeight: 600 } : null) }}>{k}</button>
          ))}
        </div>
      </Section>

      <Section title={`Colours (${spec.stops.length})`} open={!!open.stops} onToggle={() => toggle("stops")}>
        <div style={{ display: "grid", gap: 6 }}>
          <StopBar spec={spec} onStops={setStops} />
          {spec.stops.map((s, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "28px 66px 1fr 22px", gap: 6, alignItems: "center" }}>
              <input type="color" aria-label={`Colour ${i + 1}`} value={s.color.toLowerCase()} onChange={(e) => setStops(spec.stops.map((x, j) => (j === i ? { ...x, color: e.target.value } : x)))}
                style={{ width: 28, height: 24, padding: 0, border: `1px solid ${line}`, borderRadius: 4, background: paper }} />
              <input style={{ ...box, fontFamily: "ui-monospace, monospace" }} aria-label={`Hex ${i + 1}`} defaultValue={s.color} key={s.color}
                onBlur={(e) => setStops(spec.stops.map((x, j) => (j === i ? { ...x, color: e.target.value } : x)))} />
              <input type="range" min={0} max={100} value={s.at} aria-label={`Position ${i + 1}`} onChange={(e) => setStops(spec.stops.map((x, j) => (j === i ? { ...x, at: +e.target.value } : x)))} />
              <button type="button" aria-label={`Remove colour ${i + 1}`} disabled={spec.stops.length <= 2} onClick={() => setStops(spec.stops.filter((_, j) => j !== i))}
                style={{ ...btn, padding: "2px 0", width: 22, opacity: spec.stops.length <= 2 ? 0.4 : 1 }}>×</button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button type="button" style={btn} disabled={spec.stops.length >= 8}
              onClick={() => { const last = spec.stops[spec.stops.length - 1]; setStops([...spec.stops.map((x) => ({ ...x, at: Math.round(x.at * 0.85) })), { color: last.color, at: 100 }]); }}>Add colour</button>
            <button type="button" style={btn} onClick={() => setStops(stopsFrom(spec.stops.map((x) => x.color)))}>Space evenly</button>
          </div>
          <Swatches onPick={(hex) => spec.stops.length < 8 && setStops(stopsFrom([...spec.stops.map((x) => x.color), hex]))} />
        </div>
      </Section>

      <Section title="Generate" open={!!open.generate} onToggle={() => toggle("generate")}>
        <div style={{ display: "grid", gap: 6 }}>
          <Row label="Harmony">
            <div style={{ display: "grid", gridTemplateColumns: "28px 1fr auto", gap: 6 }}>
              <input type="color" aria-label="Harmony base colour" value={harmonyBase.toLowerCase()} onChange={(e) => setHarmonyBase(e.target.value)} style={{ width: 28, height: 24, padding: 0, border: `1px solid ${line}` }} />
              <select style={box} value={harmonyKind} aria-label="Harmony" onChange={(e) => setHarmonyKind(e.target.value as Harmony)}>
                {HARMONIES.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
              <button type="button" style={btn} onClick={() => setStops(stopsFrom(harmony(harmonyBase, harmonyKind)))}>Use</button>
            </div>
          </Row>
          <Row label="From">
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              <button type="button" style={btn} onClick={() => set({ ...generate(spec.seed + 1), kind: spec.kind, shader: spec.shader })}>Logo ink</button>
              <button type="button" style={btn} onClick={() => set({ ...generate(spec.seed + 1, { pigments: ELEMENTAL.slice(0, 7).map((p) => p.hex) }), kind: spec.kind, shader: spec.shader })}>Elements</button>
              <button type="button" style={btn} onClick={() => set({ ...generate(spec.seed + 1, { pigments: BON_MINERAL.flatMap((c) => [c.ground, c.light, c.mark]) }), kind: spec.kind, shader: spec.shader })}>Bon mineral</button>
            </div>
          </Row>
        </div>
      </Section>

      <Section title="Shape" open={!!open.shape} onToggle={() => toggle("shape")}>
        <div style={{ display: "grid", gap: 6 }}>
          {uses("angle", spec.kind) && <Slider label="Angle" unit="°" min={0} max={359} value={spec.angle} onChange={(angle) => set({ angle })} />}
          {uses("center", spec.kind) && <Slider label="Centre x" unit="%" min={0} max={100} value={spec.cx} onChange={(cx) => set({ cx })} />}
          {uses("center", spec.kind) && <Slider label="Centre y" unit="%" min={0} max={100} value={spec.cy} onChange={(cy) => set({ cy })} />}
          {uses("count", spec.kind) && <Slider label={spec.kind === "halo" ? "Rings" : "Blobs"} min={spec.kind === "halo" ? 1 : 2} max={spec.kind === "halo" ? 8 : 7} value={spec.count} onChange={(count) => set({ count })} />}
          {uses("scale", spec.kind) && <Slider label="Scale" min={0} max={100} value={spec.scale} onChange={(scale) => set({ scale })} />}
          {uses("seed", spec.kind) && <Slider label="Seed" min={0} max={200} value={Math.min(200, spec.seed)} onChange={(seed) => set({ seed })} />}
          {(uses("steps", spec.kind) || spec.ease === "steps") && <Slider label="Bands" min={2} max={24} value={spec.steps} onChange={(steps) => set({ steps })} />}
          <Slider label="Softness" min={0} max={100} value={spec.softness} onChange={(softness) => set({ softness })} />
          {(spec.kind === "mesh" || spec.kind === "halo") && (
            <Row label="Base">
              <input type="color" aria-label="Base colour" value={(spec.base ?? "#0B0B0D").toLowerCase()} onChange={(e) => set({ base: e.target.value })} style={{ width: 28, height: 24, padding: 0, border: `1px solid ${line}` }} />
            </Row>
          )}
        </div>
      </Section>

      <Section title="Colour feel" open={!!open.feel} onToggle={() => toggle("feel")}>
        <div style={{ display: "grid", gap: 6 }}>
          <Slider label="Mute" min={0} max={100} value={spec.mute} onChange={(mute) => set({ mute })} hint="Take chroma out, like mineral pigment" />
          <Slider label="Light" min={-50} max={50} value={spec.light} onChange={(light) => set({ light })} />
          <Slider label="Grain" min={0} max={100} value={spec.grain} onChange={(grain) => set({ grain })} />
          <Row label="Blend in">
            <select style={box} value={spec.space} aria-label="Interpolation space" onChange={(e) => set({ space: e.target.value as GradientSpec["space"] })}>
              {SPACES.map((s) => <option key={s} value={s}>{s === "oklch" ? "OKLCH (hue wheel)" : s === "oklab" ? "OKLab (even)" : "sRGB (classic)"}</option>)}
            </select>
          </Row>
          {spec.space === "oklch" && (
            <Row label="Hue path">
              <select style={box} value={spec.hue} aria-label="Hue path" onChange={(e) => set({ hue: e.target.value as GradientSpec["hue"] })}>
                <option value="shorter">Shorter way round</option>
                <option value="longer">Longer way (rainbow)</option>
              </select>
            </Row>
          )}
          <Row label="Easing">
            <select style={box} value={spec.ease} aria-label="Easing" onChange={(e) => set({ ease: e.target.value as GradientSpec["ease"] })}>
              <option value="smooth">Smooth</option><option value="linear">Linear</option><option value="in">Ease in</option><option value="out">Ease out</option><option value="steps">Hard bands</option>
            </select>
          </Row>
        </div>
      </Section>

      {shaders && (
        <Section title="Shader (WebGL)" open={!!open.shader} onToggle={() => toggle("shader")}>
          <div style={{ display: "grid", gap: 6 }}>
            <Row label="Layer">
              <select style={box} value={spec.shader} aria-label="Shader" onChange={(e) => set({ shader: e.target.value as GradientSpec["shader"] })}>
                <option value="none">None (CSS only)</option>
                <optgroup label="Elkdonis">
                  {OWN_SHADERS.map((s) => <option key={s} value={s}>{SHADER_LABEL[s]}</option>)}
                </optgroup>
                {shaders !== "own" && (
                  <optgroup label="Paper Shaders">
                    {PAPER_SHADERS.map((s) => <option key={s} value={s}>{SHADER_LABEL[s]}</option>)}
                  </optgroup>
                )}
              </select>
            </Row>
            {spec.shader !== "none" && <Slider label="Motion" min={0} max={100} value={spec.motion} onChange={(motion) => set({ motion })} hint="0 = still. Reduced-motion visitors always see it still." />}
            {shaders !== "own" && <Slider label="Paper" min={0} max={100} value={spec.paper} onChange={(paper) => set({ paper })} hint="Fibre, folds and crumples over the gradient (Paper Shaders)" />}
          </div>
        </Section>
      )}
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 13, fontWeight: 600, color: ink }}>{children}</div>;
}

function Section({ title, open, onToggle, children, fixed }: { title: string; open: boolean; onToggle: () => void; children: ReactNode; fixed?: boolean }) {
  return (
    <div style={{ borderTop: `1px solid ${line}`, paddingTop: 8, display: "grid", gap: 8 }}>
      {fixed ? (
        <div style={{ fontWeight: 600, fontSize: 12 }}>{title}</div>
      ) : (
        <button type="button" aria-expanded={open} onClick={onToggle} style={{ all: "unset", cursor: "pointer", fontWeight: 600, fontSize: 12, display: "flex", justifyContent: "space-between" }}>
          <span>{title}</span><span aria-hidden="true" style={{ color: faint }}>{open ? "−" : "+"}</span>
        </button>
      )}
      {open && children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: "grid", gridTemplateColumns: "64px 1fr", alignItems: "center", gap: 8 }}>
      <span style={{ color: faint }}>{label}</span>
      <span style={{ minWidth: 0 }}>{children}</span>
    </label>
  );
}

function Slider({ label, value, min, max, unit = "", onChange, hint }: { label: string; value: number; min: number; max: number; unit?: string; onChange: (n: number) => void; hint?: string }) {
  return (
    <label style={{ display: "grid", gridTemplateColumns: "64px 1fr 38px", alignItems: "center", gap: 8 }} title={hint}>
      <span style={{ color: faint }}>{label}</span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(+e.target.value)} style={{ minWidth: 0 }} />
      <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{value}{unit}</span>
    </label>
  );
}

function PresetRow({ onPick }: { onPick: (s: GradientSpec) => void }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(76px, 1fr))", gap: 6 }}>
      {PRESETS.map((p) => (
        <button key={p.id} type="button" onClick={() => onPick(p.spec)} title={p.label}
          style={{ all: "unset", cursor: "pointer", display: "grid", gap: 3, fontSize: 11, color: ink }}>
          <span style={{ height: 34, borderRadius: 4, border: `1px solid ${line}`, background: gradientCss(p.spec) }} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.label}</span>
        </button>
      ))}
    </div>
  );
}

function Swatches({ onPick }: { onPick: (hex: string) => void }) {
  const groups: Array<[string, string[]]> = [
    ["Elements", ELEMENTAL.map((p) => p.hex)],
    ["Logo ink", LOGO_INK.map((p) => p.hex)],
    ["Bon mineral", BON_MINERAL.flatMap((c) => [c.ground, c.light, c.mark])],
  ];
  return (
    <div style={{ display: "grid", gap: 4 }}>
      {groups.map(([name, hexes]) => (
        <div key={name} style={{ display: "grid", gap: 3 }}>
          <span style={{ color: faint, fontSize: 11 }}>{name}</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
            {hexes.map((h, i) => (
              <button key={h + i} type="button" aria-label={`Add ${h}`} title={h} onClick={() => onPick(h)}
                style={{ width: 18, height: 18, borderRadius: 3, border: `1px solid ${line}`, background: h, cursor: "pointer", padding: 0 }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
