"use client";

import * as React from "react";
import { GradientBackground, GradientControl } from "@elkdonis/gradients/react";
import { cleanGradient, PRESETS, type GradientSpec } from "@elkdonis/gradients";
import { StudioColumns, StudioTopActions, StudioTopStatus, useNewRequest, useStudioFrame } from "../frame";
import { imageMark, markMaskUrl, parseFont, seedMark, svgMark, textMark, type Font, type Mark, type SeedMark } from "./mark";
import { FRAMES, STARTERS, stageStyle, loadDocs, loadDraft, saveDocs, saveDraft, type Frame, type MarkSource, type WordArtDoc } from "./doc";
import { composite2D, download, layout, markMask, renderCanvas2D, renderPng2D, thumb2D, type CompositeScratch } from "./render2d";
import { createCompositor, layerReady, layerSource, startTake, type Compositor, type LayerCache, type Take, type TakeResult } from "./capture";
import { renderLoop, renderSize, type RenderRes } from "./render";
import type { Preview3DHandle } from "./Preview3D";

/** What a stage gives the recorder: draw the live frame, full size, into a W×H context. */
export interface StageHandle { drawFrame(ctx: CanvasRenderingContext2D): boolean; ready(): boolean }
import { createPlayback, isRunning, usePlayback, type Playback } from "./playback";
import { MAX_TAKE_MS, timelineEnd, addLookKey, applyEdit, applyOverrides, diffTracks, docAt, shaderClock } from "./timeline";
import { Review } from "./Review";
import { clock as fmtClock, extFor } from "../capture/upload";
import { Strip } from "./Strip";

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
  /** Record mode's "Send to video editor": the signed-in recordings upload and the video editor's href. Absent hides it. */
  recording?: { uploadEndpoint: string; reelHref: string };
}

/** The doc fields the timeline owns: edits to these during a take are take-only overrides. */
const TRACK_FIELDS = new Set(["fill", "background", "size", "shadow", "depth", "bevel", "sides", "sideColor", "metal", "rough", "spin", "tilt"]);

const Preview3DLazy = React.lazy(() => import("./Preview3D").then((m) => ({ default: m.Preview3D })));

let marksPromise: Promise<SeedMark[]> | null = null;
const loadMarks = () => (marksPromise ??= import("./marks.data").then((m) => m.EAC_MARKS));
const fontCache = new Map<string, Promise<Font>>();

const GROUP_LABEL: Record<string, string> = { monogram: "Monogram (E A C)", wordmark: "Wordmark", rings: "Rings", crescents: "Crescents" };

export function WordArtKind({ fonts, recording }: WordArtKindProps) {
  const frame = useStudioFrame();
  const [docs, setDocs] = React.useState<WordArtDoc[]>([]);
  const [doc, setDoc] = React.useState<WordArtDoc>(() => STARTERS[0].make());
  const [mark, setMark] = React.useState<Mark | null>(null);
  const [seeds, setSeeds] = React.useState<SeedMark[]>([]);
  const [status, setStatus] = React.useState("");
  const [tab, setTab] = React.useState<"fill" | "background">("fill");
  const [busy, setBusy] = React.useState(false);
  const [uploadedFonts, setUploadedFonts] = React.useState<WordArtFont[]>([]);
  // record mode (2026-11-18): Export: Video opens the keyframe strip; PNG is the still editor
  const [mode, setMode] = React.useState<"png" | "video">("png");
  const playback = React.useMemo(createPlayback, []);
  // a take in progress, the settings dragged during it (take-only), and the clip to review after
  const takeRef = React.useRef<{ take: Take; comp: Compositor; name: string; view: WordArtDoc["view"]; frame: WordArtDoc["frame"] } | null>(null);
  const [takeOn, setTakeOn] = React.useState(false);
  const overridesRef = React.useRef<Record<string, unknown> | null>(null);
  const [overrides, setOverrides] = React.useState<Record<string, unknown> | null>(null);
  const [renderPct, setRenderPct] = React.useState<number | null>(null);
  const [reviewing, setReviewing] = React.useState<{ result: TakeResult; name: string; W: number; H: number; overrides: boolean; safe: boolean } | null>(null);
  const three = React.useRef<Preview3DHandle>(null);
  const two = React.useRef<StageHandle>(null);
  const markRef = React.useRef<Mark | null>(null);
  const allFonts = React.useMemo(() => [...fonts, ...uploadedFonts], [fonts, uploadedFonts]);

  // ── undo / redo (2026-11-18) ──────────────────────────────────────────────
  // Every change goes through commit(). Rapid changes to the same field (a slider drag, typing,
  // a run of gradient tweaks) fold into one step; switching designs (a starter, a saved design,
  // New) is a step too, so a stray click on "Start from" can be undone.
  const docRef = React.useRef(doc);
  docRef.current = doc;
  const past = React.useRef<WordArtDoc[]>([]);
  const future = React.useRef<WordArtDoc[]>([]);
  const lastStep = React.useRef({ at: 0, key: "" });
  const flash = (msg: string, ms = 2000) => { setStatus(msg); setTimeout(() => setStatus((s) => (s === msg ? "" : s)), ms); };

  const commit = (next: WordArtDoc, key = "") => {
    const cur = docRef.current;
    if (next === cur) return;
    const now = Date.now();
    const fold = key !== "" && key === lastStep.current.key && now - lastStep.current.at < 800;
    if (!fold) past.current = [...past.current.slice(-79), cur];
    future.current = [];
    lastStep.current = { at: now, key };
    docRef.current = next;
    setDoc(next);
  };
  /** Replace without an undo step (save writing the thumbnail back, restoring the draft). */
  const replace = (next: WordArtDoc) => { docRef.current = next; setDoc(next); };
  // the browser harness drives the editor through this (only when window.__waTest is set)
  React.useEffect(() => {
    const w = window as unknown as { __waTest?: boolean; __wa?: unknown; __waCompositeOnce?: unknown };
    if (!w.__waTest) return;
    (w as unknown as { __waRender?: unknown }).__waRender = (o: { ms: number; loop: boolean; res?: RenderRes; readyTimeout?: number }) => runRender(o);
    w.__wa = { doc: () => docRef.current, commit: (d: WordArtDoc) => commit(d), playback, tl: { addLookKey, applyEdit, docAt }, keys: (p: string) => docRef.current.timeline?.tracks[p]?.map((x) => x.t) ?? [] };
    w.__waCompositeOnce = async (withUrl?: boolean) => {
      const d = docRef.current, m = markRef.current;
      const [cw, ch] = FRAMES[d.frame];
      const stage = d.view === "3d" ? three.current : two.current;
      const c = createCompositor({ W: cw, H: ch, draw: (ctx) => !!stage?.drawFrame(ctx) });
      const ok = c.frame();
      const x = c.canvas.getContext("2d")!;
      const ev = docAt(d, playback.get().ms);
      const L = m ? layout(ev, m, cw, ch) : { x: 0, y: 0, w: 0, h: 0 };
      const px = (a: number, b: number) => Array.from(x.getImageData(Math.round(a), Math.round(b), 1, 1).data);
      const painted = m ? (await renderCanvas2D(ev, m, cw, ch)).getContext("2d")!.getImageData(0, 0, cw, ch).data : null;
      const live = x.getImageData(0, 0, cw, ch).data;
      let diff = 0;
      if (painted) for (let i = 0; i < live.length; i += 16) if (Math.abs(live[i] - painted[i]) + Math.abs(live[i + 1] - painted[i + 1]) + Math.abs(live[i + 2] - painted[i + 2]) > 24) diff++;
      return { url: withUrl ? c.canvas.toDataURL("image/png") : undefined, ok, w: c.canvas.width, h: c.canvas.height, inside: px(L.x + L.w / 2, L.y + L.h / 2)[3] > 0, outside: px(4, 4)[3] > 0, differs: diff / (live.length / 16) };
    };
  });
  const undo = () => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(docRef.current);
    lastStep.current = { at: 0, key: "" };
    replace(prev);
  };
  const redo = () => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(docRef.current);
    lastStep.current = { at: 0, key: "" };
    replace(next);
  };
  const undoRef = React.useRef({ undo, redo });
  undoRef.current = { undo, redo };

  // Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl+Y. Text boxes keep their own undo.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k !== "z" && k !== "y") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "TEXTAREA" || t.isContentEditable || (t.tagName === "INPUT" && /^(text|search|url|email|number|)$/.test((t as HTMLInputElement).type)))) return;
      e.preventDefault();
      if (k === "y" || e.shiftKey) undoRef.current.redo();
      else undoRef.current.undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── load: the saved list, the marks, and the design you were on ──────────
  const draftReady = React.useRef(false);
  React.useEffect(() => {
    setDocs(loadDocs());
    void loadMarks().then(setSeeds);
    const draft = loadDraft();
    if (draft) { replace(draft); flash("Picked up where you left off", 2500); }
    draftReady.current = true;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // keep the working draft (debounced; a refresh or closed tab no longer loses the design)
  React.useEffect(() => {
    if (!draftReady.current) return;
    const t = setTimeout(() => saveDraft(doc), 500);
    return () => clearTimeout(t);
  }, [doc]);

  // New ▾ > Word art: a fresh design (the EAC classic starter, unsaved)
  useNewRequest(() => {
    const d = STARTERS[0].make();
    commit({ ...d, name: "Untitled design" });
    setTab("fill");
    flash("New design (Ctrl+Z brings the last one back)", 3000);
  });

  // In record mode an edit lands at the playhead: a setting that moves gets a key there, a still
  // one changes for the whole timeline (timeline.ts applyEdit).
  const modeRef = React.useRef(mode);
  modeRef.current = mode;
  const update = (patch: Partial<WordArtDoc>) => {
    const key = Object.keys(patch).sort().join(",");
    const cur = docRef.current;
    // a still design (no keys) in PNG mode is today's editor; a design with keys is edited at the playhead
    if (modeRef.current !== "video" && !cur.timeline) return commit({ ...cur, ...patch, updatedAt: Date.now() }, key);
    const ms = playback.get().ms;
    // a render reads the design frame by frame: edits would write keys at whatever frame it's on
    if (playback.get().take === "rendering") return flash("Rendering… settings unlock when it's done (or Cancel).", 2500);
    // during a take a dragged setting overrides the timeline for the rest of the take; nothing is written
    if (takeRef.current && Object.keys(patch).every((k) => TRACK_FIELDS.has(k))) {
      const ev = applyOverrides(docAt(cur, ms), overridesRef.current);
      const o = { ...(overridesRef.current ?? {}), ...diffTracks(ev, { ...ev, ...patch }) };
      overridesRef.current = o;
      setOverrides(o);
      return;
    }
    commit(applyEdit(cur, { ...docAt(cur, ms), ...patch, updatedAt: Date.now() }, ms), key);
  };
  // the settings panel shows the design at the playhead, refreshed 4×/s while it plays
  const panelMs = usePlayback(playback, (st) => st.ms, 4);
  const shown = mode === "video" || doc.timeline ? applyOverrides(docAt(doc, panelMs), overrides) : doc;

  // ── takes ─────────────────────────────────────────────────────────────────
  const fileBase = (d: WordArtDoc) => (d.name || "word-art").replace(/[^\w-]+/g, "-").toLowerCase();
  async function stopRecording(reason?: string) {
    const r = takeRef.current;
    if (!r) return;
    takeRef.current = null;
    const result = await r.take.stop(reason);
    r.comp.dispose();
    playback.set({ take: "idle", playing: false });
    const used = !!overridesRef.current && Object.keys(overridesRef.current).length > 0;
    overridesRef.current = null;
    setOverrides(null);
    setTakeOn(false);
    const [rw, rh] = FRAMES[r.frame];
    setReviewing({ result, name: `${r.name}-${r.view}-${rw}x${rh}.${extFor(result.mime)}`, W: rw, H: rh, overrides: used, safe: false });
  }
  // ── the rendered loop (shot 2): frame by frame ─────────────────────────────
  const renderAbort = React.useRef<AbortController | null>(null);
  async function runRender(opts: { ms: number; loop: boolean; res?: RenderRes; onProgress?(done: number): void; readyTimeout?: number }): Promise<TakeResult | null> {
    const d = docRef.current;
    const real = d.view === "3d" ? three.current : two.current;
    // the harness can make the stage report "not ready" to check the readiness guard
    const notReady = (window as unknown as { __waTest?: boolean; __waNotReady?: boolean }).__waTest && (window as unknown as { __waNotReady?: boolean }).__waNotReady;
    const stage = real && notReady ? { drawFrame: real.drawFrame, ready: () => false } : real;
    if (!mark || !stage || takeRef.current || renderAbort.current || modeRef.current !== "video") return null;
    const [rw, rh] = FRAMES[d.frame];
    const ac = new AbortController();
    renderAbort.current = ac;
    try {
      return await renderLoop({ stage, playback, W: rw, H: rh, ms: opts.ms, loop: opts.loop, res: opts.res, signal: ac.signal, onProgress: opts.onProgress, readyTimeout: opts.readyTimeout });
    } finally {
      renderAbort.current = null;
    }
  }
  async function startRender(ms: number, loop: boolean, res: RenderRes) {
    const d = docRef.current;
    const [rw, rh] = renderSize(...FRAMES[d.frame], res);
    setReviewing(null);
    setRenderPct(0);
    let last = -1;
    try {
      const result = await runRender({ ms, loop, res, onProgress: (p) => { const pct = Math.floor(p * 100); if (pct !== last) { last = pct; setRenderPct(pct); } } });
      if (result) setReviewing({ result, name: `${fileBase(d)}-${d.view}-${rw}x${rh}${loop ? "-loop" : ""}.${extFor(result.mime)}`, W: rw, H: rh, overrides: false, safe: false });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") flash("Render cancelled");
      else frame.setError(e instanceof Error ? e.message : "The render failed.");
    } finally {
      setRenderPct(null);
    }
  }
  const stopRef = React.useRef(stopRecording);
  stopRef.current = stopRecording;
  // unmounting mid-take (another kind, navigation) stops the recorder and its loop
  React.useEffect(() => () => {
    renderAbort.current?.abort();
    const r = takeRef.current;
    if (!r) return;
    takeRef.current = null;
    void r.take.stop().then(() => r.comp.dispose());
    playback.set({ take: "idle", playing: false });
  }, [playback]);
  function startRecording() {
    const d = docRef.current;
    const stage = d.view === "3d" ? three.current : two.current;
    if (!mark || !stage || takeRef.current || typeof MediaRecorder === "undefined") {
      if (typeof MediaRecorder === "undefined") frame.setError("This browser can't record video.");
      return;
    }
    const [rw, rh] = FRAMES[d.frame];
    overridesRef.current = null;
    setOverrides(null);
    setReviewing(null);
    playback.set({ ms: 0, playing: false, take: "recording" });
    const comp = createCompositor({ W: rw, H: rh, draw: (ctx) => !!stage.drawFrame(ctx) });
    let take: Take;
    try {
      take = startTake(comp, { W: rw, H: rh, onTick: (ms) => { if (ms >= MAX_TAKE_MS) void stopRef.current("Stopped at the 60-second limit."); } });
    } catch (e) {
      playback.set({ take: "idle" });
      comp.dispose();
      return frame.setError(e instanceof Error ? `Recording didn't start: ${e.message}` : "Recording didn't start.");
    }
    takeRef.current = { take, comp, name: fileBase(d), view: d.view, frame: d.frame };
    setTakeOn(true);
  }
  // a view or frame change (or leaving record mode) ends the take; so does hiding the tab
  React.useEffect(() => {
    renderAbort.current?.abort(); // a render can't survive its stage changing
    const r = takeRef.current;
    if (r && (doc.view !== r.view || doc.frame !== r.frame || mode !== "video")) void stopRecording("Stopped because the view or frame changed.");
  }, [doc.view, doc.frame, mode]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (!takeOn) return;
    const onVis = () => { if (document.visibilityState === "hidden") void stopRef.current("Stopped because the tab was hidden."); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [takeOn]);
  // a clip not yet downloaded or sent: ask before leaving the page
  React.useEffect(() => {
    if (!reviewing || reviewing.safe) return;
    const onLeave = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [reviewing]);
  const lastSources = React.useRef<Partial<Record<MarkSource["kind"], MarkSource>>>({});
  lastSources.current[doc.source.kind] = doc.source;
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
    const next = { ...docRef.current, thumb, updatedAt: Date.now() };
    const list = [next, ...loadDocs().filter((d) => d.id !== next.id)];
    const err = saveDocs(list);
    setBusy(false);
    if (err) return frame.setError(err);
    setDocs(list);
    replace(next);
    flash("Saved in this browser", 2500);
  }
  function remove(id: string) {
    const list = loadDocs().filter((d) => d.id !== id);
    const err = saveDocs(list);
    if (err) return frame.setError(err);
    setDocs(list);
  }

  /** The 2D preview's current frame at the frame size, as a PNG; null when the preview isn't ready to be read. */
  async function snapshot2D(W: number, H: number): Promise<Blob | null> {
    const stage = two.current;
    if (!stage?.ready()) return null;
    const c = createCompositor({ W, H, draw: (ctx) => stage.drawFrame(ctx) });
    try {
      if (!c.frame()) return null;
      return await new Promise<Blob | null>((ok) => c.canvas.toBlob((b) => ok(b), "image/png"));
    } finally {
      c.dispose();
    }
  }

  async function exportPng() {
    if (!mark) return;
    const [W, H] = FRAMES[doc.frame];
    // what the stage shows: the design at the playhead when it has keys (3D reads its own evaluated design)
    const ev = mode === "video" || doc.timeline ? applyOverrides(docAt(doc, playback.get().ms), overridesRef.current) : doc;
    setBusy(true);
    try {
      // what the preview shows right now: shaders as they look at this moment (not the painted gradient).
      // The painted render stays as the fallback while a shader layer hasn't drawn yet.
      const blob = doc.view === "3d" && three.current ? await three.current.exportPng(W, H) : (await snapshot2D(W, H)) ?? (await renderPng2D(ev, mark, W, H));
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
      update({ name: file.name.replace(/\.\w+$/, "") });
    } else if (/^image\/(png|jpeg|webp)$/.test(file.type)) {
      const src = await new Promise<string>((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.readAsDataURL(file); });
      setSource({ kind: "image", name: file.name, src });
      update({ name: file.name.replace(/\.\w+$/, "") });
    } else frame.setError("Upload an SVG (best: it can go 3D) or a PNG, JPG or WebP logo.");
  }
  async function onFont(file: File) {
    if (/\.woff2$/i.test(file.name)) return frame.setError("WOFF2 fonts can't be read here; use the TTF, OTF or WOFF.");
    const url = URL.createObjectURL(file);
    const f: WordArtFont = { id: `upload:${file.name}`, label: `${file.name} (this session)`, url, note: "Uploaded for this session; it isn't saved with the design." };
    setUploadedFonts((u) => [...u.filter((x) => x.id !== f.id), f]);
    const cur = docRef.current.source;
    if (cur.kind === "text") setSource({ ...cur, font: f.id });
  }

  // the last background, so un-ticking "Transparent" brings it back instead of the Ring preset
  const lastBackground = React.useRef<GradientSpec | null>(null);
  if (doc.background) lastBackground.current = doc.background;

  const [W, H] = FRAMES[doc.frame];
  const s = shown.source;
  markRef.current = mark;
  const seed = s.kind === "eac" ? seeds.find((m) => m.id === s.id) : undefined;
  const font = s.kind === "text" ? allFonts.find((f) => f.id === s.font) : undefined;

  const drawer = (
    <>
      <div className="studio-panel__h">Start from</div>
      <div className="wa-starters">
        {STARTERS.map((st) => (
          <button key={st.label} type="button" className="studio-btn" onClick={() => { commit(st.make()); setTab("fill"); }}>{st.label}</button>
        ))}
      </div>
      <div className="studio-panel__h">Saved in this browser</div>
      {docs.length === 0 && <p className="studio-hint">Designs you save appear here. Download the PNG to keep one anywhere else.</p>}
      <div className="studio-list">
        {docs.map((d) => (
          <div key={d.id} className="wa-saved">
            <button type="button" className="studio-row" aria-current={d.id === doc.id} onClick={() => commit(d)}>
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
        <div className="studio-lib__tabs" role="group" aria-label="Export">
          <button type="button" aria-pressed={mode === "png"} onClick={() => setMode("png")} title="A still picture">PNG</button>
          <button type="button" aria-pressed={mode === "video"} onClick={() => setMode("video")} title="Record mode: keyframes and recording">Video</button>
        </div>
        {doc.view === "3d" && <button type="button" className="studio-btn studio-btn--ghost" onClick={() => three.current?.resetView()}>Reset view</button>}
      </div>
      {doc.view === "2d" ? (
        <Preview2D ref={two} doc={doc} mark={mark} mode={mode} playback={playback} overrides={overrides} />
      ) : (
        <React.Suspense fallback={<div className="wa-stage" style={stageStyle(W, H)} />}>
          <Preview3DLazy ref={three} doc={doc} mark={mark} mode={mode} playback={playback} overrides={overrides} />
        </React.Suspense>
      )}
      {reviewing && (
        <Review
          {...reviewing}
          recording={recording}
          onSafe={() => setReviewing((r) => (r ? { ...r, safe: true } : r))}
          onDiscard={() => setReviewing(null)}
          onRecordAgain={() => { setReviewing(null); startRecording(); }}
        />
      )}
      {mode === "video" && (
        <Strip
          doc={doc}
          playback={playback}
          onDoc={(d) => commit(d)}
          record={<RecordButton playback={playback} on={takeOn} disabled={!mark || !!reviewing || renderPct !== null} onStart={startRecording} onStop={() => void stopRecording()} />}
          render={
            <RenderControl
              defaultSec={Math.max(2, Math.round((timelineEnd(doc.timeline) + 2000) / 1000))}
              disabled={!mark || takeOn || !!reviewing}
              pct={renderPct}
              frameSize={FRAMES[doc.frame]}
              onStart={(ms, loop, res) => void startRender(ms, loop, res)}
              onCancel={() => renderAbort.current?.abort()}
            />
          }
        />
      )}
      <p className="studio-hint">
        {doc.view === "3d" ? "Drag to turn it, scroll to zoom. " : ""}
        {mode === "png" && doc.timeline ? "This design has keyframes: PNG shows and edits it at the playhead (Video to move it). " : ""}
        {doc.fill.shader !== "none" || (doc.background && doc.background.shader !== "none") ? (doc.view === "3d" && doc.fill.shader !== "none" ? "Shaders move in the preview. PNG saves the background as it looks at that moment; the 3D letters use their painted gradient." : "Shaders move in the preview. Download PNG saves the frame as it looks at that moment.") : ""}
      </p>
    </div>
  );

  // the panel reads `doc` as the design at the playhead in record mode (`shown`)
  const settings = ((doc: WordArtDoc) => (
    <div className="wa-settings">
      <label className="studio-field">
        <span>Name</span>
        <input className="studio-field__text" value={doc.name} onChange={(e) => update({ name: e.target.value })} />
      </label>

      <div className="studio-panel__h">Mark</div>
      <div className="studio-lib__tabs" role="group" aria-label="Mark source">
        <button type="button" aria-pressed={s.kind === "eac"} onClick={() => s.kind !== "eac" && setSource(lastSources.current.eac ?? { kind: "eac", id: "eac-classic", groups: [] })}>EAC logo</button>
        <button type="button" aria-pressed={s.kind === "text"} onClick={() => s.kind !== "text" && setSource(lastSources.current.text ?? { kind: "text", text: "ELKDONIS", font: allFonts[0]?.id ?? "", tracking: 20, leading: 1.05, align: "center" })}>Text</button>
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
            <textarea className="studio-field__text" rows={2} maxLength={400} value={s.text} onChange={(e) => setSource({ ...s, text: e.target.value })} />
          </label>
          <label className="studio-field">
            <span>Font</span>
            <select value={font?.id ?? ""} onChange={(e) => setSource({ ...s, font: e.target.value })}>
              {allFonts.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </label>
          {font?.note && <p className="studio-hint">{font.note}</p>}
          {!font && <p className="studio-hint">This design used a font uploaded in an earlier session, so {allFonts[0]?.label ?? "the first font"} stands in. Upload it again or pick one.</p>}
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
      {/* both panels stay mounted (hidden, not unmounted), so each keeps its open sections */}
      <div hidden={tab !== "fill"}>
        <GradientControl value={doc.fill} clearable={false} onChange={(g) => g && update({ fill: g })} />
      </div>
      <div hidden={tab !== "background"}>
        <label className="wa-check">
          <input type="checkbox" checked={!doc.background} onChange={(e) => update({ background: e.target.checked ? null : lastBackground.current ?? cleanGradient(PRESETS.find((p) => p.id === "ring")!.spec) })} />
          Transparent background (PNG with alpha)
        </label>
        {doc.background && <GradientControl value={doc.background} clearable={false} onChange={(g) => g && update({ background: g as GradientSpec })} />}
      </div>

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
  ))(shown);

  return (
    <>
      <StudioTopActions>
        <button type="button" className="studio-btn studio-btn--ghost" disabled={!past.current.length} onClick={undo} title="Undo (Ctrl+Z)">Undo</button>
        <button type="button" className="studio-btn studio-btn--ghost" disabled={!future.current.length} onClick={redo} title="Redo (Ctrl+Shift+Z)">Redo</button>
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

const LAYER: React.CSSProperties = { position: "absolute", inset: 0 };

/**
 * The 2D preview: the same layers as the export (background, fill cut to the mark, shadow), live.
 * In record mode it shows the design at the playhead, rendered at the real frame size (W×H CSS px,
 * scaled down to fit) so a recording copies full-size layers. While the timeline runs, shaders
 * follow its clock; otherwise they run their own.
 */
/** Render…: length and seamless loop, then progress and Cancel (frame by frame, smooth on any machine). */
function RenderControl({ defaultSec, disabled, pct, frameSize, onStart, onCancel }: { defaultSec: number; disabled: boolean; pct: number | null; frameSize: [number, number]; onStart(ms: number, loop: boolean, res: RenderRes): void; onCancel(): void }) {
  const [open, setOpen] = React.useState(false);
  const [len, setLen] = React.useState(String(defaultSec));
  const [loop, setLoop] = React.useState(false);
  const [res, setRes] = React.useState<RenderRes>("high");
  const size = (r: RenderRes) => renderSize(frameSize[0], frameSize[1], r).join("×");
  React.useEffect(() => { if (!open) setLen(String(defaultSec)); }, [defaultSec, open]);
  if (pct !== null) {
    return (
      <span className="wa-render__prog" role="status">
        <span>Rendering… {pct}%</span>
        <button type="button" className="studio-btn" onClick={onCancel}>Cancel</button>
      </span>
    );
  }
  return (
    <>
      <button type="button" className="studio-btn" disabled={disabled} aria-expanded={open} onClick={() => setOpen((o) => !o)} title="Render frame by frame: smooth on any machine, takes a little longer than the clip">Render…</button>
      {open && (
        <div className="wa-render" role="group" aria-label="Render">
          <label>Length (s) <input type="number" min={1} max={60} step={0.5} value={len} onChange={(e) => setLen(e.target.value)} /></label>
          <label>
            Resolution
            <select value={res} onChange={(e) => setRes(e.target.value as RenderRes)}>
              <option value="high">High · {size("high")}</option>
              <option value="low">Low · {size("low")}, smaller file</option>
            </select>
          </label>
          <label><input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} /> Seamless loop</label>
          <button
            type="button"
            className="studio-btn studio-btn--primary"
            onClick={() => { const sec = Math.min(60, Math.max(1, Number(len) || defaultSec)); setOpen(false); onStart(sec * 1000, loop, res); }}
          >Start</button>
        </div>
      )}
    </>
  );
}

/** ● Record / ■ Stop 0:07, in the keyframe strip. */
function RecordButton({ playback, on, disabled, onStart, onStop }: { playback: Playback; on: boolean; disabled: boolean; onStart(): void; onStop(): void }) {
  const ms = usePlayback(playback, (s) => Math.floor(s.ms / 1000));
  return (
    <button type="button" className={`studio-btn${on ? " wa-rec" : " studio-btn--primary"}`} disabled={disabled && !on} onClick={on ? onStop : onStart} title={on ? "Stop the take" : "Record from 0:00 at the frame size"}>
      {on ? `■ Stop ${fmtClock(ms)}` : "● Record"}
    </button>
  );
}

const Preview2D = React.forwardRef<StageHandle, { doc: WordArtDoc; mark: Mark | null; mode: "png" | "video"; playback: Playback; overrides?: Record<string, unknown> | null }>(function Preview2D({ doc: raw, mark, mode, playback, overrides }, ref) {
  const video = mode === "video";
  // the stage always draws at the frame size (scaled down to fit) with readable shader canvases, so Download PNG
  // can copy what the preview shows at that moment as well as a recording can
  const full = true;
  const ms = usePlayback(playback, (s) => s.ms);
  const running = usePlayback(playback, isRunning);
  const doc = video || raw.timeline ? applyOverrides(docAt(raw, ms), overrides) : raw;
  const clocks = video && running ? { fill: shaderClock(raw, "fill", ms), bg: shaderClock(raw, "background", ms) } : null;
  const [W, H] = FRAMES[doc.frame];
  const stage = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(1);
  React.useEffect(() => {
    const el = stage.current;
    if (!el || !full) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / W));
    ro.observe(el);
    return () => ro.disconnect();
  }, [full, W]);
  const L = mark ? layout(doc, mark, W, H) : null;
  // the recorder's inputs: the mark's mask (built once per mark and frame, at full size, and scaled
  // to the fill per frame), flattened layers and scratch canvases kept between frames
  const rec = React.useRef<{ mask: HTMLCanvasElement | null; maskFor: unknown; bg: LayerCache; fill: LayerCache; scratch: CompositeScratch }>({ mask: null, maskFor: null, bg: {}, fill: {}, scratch: {} });
  const evRef = React.useRef(doc);
  evRef.current = doc;
  React.useEffect(() => {
    if (!full || !mark) return;
    let live = true;
    const key = { mark, W, H };
    void markMask(mark, layout({ size: 100 }, mark, W, H)).then((m) => { if (live) { rec.current.mask = m; rec.current.maskFor = key; } });
    return () => { live = false; };
  }, [full, mark, W, H]);
  React.useImperativeHandle(ref, () => ({
    ready() {
      const el = stage.current, d = evRef.current;
      const mk = rec.current.maskFor as { mark: Mark; W: number; H: number } | null;
      // the mask is rebuilt (async) when the mark or the frame changes: not ready until it matches
      if (!full || !el || !mark || !rec.current.mask || !mk || mk.mark !== mark || mk.W !== W || mk.H !== H) return false;
      return layerReady(el.querySelector(".wa-frame > .wa-layer"), d.background) && layerReady(el.querySelector(".wa-fill"), d.fill);
    },
    drawFrame(ctx) {
      const el = stage.current, d = evRef.current, r = rec.current;
      if (!full || !el || !mark || !r.mask) return false;
      const Lf = layout(d, mark, W, H);
      const bg = d.background ? layerSource(el.querySelector(".wa-frame > .wa-layer"), d.background, W, H, r.bg) : null;
      const fill = layerSource(el.querySelector(".wa-fill"), d.fill, Math.ceil(Lf.w), Math.ceil(Lf.h), r.fill);
      ctx.clearRect(0, 0, W, H);
      composite2D(ctx, d, mark, W, H, { background: bg, fill, mask: r.mask }, r.scratch);
      return true;
    },
  }), [full, mark, W, H]);
  const mask = React.useMemo(() => (mark ? (mark.image ? `url("${mark.image.src}")` : markMaskUrl(mark)) : "none"), [mark]);
  const a = doc.shadow / 100;
  const layers = (
    <>
      {doc.background && <GradientBackground value={doc.background} className="wa-layer" style={LAYER} clock={clocks?.bg} capture={full} />}
      {mark && L && (
        <div
          className="wa-markwrap"
          style={{
            left: `${(L.x / W) * 100}%`, top: `${(L.y / H) * 100}%`, width: `${(L.w / W) * 100}%`, height: `${(L.h / H) * 100}%`,
            filter: a > 0 ? `drop-shadow(0 ${(2 + a * 14) / 10.8}cqmin ${(8 + a * 40) / 10.8}cqmin rgba(0,0,0,${0.25 + a * 0.5}))` : undefined,
          }}
        >
          <GradientBackground
            value={doc.fill}
            className="wa-layer wa-fill"
            clock={clocks?.fill}
            capture={full}
            style={{ ...LAYER, WebkitMaskImage: mask, maskImage: mask, WebkitMaskSize: "100% 100%", maskSize: "100% 100%", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat" }}
          />
        </div>
      )}
    </>
  );
  return (
    <div ref={stage} className={`wa-stage${doc.background ? "" : " wa-checker"}`} style={stageStyle(W, H)} data-ms={video ? Math.round(ms) : undefined}>
      {full ? (
        <div className="wa-frame" style={{ width: W, height: H, transform: `scale(${scale})` }}>{layers}</div>
      ) : (
        layers
      )}
      {!mark && <p className="studio-hint wa-empty">Loading the mark…</p>}
    </div>
  );
});
