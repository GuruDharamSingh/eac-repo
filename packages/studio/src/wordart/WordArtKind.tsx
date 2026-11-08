"use client";

import * as React from "react";
import { GradientBackground, GradientControl } from "@elkdonis/gradients/react";
import { PRESETS, type GradientSpec } from "@elkdonis/gradients";
import { StudioColumns, StudioTopActions, StudioTopStatus, useNewRequest, useStudioFrame } from "../frame";
import { imageMark, markMaskUrl, parseFont, seedMark, svgMark, textMark, type Font, type Mark, type SeedMark } from "./mark";
import { FRAMES, STARTERS, loadDocs, saveDocs, type Frame, type MarkSource, type WordArtDoc } from "./doc";
import { download, layout, renderPng2D, thumb2D } from "./render2d";
import type { Preview3DHandle } from "./Preview3D";

// ============================================================================
// Word art (2026-11-07): a mark (the EAC logo cut-outs, text in a chosen
// font, or an uploaded SVG/PNG logo) filled with a gradient from the gradient
// lab, on a gradient background, in 2D or extruded in 3D; exported as PNG.
//
// Storage: designs are kept in this browser (localStorage) for now, like a
// sketchbook; PNG export is the deliverable. A server table can replace
// loadDocs/saveDocs without touching the editor.
// ============================================================================

export interface WordArtFont {
  id: string;
  label: string;
  /** TTF / OTF / WOFF (opentype.js doesn't read WOFF2). */
  url: string;
  /** Licence or use note, shown under the font picker. */
  note?: string;
}

export interface WordArtKindProps {
  fonts: WordArtFont[];
}

const Preview3DLazy = React.lazy(() => import("./Preview3D").then((m) => ({ default: m.Preview3D })));

let marksPromise: Promise<SeedMark[]> | null = null;
const loadMarks = () => (marksPromise ??= import("./marks.data").then((m) => m.EAC_MARKS));
const fontCache = new Map<string, Promise<Font>>();

const GROUP_LABEL: Record<string, string> = { monogram: "Monogram (E A C)", wordmark: "Wordmark", rings: "Rings", crescents: "Crescents" };

export function WordArtKind({ fonts }: WordArtKindProps) {
  const frame = useStudioFrame();
  const [docs, setDocs] = React.useState<WordArtDoc[]>([]);
  const [doc, setDoc] = React.useState<WordArtDoc>(() => STARTERS[0].make());
  const [mark, setMark] = React.useState<Mark | null>(null);
  const [seeds, setSeeds] = React.useState<SeedMark[]>([]);
  const [status, setStatus] = React.useState("");
  const [tab, setTab] = React.useState<"fill" | "background">("fill");
  const [busy, setBusy] = React.useState(false);
  const [uploadedFonts, setUploadedFonts] = React.useState<WordArtFont[]>([]);
  const three = React.useRef<Preview3DHandle>(null);
  const allFonts = React.useMemo(() => [...fonts, ...uploadedFonts], [fonts, uploadedFonts]);

  React.useEffect(() => { setDocs(loadDocs()); void loadMarks().then(setSeeds); }, []);

  // New ▾ > Word art: a fresh design (the EAC classic starter, unsaved)
  useNewRequest(() => {
    const d = STARTERS[0].make();
    setDoc({ ...d, name: "Untitled design" });
    setTab("fill");
    setStatus("New design");
    setTimeout(() => setStatus(""), 2000);
  });

  const update = (patch: Partial<WordArtDoc>) => setDoc((d) => ({ ...d, ...patch, updatedAt: Date.now() }));
  const setSource = (source: MarkSource) => update({ source });

  // ── resolve the mark from its source ──────────────────────────────────────
  React.useEffect(() => {
    let live = true;
    const s = doc.source;
    const done = (m: Mark | null, err?: string) => { if (live) { setMark(m); frame.setError(err ?? null); } };
    (async () => {
      try {
        if (s.kind === "eac") {
          const seed = (await loadMarks()).find((m) => m.id === s.id);
          done(seed ? seedMark(seed, s.groups) : null, seed ? undefined : "That EAC mark isn't available.");
        } else if (s.kind === "text") {
          const f = allFonts.find((x) => x.id === s.font) ?? allFonts[0];
          if (!f) return done(null, "No fonts are set up for word art.");
          if (!fontCache.has(f.url)) fontCache.set(f.url, fetch(f.url).then((r) => { if (!r.ok) throw new Error(`Font ${f.label} didn't load (${r.status}).`); return r.arrayBuffer(); }).then(parseFont));
          const font = await fontCache.get(f.url)!;
          done(textMark(font, s));
        } else if (s.kind === "svg") {
          const m = svgMark(s.svg, s.name);
          done(m, m.notes?.join(" ") || undefined);
        } else {
          done(await imageMark(s.src, s.name));
        }
      } catch (e) {
        done(null, e instanceof Error ? e.message : "That mark couldn't be read.");
      }
    })();
    return () => { live = false; };
  }, [doc.source, allFonts]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── save to this browser ──────────────────────────────────────────────────
  async function save() {
    if (!mark) return;
    setBusy(true);
    const thumb = await thumb2D(doc, mark).catch(() => undefined);
    const next = { ...doc, thumb, updatedAt: Date.now() };
    const list = [next, ...docs.filter((d) => d.id !== doc.id)];
    const err = saveDocs(list);
    setBusy(false);
    if (err) return frame.setError(err);
    setDocs(list);
    setDoc(next);
    setStatus("Saved in this browser");
    setTimeout(() => setStatus(""), 2500);
  }
  function remove(id: string) {
    const list = docs.filter((d) => d.id !== id);
    saveDocs(list);
    setDocs(list);
  }

  async function exportPng() {
    if (!mark) return;
    const [W, H] = FRAMES[doc.frame];
    setBusy(true);
    try {
      const blob = doc.view === "3d" && three.current ? await three.current.exportPng(W, H) : await renderPng2D(doc, mark, W, H);
      download(blob, `${(doc.name || "word-art").replace(/[^\w-]+/g, "-").toLowerCase()}-${doc.view}-${W}x${H}.png`);
    } catch (e) {
      frame.setError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  }

  // ── uploads ───────────────────────────────────────────────────────────────
  async function onLogo(file: File) {
    if (file.size > 4_000_000) return frame.setError("That file is over 4 MB; use a smaller logo.");
    if (/svg/.test(file.type) || /\.svg$/i.test(file.name)) {
      setSource({ kind: "svg", name: file.name, svg: await file.text() });
    } else if (/^image\/(png|jpeg|webp)$/.test(file.type)) {
      const src = await new Promise<string>((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.readAsDataURL(file); });
      setSource({ kind: "image", name: file.name, src });
    } else frame.setError("Upload an SVG (best: it can go 3D) or a PNG, JPG or WebP logo.");
    update({ name: file.name.replace(/\.\w+$/, "") });
  }
  async function onFont(file: File) {
    if (/\.woff2$/i.test(file.name)) return frame.setError("WOFF2 fonts can't be read here; use the TTF, OTF or WOFF.");
    const url = URL.createObjectURL(file);
    const f: WordArtFont = { id: `upload:${file.name}`, label: `${file.name} (this session)`, url, note: "Uploaded for this session; it isn't saved with the design." };
    setUploadedFonts((u) => [...u.filter((x) => x.id !== f.id), f]);
    if (doc.source.kind === "text") setSource({ ...doc.source, font: f.id });
  }

  const [W, H] = FRAMES[doc.frame];
  const s = doc.source;
  const seed = s.kind === "eac" ? seeds.find((m) => m.id === s.id) : undefined;
  const font = s.kind === "text" ? allFonts.find((f) => f.id === s.font) : undefined;

  const drawer = (
    <>
      <div className="studio-panel__h">Start from</div>
      <div className="wa-starters">
        {STARTERS.map((st) => (
          <button key={st.label} type="button" className="studio-btn" onClick={() => { const d = st.make(); setDoc(d); }}>{st.label}</button>
        ))}
      </div>
      <div className="studio-panel__h">Saved in this browser</div>
      {docs.length === 0 && <p className="studio-hint">Designs you save appear here. Download the PNG to keep one anywhere else.</p>}
      <div className="studio-list">
        {docs.map((d) => (
          <div key={d.id} className="wa-saved">
            <button type="button" className="studio-row" aria-current={d.id === doc.id} onClick={() => setDoc(d)}>
              <span className="wa-saved__row">
                {d.thumb ? <img src={d.thumb} alt="" className="wa-saved__thumb" /> : <span className="wa-saved__thumb" />}
                <span style={{ minWidth: 0 }}>
                  <span className="studio-row__t">{d.name || "Untitled"}</span>
                  <span className="studio-row__m">{d.view.toUpperCase()} · {d.frame}</span>
                </span>
              </span>
            </button>
            <button type="button" className="studio-btn studio-btn--ghost studio-btn--icon" aria-label={`Delete ${d.name}`} onClick={() => remove(d.id)}>×</button>
          </div>
        ))}
      </div>
    </>
  );

  const main = (
    <div className="wa-main">
      <div className="wa-toolbar">
        <div className="studio-lib__tabs" role="group" aria-label="View">
          <button type="button" aria-pressed={doc.view === "2d"} onClick={() => update({ view: "2d" })}>2D</button>
          <button type="button" aria-pressed={doc.view === "3d"} onClick={() => update({ view: "3d" })}>3D</button>
        </div>
        <div className="studio-lib__tabs" role="group" aria-label="Frame">
          {(Object.keys(FRAMES) as Frame[]).map((f) => (
            <button key={f} type="button" aria-pressed={doc.frame === f} onClick={() => update({ frame: f })}>{f}</button>
          ))}
        </div>
        {doc.view === "3d" && <button type="button" className="studio-btn studio-btn--ghost" onClick={() => three.current?.resetView()}>Reset view</button>}
      </div>
      {doc.view === "2d" ? (
        <Preview2D doc={doc} mark={mark} />
      ) : (
        <React.Suspense fallback={<div className="wa-stage" style={{ aspectRatio: `${W} / ${H}` }} />}>
          <Preview3DLazy ref={three} doc={doc} mark={mark} />
        </React.Suspense>
      )}
      <p className="studio-hint">
        {doc.view === "3d" ? "Drag to turn it, scroll to zoom. " : ""}
        {doc.fill.shader !== "none" || doc.background?.shader !== "none" ? "Shaders animate in the 2D preview; PNG export and 3D use their painted gradient." : ""}
      </p>
    </div>
  );

  const settings = (
    <div className="wa-settings">
      <label className="studio-field">
        <span>Name</span>
        <input className="studio-field__text" value={doc.name} onChange={(e) => update({ name: e.target.value })} />
      </label>

      <div className="studio-panel__h">Mark</div>
      <div className="studio-lib__tabs" role="group" aria-label="Mark source">
        <button type="button" aria-pressed={s.kind === "eac"} onClick={() => s.kind !== "eac" && setSource({ kind: "eac", id: "eac-classic", groups: [] })}>EAC logo</button>
        <button type="button" aria-pressed={s.kind === "text"} onClick={() => s.kind !== "text" && setSource({ kind: "text", text: "ELKDONIS", font: allFonts[0]?.id ?? "", tracking: 20, leading: 1.05, align: "center" })}>Text</button>
        <button type="button" aria-pressed={s.kind === "svg" || s.kind === "image"} onClick={() => document.getElementById("wa-logo-file")?.click()}>Upload</button>
      </div>
      <input id="wa-logo-file" type="file" accept=".svg,image/svg+xml,image/png,image/jpeg,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void onLogo(f); e.target.value = ""; }} />

      {s.kind === "eac" && (
        <>
          <label className="studio-field">
            <span>Logo</span>
            <select value={s.id} onChange={(e) => setSource({ kind: "eac", id: e.target.value, groups: [] })}>
              {seeds.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </label>
          {seed && <p className="studio-hint">{seed.note}. Cut-outs traced from the EAC logo files (Oct 2026).</p>}
          {seed && (
            <fieldset className="wa-parts">
              <legend className="studio-hint">Parts</legend>
              {seed.groups.map((g) => {
                const on = s.groups.length === 0 || s.groups.includes(g);
                return (
                  <label key={g} className="wa-check">
                    <input type="checkbox" checked={on} onChange={() => {
                      const cur = s.groups.length ? s.groups : seed.groups;
                      const next = on ? cur.filter((x) => x !== g) : [...cur, g];
                      if (next.length) setSource({ ...s, groups: next.length === seed.groups.length ? [] : next });
                    }} />
                    {GROUP_LABEL[g] ?? g}
                  </label>
                );
              })}
            </fieldset>
          )}
        </>
      )}

      {s.kind === "text" && (
        <>
          <label className="studio-field">
            <span>Text</span>
            <textarea className="studio-field__text" rows={2} value={s.text} onChange={(e) => setSource({ ...s, text: e.target.value })} />
          </label>
          <label className="studio-field">
            <span>Font</span>
            <select value={font?.id ?? ""} onChange={(e) => setSource({ ...s, font: e.target.value })}>
              {allFonts.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </label>
          {font?.note && <p className="studio-hint">{font.note}</p>}
          <button type="button" className="studio-btn" onClick={() => document.getElementById("wa-font-file")?.click()}>Upload a font (TTF, OTF, WOFF)</button>
          <input id="wa-font-file" type="file" accept=".ttf,.otf,.woff" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFont(f); e.target.value = ""; }} />
          <Range label="Letter spacing" min={-100} max={400} value={s.tracking} onChange={(tracking) => setSource({ ...s, tracking })} />
          <Range label="Line height" min={60} max={200} value={Math.round(s.leading * 100)} onChange={(v) => setSource({ ...s, leading: v / 100 })} />
          <div className="studio-lib__tabs" role="group" aria-label="Align">
            {(["left", "center", "right"] as const).map((a) => <button key={a} type="button" aria-pressed={s.align === a} onClick={() => setSource({ ...s, align: a })}>{a}</button>)}
          </div>
        </>
      )}

      {(s.kind === "svg" || s.kind === "image") && (
        <p className="studio-hint">
          {s.name}. {s.kind === "svg" ? "SVG outlines extrude in 3D." : "A picture logo is flat in 3D; upload it as SVG to extrude it."}{" "}
          <button type="button" className="wa-link" onClick={() => document.getElementById("wa-logo-file")?.click()}>Replace</button>
        </p>
      )}

      <div className="studio-panel__h">Gradient</div>
      <div className="studio-lib__tabs" role="group" aria-label="Which gradient">
        <button type="button" aria-pressed={tab === "fill"} onClick={() => setTab("fill")}>Mark fill</button>
        <button type="button" aria-pressed={tab === "background"} onClick={() => setTab("background")}>Background</button>
      </div>
      {tab === "fill" ? (
        <GradientControl value={doc.fill} clearable={false} onChange={(g) => g && update({ fill: g })} />
      ) : (
        <>
          <label className="wa-check">
            <input type="checkbox" checked={!doc.background} onChange={(e) => update({ background: e.target.checked ? null : PRESETS.find((p) => p.id === "ring")!.spec })} />
            Transparent background (PNG with alpha)
          </label>
          {doc.background && <GradientControl value={doc.background} clearable={false} onChange={(g) => g && update({ background: g as GradientSpec })} />}
        </>
      )}

      <div className="studio-panel__h">Layout</div>
      <Range label="Size" min={10} max={100} value={doc.size} onChange={(size) => update({ size })} />
      {doc.view === "2d" && <Range label="Shadow" min={0} max={100} value={doc.shadow} onChange={(shadow) => update({ shadow })} />}

      {doc.view === "3d" && (
        <>
          <div className="studio-panel__h">3D</div>
          <Range label="Depth" min={0} max={100} value={doc.depth} onChange={(depth) => update({ depth })} />
          <Range label="Bevel" min={0} max={100} value={doc.bevel} onChange={(bevel) => update({ bevel })} />
          <label className="studio-field">
            <span>Sides</span>
            <select value={doc.sides} onChange={(e) => update({ sides: e.target.value as WordArtDoc["sides"] })}>
              <option value="ink">Ink black</option>
              <option value="gradient">The gradient</option>
              <option value="colour">A colour</option>
            </select>
          </label>
          {doc.sides === "colour" && <input type="color" aria-label="Side colour" value={doc.sideColor} onChange={(e) => update({ sideColor: e.target.value })} />}
          <Range label="Metal" min={0} max={100} value={doc.metal} onChange={(metal) => update({ metal })} />
          <Range label="Roughness" min={0} max={100} value={doc.rough} onChange={(rough) => update({ rough })} />
          <Range label="Tilt" min={-60} max={60} value={doc.tilt} onChange={(tilt) => update({ tilt })} />
          <Range label="Spin" min={0} max={100} value={doc.spin} onChange={(spin) => update({ spin })} />
        </>
      )}
    </div>
  );

  return (
    <>
      <StudioTopActions>
        <button type="button" className="studio-btn" disabled={!mark || busy} onClick={() => void save()}>Save</button>
        <button type="button" className="studio-btn studio-btn--primary" disabled={!mark || busy} onClick={() => void exportPng()}>Download PNG</button>
      </StudioTopActions>
      <StudioTopStatus>{busy ? "Working…" : status}</StudioTopStatus>
      <StudioColumns drawer={drawer} main={main} settings={settings} wideSettings />
    </>
  );
}

function Range({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <label className="wa-range">
      <span>{label}</span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(+e.target.value)} />
      <span className="wa-range__v">{value}</span>
    </label>
  );
}

/** The 2D preview: the same layers as the export (background, fill cut to the mark, shadow), live. */
function Preview2D({ doc, mark }: { doc: WordArtDoc; mark: Mark | null }) {
  const [W, H] = FRAMES[doc.frame];
  const L = mark ? layout(doc, mark, W, H) : null;
  const mask = mark ? (mark.image ? `url("${mark.image.src}")` : markMaskUrl(mark)) : "none";
  const a = doc.shadow / 100;
  return (
    <div className={`wa-stage${doc.background ? "" : " wa-checker"}`} style={{ aspectRatio: `${W} / ${H}` }}>
      {doc.background && <GradientBackground value={doc.background} className="wa-layer" />}
      {mark && L && (
        <div
          className="wa-markwrap"
          style={{
            left: `${(L.x / W) * 100}%`, top: `${(L.y / H) * 100}%`, width: `${(L.w / W) * 100}%`, height: `${(L.h / H) * 100}%`,
            filter: a > 0 ? `drop-shadow(0 ${(2 + a * 14) / 10.8}cqmin ${(8 + a * 40) / 21.6}cqmin rgba(0,0,0,${0.25 + a * 0.5}))` : undefined,
          }}
        >
          <GradientBackground
            value={doc.fill}
            className="wa-layer"
            style={{ WebkitMaskImage: mask, maskImage: mask, WebkitMaskSize: "100% 100%", maskSize: "100% 100%", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat" }}
          />
        </div>
      )}
      {!mark && <p className="studio-hint wa-empty">Loading the mark…</p>}
    </div>
  );
}
