# 2026-11-18 — Word art: gradient fixes, record mode (shot 1)

Live on arts-collective since the 16:13 EST rebuild (BUILD_ID `tHr_0WTe24YLEoGhGsM34`). Backups of the previous
build are in `~/eac-backups/next/arts-collective-20261118-pre-record.tgz` and `…-pre-wordart.tgz` (the morning's).
Nothing is committed; the source backups are in `~/eac-backups/*.bak-20261118*`.

## Morning: gradient lab bugs (Justin's report + a read-only bug hunt)
- **Root cause of "settings lost when switching Mark fill / Background":** Grapick's `destroy()` runs a non-silent
  `clear()`, and the StopBar wrote the shrinking stops back. Fixed in `packages/gradients/src/react/StopBar.tsx`;
  this hits every GradientControl host.
- Also fixed:
  - grain, shader and paper presets collapsing the 2D layers
  - Surprise and From wiping settings
  - a bad hex deleting its stop
  - the stage aspect ratio
  - shadow parity with the export
  - the 3D context leak
- Added: undo/redo, a working draft, per-source memory, and both gradient panels kept mounted.

## Record mode, shot 1
Design `docs/open/wordart-recording/DESIGN.md`, plan `PLAN.md` (same folder), ledger with every ruling
`~/eac-backups/wordart-rec-progress.md`.
- **Export: PNG | Video.** Video opens the keyframe strip:
  - + Key, playhead, Play, ease per key, lanes (read-only).
  - Editing at the playhead auto-keys settings that already have keys.
- **● Record:**
  - The compositor re-draws the live layers at full frame size every frame. MediaRecorder writes WebM (or MP4 where
    the browser can).
  - Edits during a take are for that take only. The 60 s cap, view/frame change and a hidden tab each stop the take.
  - The review offers Download / Send to video editor (Recordings upload, then `/studio?kind=video&new=clip&clip=`) /
    Record again / Discard.
- The 3D background moves (it's a live layer behind the transparent canvas).
- The gradients package gained `clock` (motion-seconds) and `capture` props (additive). See the README "Recording"
  paragraph.

## Tests
- **Unit:** `tsx packages/studio/scripts/timeline.test.mts` (14).
- **Browser:** playwright image; `.ds-sync/watest/build.sh` then `record.mjs`, `tabs.mjs`, `run.mjs`,
  `parity.mjs --compare`, `clock.mjs`.
- **Harness limits:** the harness has no GPU, so 3D recording was verified on the PC's RTX 4080. Serve the bundle on
  127.0.0.1 there.

## Open (shot 2 and after)
- Editable lanes: retime a key, delete one key, ease per key, a key on one lane only.
- The rendered loop: frame-exact, smooth on any machine, optional seamless loop.
- Deferred minors (in the ledger): Play runs to 60 s instead of stopping at the last key; a playhead dip below 0 at
  Play start; a one-frame compositor lag.

## 2026-11-20: PNG from the live frame, render resolution (source only, not rebuilt)
- Download PNG copies what the preview shows when clicked (`snapshot2D` in `WordArtKind.tsx`; 3D `exportPng` in
  `Preview3D.tsx` composites the live background layer under a transparent render). The painted render stays as the
  fallback while a shader layer or the mark mask hasn't drawn. 3D letters still use the painted gradient.
- `Preview2D` always lays out at the frame size (scaled to fit) with readable shader canvases (`capture`), in PNG mode too;
  the 3D background layer is laid out the same way. Cost: a shader runs at frame size while it is on screen.
- Render… has Resolution: High (frame as designed) / Low (720 on the short side, QUALITY_LOW); `renderSize` in `render.ts`.
  MP4 only where the browser can encode H.264; otherwise the render falls back to WebM.
- Checks: `.ds-sync/watest/snapshot.mjs` (14 pass) plus `tabs.mjs` and `record.mjs` (82 pass in total, 0 fail), studio
  `check-types` 0. Backups: `~/eac-backups/wordart-20261120/`. Not verified: a real GPU, signed-in Studio.
- 2026-11-20 15:05 EST: arts-collective rebuilt (BUILD_ID `QCBnFh1DIh8irXu-liHjX`; previous `Ut_IKLxk28Kj3Rlft7hoE`,
  backup `~/eac-backups/next/arts-collective-20261120-1501.tgz`). Verified: edge 200, tenant-smoke 9/9, the new strings
  are in the client bundle and the old PNG warning is not. Not verified: Studio signed in, a real MP4 on the GPU.
  The build also carries other sessions' uncommitted work in the tree (none edited in the prior 60 min).
