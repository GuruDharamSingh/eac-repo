# EAC logo animation: handover (2026-10-05)

Covers the planning and first asset step of an 8 s Remotion logo animation that merges the
EAC mark with a winged-disc (Faravahar-style) drawing and a flame. Nothing is built in
`packages/reels` yet; nothing is committed. Working files are in
`docs/sessions/2026-10-05_eac-logo-animation/`. The next session was asked to be one that
can reach WSL (see Open items).

## Decisions (developer answers, 2026-10-05)

| Topic | Decision |
|---|---|
| Format | 1920×1080, about 8 s, loopable. Outputs: solid-black MP4 (H.264) and transparent WebM (VP9 alpha). |
| Wordmark | The "Elkdonis Arts Collective" text under the logo is left out. Mark only. |
| Fire | Realistic or painterly, generated procedurally inside Remotion (noise shader, WebGL or canvas). No outside footage. |
| Wings and tail | Redrawn as vector paths from the supplied drawing, animated feather by feather. Gold, dim at first and warming as the flame goes out. |
| Letters | Traced from the 940 px colored logo into vector paths (done, see below). Emerge from the bottom up as the fire burns away, blue leaning right as they rise. Final look: soft blue to soft white, mild gradient. |
| Circle and crescents | Light-blue logo geometry with the outermost crescent removed. Read as circle plus two crescents (the light-blue image shows the circle and three arcs). **Unconfirmed reading.** |
| Crescents | Carry the final "Ain Soph" to "Aur" shift: gradient, orange-red on the top crescent. The last flame rises into them. |
| Loop | Hold the finished lockup about 1 s, then wings, letters and crescents dissolve together; the bare circle stays and is the first frame. |

Sequence: bare gold circle, flame rises; flame burns down to a single flame while the
letters emerge; flame goes out as the wings and tail unfurl; last flame rises into the
crescents; hold; dissolve to the circle.

## Current state

- Source images (user uploads, copied here): `wings.jpg` (796×389, black line art on white),
  `eac-color.jpg` (940×957, blue/gold/red arcs, used for letters), `eac-lightblue.jpg`
  (350×392, geometry reference), `eac-red.jpg` (1024×1024, not used so far). No vector or
  higher-resolution original exists in the repo (searched 2026-10-05).
- Letter trace: `trace_letters.py` crops `(250,270,670,500)` from `eac-color.jpg`, splits
  E (blue), A (gold), C (red) by hue, traces each with potracer, writes `letters.json`
  (`viewBox` 0 0 420 230; one SVG path `d` per letter) and `letters-preview.png`.
  Verified 2026-10-05 by overlap with the threshold mask: IoU E 0.989, A 0.993, C 0.993.
  The fixed preview image was not looked at; check it against the original before use.
- No fire animation for the Pure Land artwork was found (searched `apps/danamccool`,
  `packages/three`, repo-wide for "pureland"/"purification"). The only fire code is
  `packages/three/src/inner-temple/scenes/FireSouthScene.tsx` (Three.js, not Remotion).
  The developer believed one existed; unknown where.
- `packages/reels`: templates are registered in `src/templates/index.ts` as
  `REEL_TEMPLATES` and turned into compositions by `src/root.tsx`; rendering runs in the
  `reel-render` container (`render/render.mjs`, renderer at `/opt/reel`). Not yet checked:
  whether `ReelTemplateId` in `src/types.ts` must be extended, or whether a separate
  composition is easier for a non-reel logo sting (assumed: separate composition).

## Rules and constraints found

- The session scratchpad mount is `noexec`: compiled Python wheels cannot load from it.
  Install inside the container run: `python -m pip install --target /tmp/pylib ...` then
  `PYTHONPATH=/tmp/pylib python ...` with `-u 3003:3003 -e HOME=/tmp -v <dir>:/w`
  (image `python:3.12-slim`, already present). `trace_letters.py` expects `/w` paths.
- The host has no pip, scipy, OpenCV, potrace, ImageMagick, GIMP or ffmpeg. PIL and numpy
  only.
- potracer's `Bitmap` polarity came out inverted for a boolean mask; the script now tries
  both and keeps the one with the higher IoU. Filling traced curves needs even-odd (XOR).
- WSL is not reachable from this host: no `wsl` binary, no SSH key (only
  `authorized_keys`), and ports 22, 2222, 445, 3389 and 5985 on `10.4.147.20` (the machine
  holding SSH sessions to this host, probably the WSL machine) did not answer from here.
  The existing WSL workflow pushes files to `~/astro-corpus/inbox/`.
- Per `CLAUDE.md`: a rebuild of any app deploys other sessions' uncommitted work; this task
  should not need one (the logo is a Remotion composition, not an app change). Commit only
  when asked.

## Open items

1. Decide where WSL fits. Tools wanted there: image work (Inkscape, GIMP, potrace,
   ImageMagick) and possibly a GPU render. The new session needs a way to run commands in
   WSL or a shared folder.
2. Wings: trace `wings.jpg` the same way (threshold the dark lines, vectorize). For
   feather-by-feather animation, segment the closed feather cells (flood fill the white
   regions between line strokes) and order them from the body outward. Then mirror or
   confirm both wings are drawn separately in the source (the source shows both).
3. Circle and crescents: draw as exact SVG arcs from `eac-lightblue.jpg`. Confirm the
   crescent count with the developer (circle plus two, or circle plus three minus one).
4. Fire: write the procedural flame (fBm noise, upward advection, per-stage shape: tall
   multi-tongue, then single flame, then a thin flame rising into the crescents). Decide
   WebGL vs canvas by testing inside the `reel-render` Chrome.
5. Compose and time the 8 s sequence; add a Remotion composition and register it; render
   MP4 and alpha WebM in `reel-render`; screenshot frames to check each beat
   (`.claude/rules/03-verification.md`: render, do not trust a compile).
6. Report to the developer when done; they asked for creative latitude and to be asked
   only when blocked.

## Open questions

- Where the Pure Land fire animation lives, if it exists.
- Whether the letters' final "soft blue to soft white" should keep any gold or red from the
  original logo (the developer's description puts red on the crescents only).
