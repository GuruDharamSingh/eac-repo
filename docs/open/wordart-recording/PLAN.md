# Word art record mode, shot 1: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Export ▾ Video turns on record mode. It adds a keyframe strip under the word-art stage (Look keys, playhead,
Play) that drives almost every setting over time. ● Record captures the stage at full frame size into
MP4/WebM, with Download and "Send to video editor".

**Architecture:**
- Pure core: `timeline.ts` stores keys per setting path, and `docAt(doc, ms)` evaluates the design at a
  moment. A shader clock integrates `motion` over time.
- In record mode the stage renders `docAt` at the real frame size (2D scaled down by CSS, 3D at W×H
  drawing-buffer size). Shaders are driven by the timeline's clock instead of their own.
- A detached compositor canvas re-draws the live layer canvases every frame and feeds
  `captureStream` → `MediaRecorder`. PNG export shares the same 2D compositing function.

**Tech Stack:** React 19 client components, three 0.184, `@elkdonis/gradients` (own WebGL1 shaders + Paper
Shaders 0.0.82, WebGL2), MediaRecorder, the Studio's chunked upload (`@elkdonis/studio/capture`).

**Spec:** `docs/open/wordart-recording/DESIGN.md`. Read it before starting: phase-1 sections, "Decisions
after the builder check", and the whole "Addition: Record mode and the keyframe timeline".

## Global Constraints

- All paths are under eris `~/eac` (`ssh eris`). The tree is shared with other sessions: **no commits, no
  pushes, no `git add`** unless Justin asks. Before editing a file the first time, copy it to
  `~/eac-backups/<name>.bak-20261118-rec`.
- Going live = an arts-collective rebuild, and it needs Justin's go each time (Task 7).
- Take cap and timeline cap: **60 s** (one constant, `MAX_TAKE_MS = 60_000`).
- Capture **30 fps** (`captureStream(30)`). Bitrate `Math.round(12_000_000 * (W * H) / (1920 * 1080))`.
- Mime from `pickRecordingMime()` (MP4 first, else WebM); file name
  `<design-name-slug>-<2d|3d>-<W>x<H>.<mp4|webm>` (slug as in today's PNG export).
- Under 24 fps measured, the review panel shows exactly: "This machine dropped frames; the rendered loop
  (coming) is smooth on any machine."
- Not animatable: `view`, `frame`. Changing either during a take stops the take and keeps the clip.
- Hold, not glide: kind, shader, seed, space, hue, ease (gradient), transparent background, sides,
  bevel, text, font, align, tracking, leading, mark source/parts.
- PNG mode must stay exactly today's editor. All 22 checks in `.ds-sync/watest/tabs.mjs` keep passing.
- WebGL: record mode must never hold more than about 3 contexts on the page.
- `@elkdonis/gradients` changes are additive (new optional props only): reels and Remotion use the same
  components.

## Review Focus

1. **Designs saved before today** (no `timeline`), or with a corrupt `timeline`, should load and behave
   exactly as now. A corrupt timeline is dropped, not a crash. Pinned in Task 1 (`cleanDoc` cases).
2. **Odd key data:** two keys at the same ms, keys out of order, the playhead past the last key or
   before 0. `docAt` should hold the nearest key and never return NaN or an invalid colour. Pinned in
   Task 1.
3. **Keys that disagree in shape:** different stop counts, or a background that is a gradient at one key
   and transparent (`null`) at the next. Colours should glide on resampled stops, and the transparent
   switch should hold. Pinned in Task 1.
4. **Mid-take disruption:** switching 2D/3D, changing the frame size, or hiding the tab during a take
   should stop it, keep what was recorded, and say why. Pinned in Task 6.
5. **Undo and reload:** + Key and key deletion should undo and redo. A reload (working draft) and a
   saved design should both keep the timeline. Pinned in Task 4.

---

## File structure

| File | Responsibility |
|---|---|
| `packages/studio/src/wordart/timeline.ts` (new) | Pure: types, registry of animatable paths, `cleanTimeline`, `docAt`, `applyEdit`, look-key ops, `shaderClock` |
| `packages/studio/scripts/timeline.test.mts` (new) | Node tests for timeline.ts (assert, like `packages/gradients/scripts/smoke.mts`) |
| `packages/studio/src/wordart/doc.ts` | `WordArtDoc.timeline?`, cleaned in `cleanDoc` |
| `packages/gradients/src/react/{GradientBackground,ShaderCanvas,PaperLayer}.tsx`, `src/paper.ts` | Additive `clock` and `capture` props |
| `packages/studio/src/wordart/Strip.tsx` (new) | The keyframe strip UI |
| `packages/studio/src/wordart/playback.ts` (new) | A tiny clock store (playhead ms, playing, take); subscribe outside React state |
| `packages/studio/src/wordart/render2d.ts` | `composite2D` shared by PNG export and capture; mark mask builder |
| `packages/studio/src/wordart/capture.ts` (new) | Compositor loop, `MediaRecorder` take, fps measurement |
| `packages/studio/src/wordart/Review.tsx` (new) | The review panel |
| `packages/studio/src/wordart/{WordArtKind,Preview3D}.tsx`, `wordart.css`, `index.ts` | Wiring, record mode, the animated 3D background |
| `apps/arts-collective/src/components/studio/StudioApp.tsx` | Pass `recording` props to `wordartExtension` |
| `.ds-sync/watest/record.mjs` (new), `main.tsx` | Browser checks; the harness host passes a stub `recording` endpoint |

Test commands (on eris):
- Unit: `cd ~/eac && source ~/.nvm/nvm.sh && packages/blocks/node_modules/.bin/tsx packages/studio/scripts/timeline.test.mts`
- Browser: `cd ~/eac && sudo -n docker run --rm --cpus=4 -v ~/eac:/work -w /work mcr.microsoft.com/playwright:v1.60.0-noble sh -c ".ds-sync/watest/build.sh && cd .ds-sync && node watest/<script>.mjs"`
- Types: `sudo -n docker compose run --rm --no-deps -w /app/packages/studio admin sh -c "npx tsc --noEmit -p . ; echo EXIT=\$?"` (and the same with `-w /app/packages/gradients`). Expected `EXIT=0`.

---

### Task 1: Timeline core

**Files:**
- Create: `packages/studio/src/wordart/timeline.ts`, `packages/studio/scripts/timeline.test.mts`
- Modify: `packages/studio/src/wordart/doc.ts` (interface `WordArtDoc`, `cleanDoc`)

**Interfaces (Produces):**
```ts
export type Ease = "smooth" | "linear" | "hold";
export interface Key { t: number; value: unknown; ease: Ease }            // t in ms, 0..MAX_TAKE_MS
export interface Timeline { v: 1; tracks: Record<string, Key[]> }          // keys sorted by t, unique t
export const MAX_TAKE_MS = 60_000;
export const TRACKS: Record<string, { kind: "number" | "color" | "stops" | "hold"; get(d: WordArtDoc): unknown; set(d: WordArtDoc, v: unknown): WordArtDoc }>;
export function cleanTimeline(raw: unknown): Timeline | undefined;
export function docAt(doc: WordArtDoc, ms: number): WordArtDoc;           // pure; returns doc itself when no timeline
export function applyEdit(doc: WordArtDoc, next: WordArtDoc, ms: number): WordArtDoc;
export function addLookKey(doc: WordArtDoc, ms: number): WordArtDoc;
export function removeLookKey(doc: WordArtDoc, ms: number): WordArtDoc;
export function setLookEase(doc: WordArtDoc, ms: number, ease: Ease): WordArtDoc;
export function lookKeyTimes(tl: Timeline | undefined): number[];        // sorted, unique
export function animatedTracks(tl: Timeline | undefined): string[];       // tracks whose keys hold ≥2 distinct values
export function timelineEnd(tl: Timeline | undefined): number;            // last key t, 0 when none
export function shaderClock(doc: WordArtDoc, layer: "fill" | "background", ms: number): number; // motion-seconds
```
Track paths: `fill.<field>` / `background.<field>` for every GradientSpec field, plus `size`, `shadow`,
`depth`, `bevel`, `metal`, `rough`, `tilt`, `spin`, `sides`, `sideColor`, `source` (the whole MarkSource,
hold). Kinds follow the spec ("How settings move" in DESIGN.md): `*.stops` = "stops", `*.base` and
`sideColor` = "color", the hold list = "hold", the rest = "number". `background` itself (null vs
gradient) is the hold track `background`. `background.*` tracks are ignored while it's null.

- [ ] **Step 1: Write the failing tests** in `timeline.test.mts` (same `ok(name, fn)` pattern as smoke.mts):
  - `docAt without timeline returns the same object`
  - `two look keys glide angle`: key at 0 (fill.angle 40), key at 5000 (220), linear → `docAt(d, 2500).fill.angle === 130`; smooth → also 130 at the midpoint, and < 76 at 1000 ms
  - `hold switches at the key`: fill.shader "none" at 0 and "silk" at 5000 → `docAt(…, 4999).fill.shader === "none"`, `docAt(…, 5000) === "silk"`
  - `before first / after last hold the end keys`: ms −100 → first value; ms 9e9 → last value
  - `stops glide in OKLab with resampling`: 2 stops → 5 stops; at 0 ms the result equals key 1's colours resampled to 5; every colour is a `#RRGGBB` hex; at the end it equals key 2's stops exactly
  - `transparent background holds`: background a gradient at 0 and null at 5000 → gradient at 4999, null at 5000
  - `applyEdit: a still setting changes everywhere`: no keys on `size`, edit size 72→50 at 3000 ms → `docAt(…, 0).size === 50`, no `size` track created
  - `applyEdit: a moving setting keys at the playhead`: `fill.angle` keyed at 0 and 5000 → edit to 300 at 2000 → new key at 2000 with value 300, the others untouched
  - `addLookKey then removeLookKey restores the timeline` (deepEqual)
  - `shaderClock integrates motion`: motion 50 constant → `shaderClock(d, "fill", 2000) ≈ 1.0` (±0.01); motion keyed 0 at 0 → 100 at 2000 linear → ≈ 1.0 at 2000, and monotonic over 0..2000 in 100 ms steps
  - `cleanTimeline drops junk`: `null`, `"x"`, `{tracks: {nope: …}}`, keys with NaN t, t > 60000, unknown ease → removed; a valid timeline round-trips through `JSON.parse(JSON.stringify())` + `cleanTimeline` unchanged
  - `cleanDoc keeps a valid timeline and drops a corrupt one` (via `doc.ts` `cleanDoc`)

- [ ] **Step 2: Run them; expect a failure** (import error: `timeline.ts` missing). Command: Unit (above).

- [ ] **Step 3: Implement `timeline.ts` and the `doc.ts` changes**
  - Easing `smooth` = `k*k*(3-2*k)`; `linear` = k; `hold` = the earlier key's value until the next key. A
    key's `ease` governs the segment that starts at it.
  - Numbers glide, then pass through the field's own clamp: the evaluated doc's gradients go through
    `cleanGradient`, and doc numbers through `cleanDoc`'s ranges.
  - Colours: interpolate in OKLab with `hexToOklab`/`oklabToHex` from `@elkdonis/gradients`. Stops:
    resample both keys to the larger count with `sampleAt(stops, p, spec)` at even positions, then lerp
    the colours and the positions.
  - `shaderClock`: integrate `motion/100` over 0..ms in steps of at most 50 ms (trapezoid). Memoise per
    (doc.timeline identity, layer) so per-frame calls are O(steps since last call) or cached.
  - Same-t keys: an upsert replaces the existing key within ±1 ms.

- [ ] **Step 4: Run the tests; expect all to pass.** The same command prints `ok` for every case.

- [ ] **Step 5: Types.** Run Types for studio; expect `EXIT=0`.

---

### Task 2: Shaders driven by a clock, and readable for capture

**Files:** Modify `packages/gradients/src/react/GradientBackground.tsx`, `ShaderCanvas.tsx`,
`PaperLayer.tsx`, `src/paper.ts`, `packages/gradients/README.md` (a Video/clock paragraph). Test:
`.ds-sync/watest/clock.mjs` (new) with a tiny page `clock.html` + `clock.tsx` (extend `build.sh` with a
second entry).

**Interfaces (Produces):**
```ts
// GradientBackground, ShaderCanvas, PaperLayer/PaperSurface gain:
clock?: number;    // motion-seconds from shaderClock(); when set, the layer draws exactly that moment, no own clock
capture?: boolean; // pixel ratio 1, preserveDrawingBuffer: true (own: getContext attr; Paper: webGlContextAttributes)
```
- Own shaders: shader time `t = clock * 2` (the same factor as `shaderUniforms(...).speed`).
- Paper: `frame = start + clock * 1200` with `speed: 0` (1.2 is today's live factor). `common(spec, frame)`
  gains an optional `clock` argument; the existing `frame` (ms) behaviour stays as it is for Remotion.
- `capture`: own canvases use dpr 1 (ignoring `quality`, so mineral is full size too). Paper gets
  `minPixelRatio: 1`, `maxPixelCount: W*H` of its host, and `webGlContextAttributes: { preserveDrawingBuffer: true }`.

- [ ] **Step 1: Write the failing check `clock.mjs`.** A page with two `GradientBackground`s
  (`PRESETS` "silk" = own, "mesh-flow" = Paper), both `capture` and `clock`, plus a "set clock" hook on
  `window`. Assertions:
  - the same clock twice gives identical `canvas.toDataURL()`
  - clock 0 vs 1.5 differ
  - a 2D-canvas `drawImage` of each WebGL canvas has a non-blank pixel at the centre
  - no console "context lost"
- [ ] **Step 2: Run it; expect FAIL** (unknown props are ignored, so the frames are equal or blank).
- [ ] **Step 3: Implement the props.** Clock mode uses the existing fixed-frame paths (`redrawRef`,
  Paper's `frame`), so a clocked layer draws even while off screen.
- [ ] **Step 4: Run `clock.mjs`, `tabs.mjs` and `run.mjs`; expect `ALL PASS`, 2 exports.**
- [ ] **Step 5: Types for gradients and studio, `EXIT=0`. Run the gradients smoke test
  (`tsx packages/gradients/scripts/smoke.mts`); expect 11 ok.**

---

### Task 3: Record mode, the full-size stage, the animated 3D background

**Files:** Modify `WordArtKind.tsx`, `Preview3D.tsx`, `wordart.css`. Create `playback.ts`. Test:
`.ds-sync/watest/record.mjs` (new, grows in Tasks 4–6).

**Interfaces:**
- Consumes: `docAt`, `shaderClock` (Task 1); `clock`, `capture` (Task 2).
- Produces:
  ```ts
  // playback.ts
  export interface PlaybackState { ms: number; playing: boolean; take: "idle" | "recording" }
  export function createPlayback(): { get(): PlaybackState; set(p: Partial<PlaybackState>): void; subscribe(fn: () => void): () => void };
  export function usePlayback<T>(pb: ReturnType<typeof createPlayback>, pick: (s: PlaybackState) => T, hz?: number): T; // hz throttles re-renders (panel: 4)
  ```
  - `Preview2D` / `Preview3D` gain `mode: "png" | "video"` and `playback`.
  - In video mode they render `docAt(doc, ms)` with `clock` on every gradient layer and `capture` on.
  - The stage element carries `data-ms` (the evaluated moment) for tests.
- Toolbar: `Export ▾` replaces "Download PNG". It holds **PNG** (today's behaviour) and **Video** (enters
  record mode; the menu item reads "Video (record mode)"). Leaving record mode: Export ▾ → PNG.
- 2D in video mode: an inner box of exactly W×H CSS px with `container-type: size`. It's scaled with
  `transform: scale(stageWidth / W)` (ResizeObserver), origin top left, so layers render at frame size.
- 3D (both modes): `scene.background = null` in the preview. The stage renders
  `<GradientBackground className="wa-layer" style={LAYER} value={doc.background} />` behind the
  transparent three canvas. `exportPng` keeps painting `textureOf` for the PNG, as today. In video mode
  the renderer uses pixel ratio 1 and `setSize(W, H, false)`, and `size()` keeps that while in video mode.
- When not playing, video mode shows `docAt(doc, playhead)`. Shaders run on the live clock: `clock` is
  advanced by real time × motion while idle, so motion still shows.
- Per-frame 3D cost rules (spec "Per-frame cost rules"):
  - The extruded geometry is rebuilt only when a *hold* input changes (mark, bevel, sides). The
    evaluated depth is applied as `art.scale.z = depth / builtDepth`.
  - `metal` and `rough` are set on the existing materials.
  - The fill texture is repainted only when the evaluated fill differs from the last painted one, at
    most once per frame.
  - Preview3D counts geometry builds in `window.__waStats.builds` when `window.__waTest` is set.

- [ ] **Step 1: Write the failing checks in `record.mjs`:**
  - Export ▾ → Video shows an element `[aria-label="Keyframe strip"]`
  - the 2D inner box's `offsetWidth/offsetHeight` equal 1080×1080 (1:1) and 1920×1080 after clicking 16:9
  - in 3D with the "Silk" background, two stage screenshots 1.5 s apart differ, in **both** PNG and video mode
  - in 3D video mode with `depth` keyed 10 → 90 over 0–5 s, scrubbing through 20 playhead steps leaves `__waStats.builds` unchanged
  - Export ▾ → PNG hides the strip
- [ ] **Step 2: Run; expect FAIL** (no Export menu).
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run `record.mjs` + `tabs.mjs` + `run.mjs`; expect ALL PASS** (`tabs.mjs` may need its
  "Download PNG" clicks changed to Export ▾ → PNG; change only that).
- [ ] **Step 5: Types `EXIT=0`.**

---

### Task 4: The keyframe strip, playback and editing at the playhead

**Files:** Create `Strip.tsx`. Modify `WordArtKind.tsx`, `wordart.css`. Test: `record.mjs`.

**Interfaces:**
- Consumes: `addLookKey`, `removeLookKey`, `setLookEase`, `lookKeyTimes`, `animatedTracks`,
  `timelineEnd`, `applyEdit` (Task 1); `playback` (Task 3).
- Produces: `<Strip doc playback onDoc={(next) => commit(next, "timeline")} />`. Every timeline change
  goes through WordArtKind's `commit` (undo), and the strip never writes the doc directly.

Strip contents (labels exact):
- **▶ Play / ❚❚ Pause**
- **● Record** (disabled until Task 6 wires it; title "Record (coming in this build)")
- a time ruler (0 to max(timelineEnd + 3000, 8000) ms, labelled in seconds)
- a draggable playhead (keyboard: ←/→ step 100 ms, Shift ×10)
- the **Look** row with ◆ per `lookKeyTimes`:
  - click a ◆ to move the playhead there
  - Delete/Backspace on a focused ◆ removes it
  - each ◆ has an ease select (smooth/linear/hold) for the segment it starts
- **+ Key** (adds at the playhead)
- the folded lanes: one row per `animatedTracks`, label from the registry, dots read-only (title "Editable lanes come in shot 2")

Settings panel in video mode:
- It shows values from `docAt(doc, playhead)`, re-rendered at most 4×/s while playing (`usePlayback(..., 4)`).
- Every `update(patch)` in video mode becomes
  `commit(applyEdit(doc, {...docAt(doc, ms), ...patch}, ms), keyOf(patch))`.
- The stage re-renders every frame via its own `usePlayback` subscription.

Play: rAF advances `ms` from the playhead. At `timelineEnd` it keeps advancing (the shaders keep moving)
until Pause or `MAX_TAKE_MS`. Starting from the end restarts at 0.

- [ ] **Step 1: Write failing checks in `record.mjs`:**
  - in video mode, + Key at 0
  - drag the playhead to 5 s (keyboard), set fill Angle to 220 via the range input, + Key
  - set the playhead to 2.5 s (keyboard): the visible Angle slider reads 130 ±2 (linear ease on the first ◆) and the stage's `data-ms` is 2500
  - Play: after ~1 s `data-ms` > 800; Pause
  - Ctrl+Z undoes the last + Key (Look ◆ count 2 → 1); Redo restores it
  - reload: the ◆ count is still 2 (working draft)
  - the Angle lane exists in the folded lanes
- [ ] **Step 2: Run; expect FAIL.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run `record.mjs` + `tabs.mjs`; expect ALL PASS.**
- [ ] **Step 5: Types `EXIT=0`. Unit tests still pass.**

---

### Task 5: One compositor for PNG export and capture

**Files:** Modify `render2d.ts`. Create `capture.ts` (compositor part). Test: `record.mjs` + a parity
script `.ds-sync/watest/parity.mjs` (new).

**Interfaces (Produces):**
```ts
// render2d.ts
export function markMask(mark: Mark, w: number, h: number, L: ReturnType<typeof layout>): Promise<HTMLCanvasElement>; // built once per mark+size
export function composite2D(ctx: CanvasRenderingContext2D, doc: WordArtDoc, mark: Mark, W: number, H: number,
  src: { background: CanvasImageSource | null; fill: CanvasImageSource; mask: HTMLCanvasElement }): void; // sync
// renderCanvas2D keeps its signature and now = paint sources + markMask + composite2D

// capture.ts
export function layerSource(host: HTMLElement, spec: GradientSpec, w: number, h: number): CanvasImageSource;
// draws into a cached canvas:
//   - the painted gradient (paintGradient, cached per spec)
//   - then every <canvas> child of host in DOM order (shader: normal; Paper surface: multiply at its CSS opacity)
//   - then grain via paintGradient's grain path (canvas.ts paintGrain, exported)
export function createCompositor(opts: { W: number; H: number; draw(ctx: CanvasRenderingContext2D): void }): { canvas: HTMLCanvasElement; frame(): void; dispose(): void };
```
- 2D capture draw:
  - `composite2D` with `layerSource(bgHost)` and `layerSource(fillHost)`
  - the mask comes from `markMask`, memoised on (mark, W, H, size)
- 3D capture draw:
  - `layerSource(bgHost)`, then `drawImage(renderer.domElement)` right after `renderer.render`, in
    the same rAF callback
  - Preview3D exposes `renderNow(): HTMLCanvasElement` on its handle
- A layer whose shader hasn't drawn its first frame yet uses the painted gradient alone (spec call 7:
  no blank flash).

- [ ] **Step 1: Baseline first.** Write `parity.mjs`. With the **current** code it exports PNGs for 4
  fixed non-shader designs (EAC classic, Text starter, EAC rings with the transparent background, 16:9
  radial) into `.ds-sync/watest/parity-baseline/`. Run it once and confirm the 4 files exist.
- [ ] **Step 2: Add the comparison mode** (`node watest/parity.mjs --compare`): re-export and compare
  pixels; every channel's difference ≤ 2 on ≥ 99.9% of pixels. Run it; expect PASS (same code).
- [ ] **Step 3: Write the failing check in `record.mjs`.** In video mode with the "Silk" fill and the
  "Mesh flow" background, call the test hook `window.__waCompositeOnce()` (exposed only when
  `window.__waTest` is set). Expect a W×H canvas that has non-blank pixels inside the mark and outside
  it, and that differs from the painted PNG export.
- [ ] **Step 4: Implement the refactor and `capture.ts` compositor.**
- [ ] **Step 5: Run `parity.mjs --compare`, `record.mjs`, `tabs.mjs`, `run.mjs`; expect all PASS.**

---

### Task 6: Takes, the review panel, Download and Send to video editor

**Files:** Modify `capture.ts` (take), `WordArtKind.tsx`, `Strip.tsx` (enable ● Record), `index.ts`.
Create `Review.tsx`. Modify `apps/arts-collective/src/components/studio/StudioApp.tsx`,
`.ds-sync/watest/main.tsx` (pass the stub `recording`), and the harness server in `record.mjs` (stub
`/upload?op=start|part|finish|abort` → `{id:"u1"}`, `{ok:true}`, `{path:"Recordings/test.webm"}`).

**Interfaces:**
```ts
// capture.ts
export interface Take { stop(reason?: string): Promise<{ blob: Blob; mime: string; ms: number; fps: number; reason?: string }> }
export function startTake(c: ReturnType<typeof createCompositor>, opts: { W: number; H: number; onTick(ms: number): void }): Take;
// WordArtKindProps
recording?: { uploadEndpoint: string; reelHref: string };
```
Behaviour, with exact copy:
- **● Record** starts at 0. The playback runs (Task 4 Play rules), and the button shows `■ Stop 0:07`
  (`clock()` from capture).
- Auto-stop at 60 s with the reason "Stopped at the 60-second limit."
- Hidden tab → stop with "Stopped because the tab was hidden."
- 2D/3D or frame change → stop with "Stopped because the view or frame changed."
- fps = frames composited ÷ seconds.
- Edits during a take (spec: they override, they don't write keys):
  - WordArtKind keeps `takeOverrides: Partial<Record<TrackPath, unknown>>`, applied with the registry's
    `set` on top of `docAt` for the rest of the take.
  - They're dropped when the take ends, so the design returns to what its timeline says and nothing
    goes to undo.
  - The review panel notes "Changes made while recording were for this take only." when any were made.
- Review panel (an overlay on the stage; Escape does nothing while an upload runs):
  - looping `<video>` (the seek-to-end fix for WebM)
  - a line `12.4 s · 18.2 MB · 1080×1080 · MP4`
  - the stop reason when present, and the fps warning (Global Constraints)
  - buttons **Download**, **Send to video editor** (only with `recording`), **Record again**, **Discard**
- Send:
  - `startChunkedUpload(uploadEndpoint, { body: { name: <file name> } }, onProgress)`, `push(blob)`, `finish()`
  - progress text `Sending… 45%`
  - on success: "Saved to Recordings as <name>" + a link **Open in video editor** →
    `${reelHref}${reelHref.includes('?') ? '&' : '?'}new=clip&clip=${encodeURIComponent(path)}`, `target="_blank"`
  - on failure: the error, **Retry**, and Download stays
- While a clip is unsent and undiscarded, `beforeunload` asks to leave.
- arts-collective passes `recording: { uploadEndpoint: "/api/studio/recordings/upload", reelHref: "/studio?kind=video" }`
  into `wordartExtension`.

- [ ] **Step 1: Write failing checks in `record.mjs`** (Chromium in the playwright image records WebM):
  - a 3 s take of a Silk-fill design gives a review `<video>` with `videoWidth×videoHeight` = 1080×1080, and the line shows `3.`–`3.4 s`
  - two seeks (0.5 s and 2.5 s) give different frames
  - a take with Size changed at ~1 s: frame at 0.5 s ≠ frame at 2.5 s within the mark box; after Stop the
    Size slider shows its pre-take value, and the review shows "Changes made while recording were for this take only."
  - Send → the stub saw start, ≥1 part, finish; the link href is `/studio?kind=video&new=clip&clip=Recordings%2Ftest.webm`
  - switching to 3D mid-take shows the review with "Stopped because the view or frame changed."
  - a 3D 2 s take gives 1080×1080 and the background differs between seeks
  - no WebGL context-lost console messages in the whole run
- [ ] **Step 2: Run; expect FAIL** (Record disabled).
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run `record.mjs`, `tabs.mjs`, `run.mjs`, `parity.mjs --compare`, `clock.mjs` + unit tests; expect all PASS.**
- [ ] **Step 5: Types `EXIT=0`** for studio and gradients, and for arts-collective:
  `-w /app/apps/arts-collective admin sh -c "npx tsc --noEmit -p . ; echo EXIT=\$?"`, filtered to errors in
  `src/components/studio/StudioApp.tsx`. Expect no errors from that file.

---

### Task 7: Ship it (with Justin's go)

- [ ] **Step 1: Ask Justin for the go.** Name the other sessions' dirty packages that will ship
  (`git status --short -- packages apps/arts-collective`).
- [ ] **Step 2: Deploy.**
  - Back up the build: `sudo -n docker exec eac-arts-network tar -czf - -C apps/arts-collective .next > ~/eac-backups/next/arts-collective-<date>-pre-record.tgz`.
  - `rm apps/arts-collective/.next/server/pages-manifest.json` in the container, then `docker restart eac-arts-network`.
  - Wait for "Ready".
- [ ] **Step 3: Verify the deploy.**
  - grep `.next/static/chunks` for "Send to video editor" and "Keyframe strip".
  - `curl` `/studio?kind=wordart` → 307 to the login page.
  - The logs show no new errors.
- [ ] **Step 4: Write the session note.** Add `docs/sessions/2026-11-18_wordart-record-mode.md` (what
  shipped, the tests, open items for shot 2) and update the memory `project_wordart_recording.md`.
