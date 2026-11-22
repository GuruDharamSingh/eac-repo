# Word art record mode, shot 2: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Editable lanes in the keyframe strip, plus a frame-exact "rendered loop" export that is smooth on any
machine.

**Architecture:**
- Lanes are UI over the per-setting tracks that shot 1 already stores (`timeline.ts`); new pure ops edit one track's
  keys.
- The rendered loop reuses shot 1's compositor (`capture.ts` + the stage `drawFrame`). It drives every source to an
  exact moment (`docAt`, the shader `clock`, Paper `frame`, the 3D spin), waits until each has drawn, and encodes with
  WebCodecs into MP4 (H.264), with WebM as the fallback.

**Spec:** `docs/open/wordart-recording/DESIGN.md` ("Two shots" → Shot 2; "Phase 2 sketch (rendered loop)").
Shot 1 is live, so this plan only adds to it.

## Global Constraints
- The same as shot 1 (`PLAN.md` Global Constraints): shared tree, no commits, back up before the first edit, and a
  rebuild only with Justin's go. Additive changes only to `@elkdonis/gradients`.
- The muxer dependency is pinned to an exact version at least 2 weeks old. It's installed via
  `sudo -n docker compose --profile tools run --rm -T install </dev/null`, with a backup of `pnpm-lock.yaml` first.
- Rendered length: the timeline end plus a 2 s tail (default), adjustable 1–60 s; 30 fps.

## Review Focus
1. Retiming a key onto another key's time on the same lane: the moved key wins, with no duplicate.
2. Removing a lane's last key: the setting stays at that value, with no jump to an old base value.
3. A render while Paper shaders are still loading: it must wait, never encode blank frames.
4. Cancelling a render midway leaves the editor usable: no encoder left running, no stuck "rendering" state.
5. Odd frame sizes or a browser without WebCodecs: a clear message, and live recording still works.

---

### Task A1: Lane ops (pure)
**Files:** `packages/studio/src/wordart/timeline.ts`; test `packages/studio/scripts/timeline.test.mts`.

**Produces:**
```ts
moveTrackKey(doc, path: string, fromT: number, toT: number): WordArtDoc   // clamps 0..MAX_TAKE_MS; replaces a key already at toT
removeTrackKey(doc, path: string, t: number): WordArtDoc                  // last key gone → the base takes its value
setTrackKeyEase(doc, path: string, t: number, ease: Ease): WordArtDoc
addTrackKey(doc, path: string, ms: number): WordArtDoc                    // value = what the design shows at ms
```

- [ ] **Step 1: Write the failing unit tests.**
  - Moving one lane's key leaves the other lanes untouched.
  - Moving onto an existing key replaces it.
  - Removing the last key keeps the value.
  - Ease applies per key.
  - Adding a key holds the evaluated value.
- [ ] **Step 2: Run them; expect a failure** (missing exports).
- [ ] **Step 3: Implement the four ops.**
- [ ] **Step 4: Run them; expect all to pass. Studio tsc: `EXIT=0`.**

### Task A2: Editable lanes in the strip
**Files:** `Strip.tsx`, `wordart.css`; test `record.mjs` "lanes".
- Each lane dot is a button (`data-lane`, `data-t`).
  - Click selects it and moves the playhead to it.
  - Dragging it retimes the key (snaps to 100 ms).
  - Delete removes it.
- With a dot selected, the "Ease from this key" select edits that dot alone. With no dot selected, it edits the Look
  key, as before.
- Each lane has a **+** that adds a key on that lane at the playhead.
- [ ] **Step 1: Write the failing browser checks** (in `record.mjs`):
  - Drag the Fill angle 5 s key to 3 s: the angle reaches its end value at 3 s, and Size still glides to 5 s.
  - Delete a lane dot: only that lane loses its key.
  - Undo restores it.
  - Lane + adds a key.
- [ ] **Step 2: Run them; expect FAIL.**
- [ ] **Step 3: Implement the lane UI.**
- [ ] **Step 4: Run `record.mjs`, `tabs.mjs`, parity and clock; expect ALL PASS. Types `EXIT=0`.**

### Task B1–B3: Rendered loop
Detailed after the muxer research (library and version, codec strings, encoder backpressure). Sketch:
- **B1:** `render.ts`:
  - `renderLoop(stage, doc, { W, H, ms, fps, loop }) → Blob`
  - sets each frame's moment, waits for the sources (own shaders draw synchronously; Paper gets `frame`, then
    two rAFs; 3D renders synchronously), composites, then `new VideoFrame(canvas, { timestamp })`, encodes and muxes
  - backpressure on `encodeQueueSize`
  - cancelable
- **B2:** UI:
  - a **Render** button in the strip, opening length and seamless-loop options and a progress bar
  - **Cancel**
  - the result goes to the same review panel (Download / Send to video editor)
  - seamless loop = crossfade the last 0.5 s into the first frames
- **B3:** checks (harness + PC GPU), the final review (Sonnet), then a rebuild with Justin's go.

---

## Part B detailed (2026-11-18 evening, after the muxer research; mediabunny 1.65.1 installed with Justin's yes)

**API, checked against the installed typings:**
- `new Output({ format: new Mp4OutputFormat() | new WebMOutputFormat(), target: new BufferTarget() })`
- `new CanvasSource(canvas, { codec: "avc" | "vp9", quality: QUALITY_HIGH, keyFrameInterval: 2, latencyMode: "quality" })`
- `output.addVideoTrack(src, { frameRate: 30 })`, `await output.start()`, `await src.add(i / 30, 1 / 30)` (seconds;
  awaiting it is the backpressure), `src.close()`, `await output.finalize()`, `output.target.buffer`
- Codec choice: `await canEncodeVideo("avc", { width, height })`, else `"vp9"`, else `"vp8"`, else the message
  "This browser can't render video files here; ● Record still works."

**Determinism:** frame n shows moment t = n / 30 s.
- `playback.set({ ms: t })` with `take: "rendering"` (a new take state; `isRunning` is true for it), then two rAFs
  so React commits. Our shaders draw in the layout effect; Paper gets `frame` from the clock; the 3D preview loop
  renders.
- In rendering, the 3D camera is placed deterministically: the start camera rotated around the target by
  `spin/100 × 8 × (2π/60)` rad per second (OrbitControls' autoRotate rate). autoRotate is off while rendering.

**Readiness (Review Focus 3):** before frame 0, wait (≤ 10 s) until `stage.ready()`: every layer with a shader or
paper has a sized canvas. After the timeout, render anyway, with the painted fallback.

**Seamless loop:**
- Render the moments L … L+F first (F = 15 frames = 0.5 s) into ImageBitmaps.
- Then output frames i = 0 … L−1, where output i (i < F) = frame(i) blended over bitmap i at weight 1 − i / F.
- The clip then runs on from its last frame into its first.

**Cancel (Review Focus 4):** an AbortController. Cancel calls `output.cancel()`, sets the take back to idle, and
the editor stays usable.

**Tasks:**
- **B1: `render.ts`** `renderLoop(stage, { W, H, ms, loop, signal, onProgress }) → TakeResult`, plus the
  `ready()`/deterministic-3D changes. Checks in `record.mjs` "render":
  - a 2 s 2D render: a 60-frame, 2.0 s ± 0.1 s, 1080×1080 file whose frames differ
  - the same moment in two renders decodes identically (within a tiny tolerance)
  - a render started right after choosing a Paper preset isn't the painted fallback
  - a 3D render of 1 s: its frames differ, even in the CPU-only harness
  - loop: the seam difference (last frame → first) is far smaller than the mid-clip difference
- **B2: UI.**
  - Strip **Render** opens: Length (s, default timeline end + 2, 1–60), Seamless loop, and **Start**.
  - While rendering: "Rendering… 42%" and **Cancel**.
  - The result goes to the Review (with `reason` = "Rendered frame by frame (smooth on any machine).").
  - Check: Cancel leaves the editor usable, and Record works after it.
- **B3:** the suite, the PC GPU check (MP4 where Chrome has H.264), the final Sonnet review, then the rebuild with
  Justin's go.
