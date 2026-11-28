# Word art generation route: design

Design for a route that lets a site ask for a generated word-art image for the signed-in person's org. The image is
rendered on the server and filed as a media asset. Written 2026-11-27 after the developer's answers; the 2D version was
built the same day (source only: see "Built").
Related: `docs/sessions/2026-11-18_wordart-record-mode.md` (Studio word art, PNG and render changes of 2026-11-20).

## Built (2026-11-27, source only; not deployed)
| Part | File |
|---|---|
| Queue table | `packages/db/migrations/301_wordart_jobs.sql` (written, not applied) |
| Request checks, fonts, colour pairs, random picks | `packages/services/src/wordart-catalog.ts` |
| Queue, permissions, rate limit, library row | `packages/services/src/wordart-generate.ts` |
| Routes (`wordArtRoutes`) | `packages/services/src/wordart-routes.ts`; mounted at arts-collective `/api/wordart/generate` and `/[id]` |
| Drawing | `packages/studio/src/wordart/generated.ts`, `packages/reels/src/wordart-still.tsx` |
| Worker job | `packages/reels/render/wordart.mjs`, called from `render.mjs`; `--wordart <design.json> --out <dir>` draws offline |
| Hub card | `apps/arts-collective/src/components/hub/WordArtCard.tsx` on `/hub/organization` |
| Atlas | `generate-word-art` in `areas/arts-collective.studio.ts` |

Differences from the design below: the library row is added by the app on the first status read after a render (the worker
cannot import the TypeScript services); a "Just me" picture gets no `media` row (the table is per org, and a row under
`oad` would list a private file to that org's members); migration 264's owner filing is not involved, the folder is.

**Verified** (temporary Postgres with a minimal schema plus migration 301, a stand-in for Nextcloud, no live data): 18
queue, permission, limit and route checks and 6 render and filing checks passed; six offline renders (auto lines, typed
lines, 9:16, 1:1, one long word, a script no font covers); `tsc` 0 errors in arts-collective, studio and reels (services
has 17 older errors, none in these files). **Not verified:** the card in a browser, `next build`, the live database and
Nextcloud, the worker's missing-table path.

**To deploy, in order**
1. Apply 301 alone (`psql -f`, then the tracker row by hand, as for 279/280). `db:migrate` would also apply 263 and 295,
   which are pending.
2. `docker compose restart reel-render` (the worker reads the repo at start; no image rebuild). A restart fails any reel
   render in progress.
3. Rebuild arts-collective (`docs/reference/ops.md`).

## Decisions (developer, 2026-11-27)
- Generated pieces are media assets in the org's folder, not threads.
- The caller is the signed-in person (`getServerSession()`); the acting user is never taken from request params.
- The site supplies the text and may pin any part of the design (font, palette, depth, view, frame); everything not pinned is random.
- Output is a PNG, delivered through a job id: the call returns at once and the file appears when the render finishes.
- From the first request: 16:9 by default, words kept inside the frame and split onto lines where that helps, 3D with a low depth and gradient sides.

- Later 2026-11-27: first version is 2D only (3D skipped for now), and the button lives on a hub card. This replaces
  the 3D and low-depth points above and below.

## Probe: 2D still in the render worker (verified 2026-11-27)
- Six 1920x1080 PNGs rendered by Remotion `renderStill` in a throwaway `eac-reel-render` container (`--network none`,
  repo mounted read-only, no database or Nextcloud access), importing the Studio's `textMark`, `layout`, `renderCanvas2D`
  and the gradient presets unchanged. Bundle 4.9 s, then 0.34-0.64 s per still; 16 s for the whole run.
- All text stayed inside the frame; the line split (1-4 lines, an extra line only if letters grow by more than 10%) and
  accented characters worked. Sheet: `wordart-generate/probe-2d-sheet.png`; code: `wordart-generate/entry.tsx`, `still.mjs`.
- Seen on the sheet: Cormorant Garamond is thin for this use, most with a multicolour fill; one very long word renders as
  a narrow band (no hyphenation); the `veil` look darkened by 45 reads as near-black with a grey rim.
- Not checked: non-Latin scripts, emoji, and glyphs a font lacks.

## Current state
- Word art lives in `packages/studio/src/wordart/`. It runs only in the browser. Saved designs are in localStorage
  (`loadDocs` in `doc.ts`); there is no server table and no server renderer. (verified 2026-11-27, code read)
- `layout()` in `render2d.ts` fits the mark inside the frame in both directions, so a word cannot leave the frame at any
  `size` of 100 or less. Line breaks are not chosen: a text mark has the lines the text already has.
- 3D extrusion is `Preview3D.tsx` (three.js, `sides: "gradient"`, `depth`, `bevel` exist).
- A render queue pattern exists: `reel_renders` (migration 189), `queueReelRender` in `packages/services/src/reels.ts`, polled by
  the `reel-render` container (Remotion + headless Chrome, Debian image, `packages/reels/render/render.mjs`).
- Org files are written through `packages/services/src/dav.ts` and `org-storage.ts`; a path without a `Private/` segment is
  served to anonymous visitors (CLAUDE.md), so generated files go under `Private/`.

## Design
1. **Service** `@elkdonis/services/wordart-generate`: `queueWordArt(userId, orgId, { text, pins?, frame? })` checks that the
   person may act for the org, validates and clamps the pins, applies a per-person rate limit, inserts a job row.
   `getWordArtJob(userId, jobId)` returns status and the file path to its owner only.
2. **Route factory** `wordArtRoutes()` mounted by each site that offers the button (same pattern as `centerRoutes()`):
   `POST /api/wordart/generate` returns `{ jobId }`; `GET /api/wordart/generate/<jobId>` returns `{ status, path }`.
   Sites therefore call their own origin with the visitor's session cookie; no cross-origin credential is needed.
3. **Queue** table `wordart_jobs` (id, org_id, requested_by, input jsonb, status, error, output_path, created_at, finished_at),
   stored with `db.json()`. Migration number from `/new-migration`. Polled by the existing `reel-render` worker as a second job type.
4. **Rendering** in that worker: Remotion `renderStill` of a `WordArt` composition that reuses the Studio code (`textMark`,
   `layout`, `renderCanvas2D`) so the output matches Studio. The design is built from a seed taken from the job id.
   ~~`Preview3D` scene~~ (2026-11-27: 2D only).
5. **Randomising** (`randomDesign(text, pins, seed)`):
   - frame 16:9 (1920×1080); view 2D, soft shadow (~~3D, gradient sides, depth 8–18~~ deferred 2026-11-27);
   - font from the OFL families only: Basteleur Bold and Moonlight, Alfa Slab One, Cinzel, Cormorant Garamond. Brothers and
     Religath are excluded: the Studio's font list notes personal-use and demo terms for them;
   - fill and background chosen as curated pairs (contrast is set by the pair, not drawn separately), painted gradients only;
   - line breaks: for 1 to 4 lines take the split with the narrowest widest line; keep an extra line only if the letters grow by
     more than 10%; `size` 86.
6. **Filing**: `<org root>/Private/Media/Images/WordArt/wordart-<yyyymmdd-hhmmss>-<id>.png` plus a `.json` sidecar holding the
   design, so Studio can open the piece later and a person can edit it. The upload is recorded under the requesting person the way
   other uploads are filed by owner (migration 264).
7. **Upkeep**: claim the new writes in the atlas (`packages/actions/atlas/`), add a `JOURNAL.md` line, add the capability to the registry if a
   dock or Channel entry is wanted.

## Open items
- 3D (deferred): whether headless Chrome in `reel-render` can run WebGL has not been probed.
- The final list of fill/background pairs and fonts (developer's call on the look). Built with four fonts (Cormorant
  Garamond dropped as too thin) and six pairs (the darkened veil replaced by a plain dark gradient).
- "Just me" pictures are under the person's `Private/`, which `canReadMedia` also opens to people who share an org with them
  (its interim rule), given the address.
- Org pictures are private to the org: using one on a public page needs a copy in public `Media/`.
- The worker runs one job at a time: a picture waits behind a video render in progress.
- Other sites: mount `wordArtRoutes` and add a button; only arts-collective has them. The hub card is on the organization
  tab, so a person with no organization has no card.
- Who in an org may generate (owners and guides only, or members) and the rate limit (assumed 20 per person per hour).
- "Generate random word art" is a hub card (decided 2026-11-27); assumed to be arts-collective `/hub` first.
- Whether a generated file also appears in the Studio's word-art list (needs server-stored designs; today that list is per browser).
