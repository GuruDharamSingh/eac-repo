# Team handover: editing landscape → one set of forms (2026-11-14)

- **Team:**
  - system32-d6, PM;
  - system32-fc, the detail worker;
  - system32-a2, the bold-strokes worker.
- Justin set this up on 2026-11-12. Agents check in with the PM, using the codeword he gave the PM.
- **Everything is in eris `~/eac`, uncommitted.** Para Theater (sunjay) is the only app rebuilt by this team.

Docs in this folder, in reading order:
1. `detail.md`: the component inventory (a = surface / b = sealed / c = plain) and the **surface recipe** taken from Forum and Next gathering.
2. `strokes.md`: spawn paths, the Puck ↔ direct-edit handoffs, the "block settings" doors, and the 5 moves.
3. `ROUND1.md`: rounds 1-2 per worker, item 5a, the pre-rebuild manifest, and click lists.
4. `ANOMALY1_REDIRECTS.md`: redirect loops and SSO.
5. `HANDTEST_2026-11-14.md`: Justin's publishing walk-through, one row per finding, with causes, lanes and sizes.
6. `HANDOVER_a2_2026-11-14.md`, `HANDOVER_fc_2026-11-14.md`: each worker's own state.

## 1. Justin's direction (end of 2026-11-14)
1. **The network shell stays for now.** If no page on the org's own site lists a piece of content, the content falls back to the shell, `<slug>.arts-collective.com`. No subdomain or shell work yet.
   - This parks hand-test #1, the per-org item-path resolver.
2. **The priority is ONE set of forms for the platform.**
   - A small **Studio package** whose forms also run in pop-ups.
   - The old forms are converted to the new ones.
   - The **surface UI's forms take on the Studio code.** Some of the surface look may stay, and the surface needs an overhaul.
   - **The design style is to be settled** across three things that look different today: Channel's quick-edit pop-up, the surface forms and the Studio forms.
3. **Next session:**
   - compact the context;
   - review the forms session Justin named (`local_6ba05738-…`; the full id is in his message to a2);
   - plan how to route the Studio package to the org sites, Channel and the surface UI.

**Forms, the starting point.** Answered by the forms-body session ("Studio form design versioning"). Details are in `HANDOVER_a2_2026-11-14.md` "Answered by the forms-body session"; the plan is `docs/open/publishing-forms-handoff/PLAN.md`.
- **Owners:**
  - the forms body: the "Studio form design versioning" session;
  - the shell, chrome, AfterPublish and StudioApp: the "Studio UI mockups and layout" session, which has been told about a2's share-link change.
- **Today:**
  - No old form has been removed.
  - The new Gatherings, Artwork and Offerings forms run as tabs on arts-collective `/studio`.
  - The only mount off arts-collective is katie `/channel`, the quick tier, as a page rather than a popup.
  - HE `/publish`, sunjay and ifac are still on the old compose.
- **Missing for a site popup:**
  1. a cms-ui custom surface that wraps FormShell;
  2. shared server actions in services, with org checks;
  3. a per-site viewHref;
  4. framed-protocol posting;
  5. the quick-tier editor choice.
- **Their proposal (for Justin, not started):**
  - one package with three FormShell hosts: Studio focus, a site popup and the Channel quick sheet;
  - ComposeSurface keeps its catalogue and hands over to the new forms kind by kind, gathering and offering first. That fixes hand-test #3 at the root.
  - The style is to be settled with Justin across the three hosts.

## 2. Live: Para Theater build `233XY5Fv4hG5pMtcRaV9Z` (2026-11-14 ~11:10 EST)
- **Backup and checks.** The backup of the build before it is `~/eac-backups/next/sunjay-20261114-1104.tgz`. Signed-out edge checks were clean (`ROUND1.md`, "fc, round 2").
- **Canvas-first.**
  - `/studio/<slug>` is the house canvas, and whole-page Puck is at `/studio/<slug>/blocks`. `/canvas` redirects.
  - `/manage/builder` Edit opens the canvas, with a quiet Blocks link beside it.
- **Inception.**
  - Settings… opens the block alone in Puck over the canvas or the popup, and Edit look opens direct-edit over Puck.
  - One layer stack: `Symbol.for("eac.layer-stack.v1")`. Esc closes the top layer only. Dirty layers ask before closing, and the selection comes back.
  - A look applied through every layer is one undo step.
- **The event page on its surface.** 122 parts on 13 sunjay blocks: event ×5, offering, services ×3, writing ×3, notice.
- **From what?** now covers person, opens, record, service, piece, guide and gathering.
  - "Which gathering" on Next gathering: standing (default) | next | a picked gathering.
  - Profile card follows the site's guide.
  - Piece chooser.
- **Layout door.** "Edit this page's layout" on posts, gatherings and pieces opens the template with `?thread=`/`?piece=`, drawing THAT record.
  - The `post-detail` template exists. Unpublished, posts draw exactly as before.
- **Also live:**
  - designTools (multi-select, handles, snapping);
  - Site style (theme plus header and footer looks; visitors unchanged until saved);
  - rich text in Puck list rows.
- **Not yet used signed in by Justin.** The hand-test lists are in `ROUND1.md`.

## 3. In source, waiting for rebuilds (each needs Justin's yes)

| Change | Ships with | Tests |
|---|---|---|
| 5a: Tab never lands inside blocks while editing (`direct-edit/src/canvas/quiet-focus.ts`); on by default on every canvas host | sunjay, HE, innergathering (+ any canvas host) | drive-inception 64/64 |
| 5b, **partly done**: editing guards on the gallery and Talk room (`blocks/data-blocks.tsx`, `event-blocks.tsx`); every other view audited, none needed | sunjay | drive 146/147. **One FAIL, "published gallery auto-advances", is unresolved** (a wrapper regression or a test selector). Resolve it before 5b ships |
| #2: shareable absolute link after publishing (`studio/src/forms/shell/share-link.ts`) | arts-collective (+ studio bundlers) | 7/7 |
| #6: hub popup fixed in the window; no View on template rows (`packages/hub`, sunjay hub-card-host) | sunjay, ifac, arts-collective | drive-hubpop 11/11 |
| #7a/b: IFAC cards-2 Forum card opens the surface; IFAC thread popups get "Open page" | **ifac** | tsc 0, light pass |

**The next sunjay rebuild carries:** 5a; 5b, once its FAIL is resolved; #6, including a2's post-build `hub-card-host.tsx`. Nothing is mid-edit (fc and a2 both stopped at clean points).

## 4. Waiting on Justin (asked, not answered)
- **The IFAC rebuild** for #7a/b.
- **Anomaly 1** (`ANOMALY1_REDIRECTS.md`). It is not caused by our build.
  - (a) NPM **Force SSL** on proxy hosts 29 (paratheater), 37 (pottery) and 26 (market); check 27 and HE. This ends the loop, and needs no code.
  - (b) Justin clears site data for those hosts.
  - (c) Add the missing GoTrue `ADDITIONAL_REDIRECT_URLS`: pottery, hiddenenneagram (+www), books.elkdonis-arts.org. Then restart GoTrue (a few seconds of downtime).
  - (d) Harden the shared sso-proxy: http→https first, plus a one-hop loop guard. Needs every site rebuilt.
  - (e) A `www.paratheater` redirect host.
  - The Google console needs no change.
- **#4:** Para Theater has no page listing its writing. The fix is content: `/manage/builder` → New page → a Journal block. Justin, or an agent once he names the page.
- **Template drafts and revisions** (`page_revisions`): a template save goes live on every record at once. Needs a migration.
- **Rolling inception out to HE / katie / elktours** (4 lines each): after Justin has clicked through sunjay.

## 5. Board (not started)
- **Forms lane (now the priority, see §1):**
  - #5 "Posting as" for form kinds. Org identities exist (owner or guide, plus `profile_user_id`) but only the Writing room lists them.
  - #8a artwork library: an org / my files switch.
  - **#3, sunjay offerings (not started, fc).** `/manage/content` knows only post and gathering; the site's Edit opens an empty old service compose; the hub compose has no service form because sunjay never sets `hasServices`.
    - fc traced the form paths: HE's `service-kind.tsx` in the `studio:compose` popup, and `docs/open/publishing-forms-handoff/PLAN.md`.
    - So #3 is likely a listing plus a link until a Studio services form exists. It belongs inside the one-forms plan.
- **Editor:**
  - the HE slugs → `binds:`;
  - DM parts on its 14 blocks, plus filtering its unresolved profile/store blocks;
  - promote "face + shared parts + live-piece twin" into the kit (packages/blocks: another session's uncommitted record-parts work is there, so coordinate first);
  - the placement reason line, once a sunjay block has an "auto" layout.
- **IFAC:** full detail-page parity (toggle, event template, layout door). It is L, or M once `defineRouteTemplate` exists.
- **Other:**
  - #8b, the surface forum category tree (data exists: `org_feeds.parent_slug`);
  - #8c, ThemeStyle on the shell's item pages.
- **Parked by Justin:** #1, the per-org item-path resolver (`org-url.ts:36` builds `<slug>.<network>` on purpose).

## 6. How the team worked (keep for next time)
- **Two workers with file lanes**, written into each brief. Crossing a lane means messaging the owner and copying the PM. Fixes found in the other's lane go to the owner, not edited directly; this worked twice, for mount.ts and interact.ts.
- **Source only by default.**
  - Rebuilds are batched, with **one builder**.
  - Back up `.next` first, with no output into the tar stream.
  - Build with `NODE_OPTIONS=--max-old-space-size=4096 NEXT_BUILD_CPUS=2`; the 11-11 sunjay build ran out of heap.
  - Signed-out edge checks before and after.
- **A pre-rebuild manifest** (ours vs other sessions' uncommitted files) before asking Justin for a yes.
- **Justin's yes for a production rebuild must reach the PM's session directly.** The permission check refuses a relayed yes.
- **Harness first:**
  - `packages/direct-edit/harness/frankenstein/` (inception, popup, pkg, look, rows, hubpop);
  - `harness/event-detail/`;
  - `harness/stack-drift.cjs`.
  - Scratch: `~/scratch/inception` (a2), `~/scratch/fc-r1` (fc).
- **eris gotchas:**
  - `sudo -n docker`.
  - The SSO proxy skips curl user agents; use `hops.sh`.
  - Shell heredocs mangle apostrophes, so write scripts locally and scp them.
  - Run type checks in a throwaway `eac-dev` container, not the live one.
