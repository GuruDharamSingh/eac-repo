# Handover: fc (system32-fc), 2026-11-14 end of day

Lane: Para Theater (`apps/sunjay`) house-editor work, rounds 1-2. Full records are in `ROUND1.md` ("## fc" round 1, "## fc, round 2"). The harness is in `packages/direct-edit/harness/event-detail/` (README there). Scratch, outside the repo: `~/scratch/fc-r1/` (h/ shims, logs/, edge/).

## Live now
- Para Theater build `233XY5Fv4hG5pMtcRaV9Z` (2026-11-14 ~11:10 EST). Backup of the previous build `GG_g-_iEjJynUxsPCOq4C`: `~/eac-backups/next/sunjay-20261114-1104.tgz`.
- It carries rounds 1-2 of fc and a2:
  - parts on 13 event, service and writing blocks;
  - "From what?" for service, piece, gathering (`which`) and guide (profile card);
  - record preview through `at*` keys;
  - pt-post and POST_DETAIL_TEMPLATE;
  - pt-steps rich-text rows.
- Edge checks before and after: `~/scratch/fc-r1/edge/{before,after}.txt`.

## Since the build (source only, NOT live)

### 5b: nothing acts without a click while editing. Partly done.
- **Audit result:** only two sunjay blocks act without a click.
  - Gallery: "Move on by itself every N s" (GalleryFace's `setInterval`).
  - Talk room: "Open the room when the page loads" (`startOpen`) mounts the call frame, with camera, mic and autoplay allowed.
- **None needed elsewhere, from the code:**
  - forum: loads only inside its popup, after a click;
  - Next gathering: its effects only sync props and the menu, and RSVP fetches on a click;
  - calendar: skips its first run, and refetches on a month change;
  - offering card: its effect only computes a local-time label;
  - booking: records `location`;
  - article and writing shelf: no effects.
- **Canvas clicks are already captured by the editor** (measured: `~/scratch/fc-r1/h/probe-click.cjs`). Tab focus is d6's (a), given to a2.
- **Change:**
  - `apps/sunjay/src/blocks/data-blocks.tsx`: `GalleryBlock` wrapper; pt-gallery is no longer `interactive`; `editingOf(puck).drawn` → `autoAdvanceSeconds = 0`.
  - `apps/sunjay/src/blocks/event-blocks.tsx`: `TalkRoomBlock` wrapper; pt-talk-room `interactive: false`; editing → `startOpen = false`.
  - Each wrapper is server-safe, strips `puck`, and hands the client view plain values (HE's pattern; `@elkdonis/blocks/record` used as a consumer).
- **Tests:**
  - `tsc` sunjay: 0.
  - `drive.cjs` section I: **146/147**. Pass: the Talk room stays closed while editing, the gallery stays still while editing, and the published Talk room opens. **FAIL: "published: the gallery moves on by itself".**
  - **Not yet known whether this is the wrapper (a regression on visitors' auto-advance) or the test's selector** (it hashes the innerHTML of the h2's parent over 2.6 s). Check before 5b ships: run the same check against a scratch copy of the build-time `data-blocks.tsx` (rebuilt from `git diff`), or look at what GalleryFace changes per tick.
- **Status:** the files are complete and saved. Nothing is half-edited.

### #3: sunjay offerings in /manage/content, and the right Edit path. Not started.
- No code read or written for it yet. The cause notes are a2's (`HANDTEST_2026-11-14.md`).
- What I know that bears on forms:
  - sunjay's services read `listServiceOfferings` / `getServiceOffering` (`@elkdonis/services`), keyed by slug (`lib/puck/data-service.ts`). The canvas and Studio now choose a service by slug (`lib/puck/service-actions.ts`, Puck's `ServicePickerField`).
  - HE already has a working "service" kind in a Studio popup: `apps/hidden-enneagram/src/components/publish/service-kind.tsx` → `saveContentAction` / `upsertServiceOffering` (author = signed-in user). It is opened through the `studio:compose` surface (`?kind=service&id=…&framed=1` on `/publish`). That is the nearest existing "right form" for an offering.
  - The publishing-forms plan (`docs/open/publishing-forms-handoff/PLAN.md`, `@elkdonis/studio/forms`) is where the one set of forms is meant to live. #3's Edit should open there rather than sunjay's old compose surface, so #3 is likely "the listing + a link" until that form exists for services.

### Other files changed since the build (not mine)
- `apps/sunjay/src/components/hub/hub-card-host.tsx` (a2's lane).

## What ships with which rebuild
- **Next sunjay rebuild (needs Justin's yes):** 5b, plus whatever a2 has landed since 11:10 (for example `hub-card-host.tsx`). Don't ship 5b until the published-gallery check is resolved; otherwise revert the two wrappers (restore `interactive: true` and the plain views).
- **Other apps:** none of my work touches them, apart from shared harness files. a2's shared-package fixes (`mount.ts` "" binding cache, `interact.ts` uppercase commit) reach HE, elktours and katie only on their own rebuilds.

## Open items for the next session
1. Resolve the 5b gallery test (above).
2. #3 listing + Edit path, in line with Justin's "one set of forms" direction.
3. Detail §5 #3-5 (HE hand-wired slugs → binds; DM parts and its SHARED_BLOCKS filter; promoting the "face + parts + live-piece" recipe into the kit). Held; packages/blocks has another session's uncommitted work.
4. Template drafts/revisions (a migration, needs Justin's go). Today a template save changes every gathering, post or piece at once.
5. The placement reason line waits for a sunjay block with an "auto" layout.
