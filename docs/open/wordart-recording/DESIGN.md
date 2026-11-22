# Word art: record the preview as video (design, 2026-11-18)

Status: design for review. Phase 1 = live recording. Phase 2 = rendered loop (sketched at the end, built later).

## Intent

Justin makes "word art" in the Studio (`/studio?kind=wordart` on arts-collective, code in
`packages/studio/src/wordart`): an EAC mark, text or uploaded logo filled with a gradient from the
gradient lab (`packages/gradients`), on a gradient background, in 2D or extruded 3D. The gradients can
carry WebGL shaders that move (4 of ours, 7 Paper Shaders). Today the only export is a still PNG, and
the 3D view's background doesn't move at all.

He wants moving word art as video: press **Record** on the preview, let it play and *perform it*
(drag sliders, swap presets, orbit and spin the 3D, change colours, all captured), press **Stop**, then
either download the clip or send it to the Studio's video editor (`/studio?kind=video`, `packages/reels`),
which already trims, adds text/music/subtitles and renders reels. MP4 or WebM are both fine; GIF was
dropped (256 colours bands gradients; files are huge).

## Goals

1. **Record button** on the word-art preview, in 2D and 3D. A running timer while recording, Stop,
   and an automatic stop at a length cap.
2. **Full frame resolution**: the recording is the design's frame size (1080×1080, 1920×1080,
   1080×1920, 1080×1350), not the on-screen preview size upscaled.
3. **What's captured** = everything the preview shows: background (CSS gradient, grain, paper, any
   shader), the mark filled with its gradient/shader, the 2D shadow, the 3D extruded mark with its
   lighting, and every live change made during the take.
4. **Animated 3D background** (agreed 2026-11-18): in 3D the background moves like it does in 2D (all
   11 shaders, grain, paper), in the preview and in recordings.
5. **Review panel** after Stop: the clip plays back (loops), with its length, size and resolution, and:
   - **Download**: `<design-name>-<2d|3d>-<W>x<H>.<mp4|webm>`
   - **Send to video editor**: uploads it into the person's `Private/Video/Recordings` and opens it in
     the video editor as a new clip reel (the existing Recordings → "Edit with overlays" hand-off)
   - **Record again** and **Discard**
6. Existing behaviour unchanged: PNG export (2D and 3D), the 22 regression checks in
   `.ds-sync/watest/tabs.mjs`, saved designs, the working draft, undo/redo.

## Non-goals (phase 1)

- Trimming inside word art (the video editor does it; Download gives the whole take).
- Audio. GIF. The frame-exact rendered loop (phase 2).
- Moving gradients on the 3D mark's faces (it stays the painted still, as today).
- New shaders or a visual shader picker (separate work; Justin can see shaders now).
- Saving recordings with the design, or a word-art recordings list (the Recordings kind is that list).

## Anti-goals (a failure even if it "works")

- A blurry recording (preview pixels stretched to 1080).
- What's recorded differs from what's on screen (different layout, missing shadow or grain, a shader
  missing from the recording).
- Recording costs so many WebGL contexts that the browser kills the preview's own shaders (~16 per page).
- The editor freezes or becomes unusable while recording (the point is to perform it live).
- A long take silently lost (tab switched, upload failed) with no message.

## Constraints and facts found

- **Shaders**: ours (`ShaderCanvas`, WebGL1) draw synchronously and can draw a fixed moment (`frame` ms).
  Paper Shaders (`PaperLayer`, `@paper-design/shaders-react` 0.0.82, WebGL2 via `ShaderMount`) accept
  `webGlContextAttributes`, so `preserveDrawingBuffer: true` can be passed and their canvases read with
  `drawImage`. `ShaderMount.setFrame(ms)` exists (needed in phase 2).
- **Both engines pause when off screen** (ShaderCanvas via IntersectionObserver + visibility; Paper via
  its own IntersectionObserver → speed 0). A full-size render surface must therefore intersect the
  viewport (e.g. `position: fixed; inset: 0` behind the app at near-zero opacity, `pointer-events: none`)
  or the pause logic needs an explicit override. Builder's call which; it must be verified in a browser.
- **2D preview** is DOM: `GradientBackground` layers, the fill cut to the mark by CSS `mask-image`, a CSS
  `drop-shadow`. PNG export (`render2d.ts` `renderCanvas2D`) re-creates the same layers on a canvas from
  `paintGradient` (no shaders). Recording needs the same compositing with *live* layer sources.
- **3D** is three.js (`Preview3D.tsx`): background is a painted still texture on `scene.background`; the
  renderer already clears transparent (`setClearColor(0, 0)`); `exportPng` re-sizes the renderer to W×H
  for one frame. `OrbitControls` are bound to the renderer's canvas.
- **Browser recording**: `canvas.captureStream()` + `MediaRecorder`. Chrome/Edge record MP4 (H.264) in
  recent versions, otherwise WebM (VP9/VP8); Safari MP4; Firefox WebM. `@elkdonis/studio/capture` already
  has `pickRecordingMime()` and `startChunkedUpload()`. MediaRecorder WebM carries no duration; the
  reels renderer re-encodes WebM (`render/render.mjs normalizeClips`), and the Recordings → reel path
  already takes browser WebM recordings.
- **Upload + hand-off already exist**: `POST /api/studio/recordings/upload?op=start|part|finish|abort`
  (signed in, parts 5–64 MB, into `Private/Video/Recordings`), then
  `/studio?kind=video&new=clip&clip=<path>` makes a new clip reel with that recording
  (`VideoKind.tsx` ~line 170). The studio page passes these to the Recordings kind today
  (`apps/arts-collective/src/app/studio/page.tsx` ~line 350); word art's extension
  (`wordartExtension({ fonts })` in `components/studio/StudioApp.tsx`) needs them passed too.
- Going live = an arts-collective rebuild (container `eac-arts-network`), which ships other sessions'
  uncommitted work; needs Justin's go each time.

## Approaches considered

1. **Live recording via a full-size compositor canvas** (chosen by Justin). Each animation frame, a W×H
   canvas is drawn from live layer sources (shader canvases rendered at full size, painted CSS gradients,
   the mark mask, shadow, the three.js render), and `captureStream` + `MediaRecorder` encode it. Captures
   live edits. Trade-off: heavy shaders at 1080 on a weak GPU can drop frames.
2. **Rendered loop** (frame by frame, deterministic, WebCodecs): perfectly smooth on any machine,
   seamless loops; captures no live edits. Justin wants this **next** ("moving towards both"), so phase 1
   must be built so phase 2 reuses its compositor (see the end).
3. **Screen/tab capture** (`getDisplayMedia` + region crop): rejected. A permission prompt each take,
   Chrome-only cropping, and screen-resolution (blurry) output.

## The design (phase 1)

### One compositor, shared with PNG export

Refactor `render2d.ts` so the 2D layering (layout, background, fill cut to the mark, shadow) takes
**layer sources** instead of always painting them:

```
composite2D(ctx, doc, mark, W, H, { background?: CanvasImageSource | null, fill: CanvasImageSource })
```

- PNG export passes painted sources (`paintGradient` canvases, as now), so export output must stay
  pixel-identical to today's for non-shader designs.
- Recording passes live sources: a shader canvas when the layer has a shader (with grain and the paper
  surface layered the way `GradientBackground` layers them), else the painted gradient (re-painted only
  when that spec changes, not per frame).
- The mark mask (Path2D paths or the image mark) is built once per mark and size and reused per frame.

3D: each frame, draw the background source, then the three.js frame rendered at W×H (transparent clear)
on top.

### Full-size live sources

While recording, the layers render at the frame size, not the preview size. Proposed: a hidden
**record surface** mounts the same `GradientBackground` layers at W×H (with `preserveDrawingBuffer` on
both shader engines), and the visible stage switches to showing the compositor canvas, scaled to fit.
The on-screen preview is then literally the recording, and the WebGL count stays about the same (the
record surface's contexts replace, not add to, the stage's; the builder confirms the count). The
pause-when-off-screen issue above must be solved for this surface.

For 3D, the renderer renders at W×H during the take (like `exportPng` does for one frame) and the
compositor draws it; `OrbitControls` attach to the stage element (not the renderer canvas) so orbiting
keeps working while the visible element is the compositor canvas.

### Recording

- `canvas.captureStream(30)` → `MediaRecorder`, mime from `pickRecordingMime()` (MP4 first, then WebM
  VP9, VP8), video only, bitrate about 12 Mbps at 1080 (scale by pixel count).
- Cap: **60 s** (builder: one constant). Timer shown on the Record button; auto-stop at the cap.
- If the tab is hidden mid-take, rAF stops and frames freeze: stop the take and keep what was recorded,
  with a message.
- Editing stays fully live during a take; switching 2D↔3D or frame size **stops** the take first (the
  surface size changes).

### Review panel

A sheet/overlay over the stage after Stop: looping `<video>` of the blob, "12.4 s · 18.2 MB · 1080×1080
· MP4", and the four actions from Goal 5. "Send to video editor" shows upload progress, uploads with
`startChunkedUpload` into Recordings, then opens `/studio?kind=video&new=clip&clip=<path>` **in a new
tab** (so the word-art session and its unsaved state stay put; the working draft is saved anyway).
Upload errors keep the clip in the panel with a retry and a Download fallback.

### Host wiring

`WordArtKindProps` gains optional `recording?: { uploadEndpoint: string; reelHref: string }`. Without
it, "Send to video editor" is hidden (Download still works). arts-collective passes
`/api/studio/recordings/upload` and `/studio?kind=video`.

### Animated 3D background

In 3D, `scene.background` stays `null` in the preview; the stage renders `GradientBackground` (same as
2D) behind the transparent three.js canvas. PNG export from 3D keeps today's painted background. The
recording composites the live background source behind the three.js frame.

### Tests

Extend the word-art harness (`.ds-sync/watest`, playwright image, SwiftShader WebGL):
- a 3 s 2D take of a shader design gives a playable blob whose `<video>` reports the frame size
  (e.g. 1080×1080) and whose frames differ over time;
- the same for 3D, with the background moving;
- a slider changed mid-take shows in the recording (compare early vs late frames);
- PNG export of a non-shader design is byte- or pixel-identical before/after the refactor;
- "Send to video editor" against a stub upload endpoint calls start/part/finish and opens the reel URL;
- all 22 existing checks still pass; no WebGL context-lost warnings during a take.

## Left to the builder

The record surface's exact mechanics (and how it defeats the off-screen pause), how sources are wired
from the React tree to the compositor (refs, a registry, a context), the review panel's markup in the
Studio's existing classes, the bitrate formula, and file structure.

## Phase 2 sketch (rendered loop, not built now)

Same compositor, driven by a clock instead of rAF: for frame n at 30 fps, set every source to
t = n/30 s (ShaderCanvas `frame`, Paper `setFrame`, the 3D spin angle from t), wait until each source
has drawn, composite, and encode with WebCodecs (`VideoEncoder` + an MP4 muxer such as mediabunny or
mp4-muxer; licences to check). Options: length, and "seamless loop" (crossfade the last ~0.5 s into the
start, since shader time isn't periodic). Phase 1 must therefore keep sources addressable by time and
the compositor independent of rAF.

## Decisions after the builder check (2026-11-18; all are the designer's calls unless marked)

1. **3D live view during a take** (call): the one renderer resizes to W×H when the take starts and back
   when it stops (one hitch at each end is acceptable; no resizing mid-take). The stage shows the
   compositor canvas scaled down to fit. It is the same box and the same aspect (`stageStyle`), and a
   1080 frame downscaled stays crisp. `OrbitControls` attach to the stage element, whose box equals the
   displayed canvas, so pointer maths needs no remap. No second renderer.
2. **WebGL budget** (answered): today the worst case is 2 contexts in 2D (background shader + fill
   shader) and, with the animated 3D background, 2 in 3D (three.js + background shader). The gradient
   control's swatches are CSS-only. During a take the stage's own layers **unmount** (the stage shows
   the compositor) and the record surface holds the same 2, so the peak stays about 2–3, far under ~16.
3. **Frame rate** (call): target 30 fps with `captureStream(30)`; dropped frames are accepted (the
   recording is what the machine managed). The review panel measures the real average fps; under 24 it
   says "This machine dropped frames; the rendered loop (coming) is smooth on any machine." A take never
   fails because of frame rate.
4. **Format** (Justin, 2026-11-18: "mp4 … is fine. or webm"): MP4 when `pickRecordingMime()` offers it,
   else WebM; both go to the video editor (its path already re-encodes WebM). Length shown in the review
   panel comes from our own take timer, not the file (WebM has no duration). The review `<video>` gets
   the usual seek-to-end fix so its seek bar works.
5. **PNG parity baseline** (call): before the refactor, the harness saves PNG exports of a fixed set of
   non-shader designs from the current code. After it, the same exports must match within a tiny
   per-pixel tolerance (same SwiftShader run environment), not byte-identity.
6. **Failures** (call): the Studio is signed-in only (the page redirects to login), so there's no
   signed-out case. After upload, no automatic new tab (a popup blocker would eat it). The panel instead
   shows an **Open in video editor** link (opens in a new tab on the person's click) plus "Saved to
   Recordings as <name>". On upload failure: the message, Retry, and Download, and the clip stays in the
   panel until Discard. Closing or reloading the page with an unsent clip shows the browser's leave-page
   warning.
7. **Swapping a layer mid-take** (call): no blank flash. While a newly chosen shader warms up, the
   compositor draws the *painted* version of the new spec (as PNG export does). It switches to the live
   shader once that canvas has drawn its first frame. A brief "the shader isn't moving yet" moment is
   acceptable.

---

# Addition (2026-11-18): Record mode and the keyframe timeline

Justin: "give slides smooth movement plans (move here to here, over 5 seconds), then it happens when
record is hit"; "developing a timeline or 'keyframe strip' under the stage is the way to go… that's
where some of [per-slider moves] can be as well… [whole-look keys] seems like the basics. this can load
optional in a 'record mode' chosen when the export is video"; "mostly any setting should be able to be
fiddled with in the timeline… colours, gradient colour change values, scale, motion etc."; the take
**keeps running** after the last key until Stop; "build this out smart… maybe two shot it."

## What it is

- **Export ▾ PNG | Video.** PNG mode is today's editor, untouched. **Video** turns on *record mode*: the
  keyframe strip opens under the stage, with ▶ Play, ● Record and the playhead. (This replaces the
  single Record button of the phase-1 design above; recording, the review panel and "Send to video
  editor" are unchanged.)
- **Keys snapshot the design at a moment.** The strip's top row is the *Look* row: **+ Key** at the
  playhead records every animatable setting there. Between keys, settings glide (smooth or linear
  easing per segment).
- **Lanes, one per animated setting** (Angle, Size, Tilt, Fill colours, Background motion…), folded
  under the Look row. They show where each setting has its own keys (shot 2 makes them editable).
- **Editing at the playhead** (the video-editor convention): change a setting while the playhead is
  parked. If that setting already moves, its key at the playhead is updated, or added there if absent.
  If it doesn't move, the edit changes it for the whole timeline (no key made). + Key turns every
  setting's current value into keys at the playhead.
- **Play** runs the timeline from the playhead (from 0 at the end). **Record** always starts at 0, plays
  the timeline, and **keeps running after the last key** with the last look held and shaders still
  moving, until Stop or the 60 s cap. Dragging a setting during a take overrides that setting for the
  rest of the take; it doesn't write keys.

```
 ▶ Play   ● Record   0:00 ─────────●──────────────── 0:05 ───── 0:08     smooth ▾
 Look     ◆─────────────────────────◆─────────────────◆        + Key
  ▸ Angle   ▸ Size   ▸ Tilt   ▸ Fill colours   (lanes, folded)
```

## Smart core: the data is per setting from day one

Stored on the design (`WordArtDoc.timeline`, optional, cleaned in `cleanDoc`, saved with the design and
the draft, covered by undo/redo):

```ts
interface Timeline { v: 1; tracks: Record<TrackPath, Key[]> }  // TrackPath e.g. "fill.angle", "size"
interface Key { t: number /* ms */; value: unknown; ease: "smooth" | "linear" | "hold" }
```

- A *Look* key is just "a key at t on every track" (UI sugar). So shot 2's lanes are UI over the same data.
- One pure function drives everything: `docAt(doc, ms) → WordArtDoc` (the design as it looks at that
  moment). The preview, Play, Record and the later rendered loop all render `docAt`. It must be
  deterministic and unit-tested in the harness.
- **What's animatable** (the registry is one table; adding a setting is one line):
  - **Numbers glide**: gradient angle, centre x/y, softness, mute, light, scale, count, steps (these two
    move in whole steps), grain, motion, paper (fill and background); mark size, shadow; 3D depth,
    metal, roughness, tilt, spin.
  - **Colours glide**: a gradient's stops interpolate in OKLab, stop by stop. When two keys have different
    stop counts, both are resampled to the larger count (`sampleAt`) first. Base colour and side colour
    glide in OKLab too.
  - **Hold (switch at the key)**: gradient kind, shader, seed (gliding it makes mesh blobs jump about),
    blend space, hue path, easing, transparent background on/off, sides mode, 3D bevel, text content,
    font, align, tracking, leading, mark source and parts. (Bevel, tracking and leading would rebuild the
    mark's geometry or mask every frame. They hold in shot 1, and shot 2 can try gliding them if it's
    cheap enough.)
  - **Not animatable**: 2D/3D view and frame size (they set the recording's size). Changing either
    stops a take.
  - Angle glides numerically between 0 and 359. A full turn is two keys (0 → 359), not a wrap.
- **Shader rates**: keying `motion` changes a shader's *speed*. Shader time must integrate speed over
  time (as the live loop already does) so a speed change never jumps the picture. Our `ShaderCanvas` and
  Paper both get a time source fed by the timeline (integrated time at `ms`), not their own clocks, in
  record mode. Phase 2 needs this too.

## Two shots

**Shot 1: record mode works end to end.**
- Export ▾ PNG | Video; record mode; the strip with Look row, playhead (drag to scrub), + Key, delete a
  Look key, per-segment ease, Play, and the folded lanes read-only.
- Editing at the playhead (auto-key rules above) for every animatable setting.
- `docAt` + the registry + colour interpolation + integrated shader time, with tests.
- Recording (phase 1 above): full-size compositor, review panel, Download, Send to video editor, the
  animated 3D background.
- Timeline saved with the design and draft; undo/redo.

**Shot 2: control and polish.**
- Lanes editable: drag a setting's key to retime it (stagger), delete a single key, change one key's
  ease, add a key to one lane only.
- The rendered loop (frame-exact, smooth on any machine, optional seamless loop) from the same `docAt`.
- Whatever shot 1's use shows is missing (Justin's call after trying it).

## Calls in this addition (the designer's, to check)

- The video-editor auto-key convention ("a moving setting keys at the playhead, a still one changes
  everywhere") rather than "every edit makes a key". Fewer accidental keys.
- Drags during a take override the setting for the rest of that take without writing keys. (Recording
  live drags as keys is a possible later feature.)
- The timeline is capped at 60 s, the same as the take cap.
- Record always starts from 0; Play starts from the playhead.
- View and frame size can't be animated.
- **Per-frame cost rules** (from the builder read):
  - During Play and Record only the stage renders `docAt` every frame. The settings panel isn't
    re-rendered per frame: it refreshes about 4 times a second and stays fully usable for overrides.
  - In 3D, depth animates by scaling the extruded mark along z, with no geometry rebuild per frame.
    Materials (metal, roughness) update in place.
  - A moving 3D fill gradient re-paints its texture at most once per frame. The builder measures it and
    throttles it if it's costly.
  - In 2D the mark's mask is built once per mark, never per frame.

## Change (2026-11-18 evening, after Justin hit it): the mark isnt keyframed

## Change (2026-11-18 evening, after Justin hit it): the mark is not keyframed
The mark (text, font, tracking, leading, align, the EAC logo and its parts, uploads) is no longer a timeline
track. A font or text change always changes the whole design, in both modes. Older timelines mark keys move
onto the design (the first key). Switching text or font partway through a video would be a deliberate
feature later.
