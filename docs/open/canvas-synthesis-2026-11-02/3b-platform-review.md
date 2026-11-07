# Platform review of the synthesis (2026-11-02)

Chief Platform Officer, reviewing `3-synthesis.md`. Recovered from the workflow journal on 2026-11-04 after a reboot cleared the scratchpad. Verdict: go-with-changes.

## Blocking

### blocking 1

- Claim: Stone 8 'first real site' is one stone (3-synthesis.md:498-509).
- Problem: It holds about ten deliverables and is the first production run of five mechanisms at once: portal under a real App Router [U], morph on a host, stored subject, sidecar writes, and a new public write route. A fault there is ambiguous between them. That is the reason section 9 gives for delaying Puck 0.24, and it breaks the standing 'one firm stone' direction. Stored names also freeze at this point (section 13).
- Evidence: 3-synthesis.md:500-503 (scope), :389 (ambiguity reasoning), :576 (names freeze); 2-specialist-2.md section 14.2
- Change: Split it. 8a, no data: sunjay dependency, box blocks, /studio/<slug>/canvas, Edit button, CanvasOutlet, fence, MorphMark host option, ears.ts; hand test on /next-session with non-data blocks. 8b, read-only subject: services/subject.ts alone, R-b, scopedMeta, /api/live/views, live-countdown, live-event, and the existing pt-event-* blocks scoped by a box. 8c, writes: live-rsvp, live-discussion, /api/live/reply, one RSVP on a thread the developer names.

### blocking 2

- Claim: The plan delivers hands-on editing for artists (mission, R1).
- Problem: By the synthesis's own recommendation no artist other than the developer may edit a real page until page_revisions exists, and that work has no stone, scope or done-when. R-c is also a precondition with no slot. After stone 8 no stone wires another host's edit mode, stone 10's 'per-host' canvas names none, and D3's rejected option holds 27 of 31 stored rows. Individual artists' own pages (user_pages on ArtDirect) have no sidecar key and no stone. As written, the plan ends with the developer editing one new page on sunjay.
- Evidence: 3-synthesis.md:551 (D2), :569 ('no migration in stones 1 to 14'), :421 (R-c), :553 (D3), :289 (sidecar is site_config only); read-only SQL: 31 puck rows on 3 orgs, 3 user_pages rows; page_revisions absent (to_regclass null)
- Change: Add a named stone with a done-when for what must exist before the first artist: either page_revisions (one migration) or an explicit decision that dog-ears are enough. Put R-c in it. Add a roll-out stone naming hosts in order. Name the first artist and the site they test on, and make that person's hand test the exit of the stone.

### blocking 3

- Claim: R7 context 1 and R8 are covered: 'Works on the page being looked at; declared sections on code-built pages' (3-synthesis.md:331) and R8 by stones 4, 5, 9.
- Problem: No stone builds editing on code-built pages. Stone 8 says 'Edit button on Puck pages'. Every public page on the first host is coded: sunjay /, /about, /community and /publications hold 12 data-edit-section markers, and sunjay has no direct-edit dependency, so the markers are inert. The IFAC series named by the developer stays code; stone 9's only outcome on IFAC is identical HTML, and packages/series-site and apps/ifac/src/app contain no markers. R8 borrows proportions and behaviour but exposes nothing to edit. The mechanism that would do this is the only direct-edit path with a real signed-in production save (page-edits:home).
- Evidence: 3-synthesis.md:331, :503, :513; grep -c data-edit-section on apps/sunjay/src/app pages = 4, 3, 4, 1; grep of packages/series-site/src and apps/ifac/src/app = 0; SQL row page-edits:home; apps/innergathering/src/lib/page-edits.ts, components/landing/EditPageButton.tsx; docs/open/ELKTOURS_CONVERGENCE_2026-11-02.md:93-97,134
- Change: Add a small stone right after the gate and R-a: copy innergathering's visual-mode host files to sunjay, mark the sections of SeriesPage and SeriesWeekPage, and enable it on sunjay and IFAC series pages. It needs no Puck work and no migration, and it is the first thing an artist can use on a real page. State its known limit: edits are keyed by DOM position, so a restructured section can orphan them. Coordinate with elktours item 6, which plans the same files.

## Should-change

### should-change 1

- Claim: 'Seen as' shows what a lower role sees: 'a preview may lower a role, never raise it' (2-specialist-2.md section 6.1).
- Problem: The snippet caps role but still passes the real userId and isGlobalAdmin. canViewThread returns true on its first two lines for a platform admin or the thread's author. So 'Seen as: Visitor' draws a private thread for exactly the people likely to do the hand tests, and the page reads as safe when it is not.
- Evidence: 2-specialist-2.md:454-456; packages/services/src/thread-audience.ts:91-93 (read)
- Change: When viewAs is set, pass { userId: null, role: capped, isGlobalAdmin: false }. Add a fixture where the viewer is the author and a platform admin, and assert hidden.

### should-change 2

- Claim: 'Data blocks draw from sample(), never stored' (stone 1) and thread privacy rules (section 5.5).
- Problem: Detach copies the text the canvas drew into own blocks (tree-editor.ts:481, adopt.ts wordy branch), and section 5.5 does not mention it. Sample rows detached and saved become fake public content, which contradicts stone 1's claim. At stone 8, a draft or private thread drawn with 'Seen as: Editor' (S2 section 5.1), or an editor-tier /api/blocks row, freezes into a public document on one menu click. The data-bind tokens of S2 section 8.3 cover marked fields only; unmarked text 'freezes as it does today'. Today's innergathering feed route is PUBLIC-only, so the gate rebuild itself does not expose this.
- Evidence: packages/direct-edit/src/canvas/tree-editor.ts:481-493; packages/direct-edit/src/canvas/adopt.ts:88-92; 2-specialist-2.md:421,545; apps/innergathering/src/app/api/blocks/thread-feed/route.ts:6-10
- Change: Stone 1: refuse or warn on Detach for a node drawing sample rows. Stone 8b: Detach redraws at Visitor tier with Sample off before adopting, or is refused when the effective audience is not everyone. Add both to section 5.5.

### should-change 3

- Claim: Stone 8 done-when: 'no talkUrl, meetingUrl or passcode in any signed-out page' (3-synthesis.md:509; same grep in S2 section 16).
- Problem: This cannot pass today. Through the edge signed out, /gatherings/qi-gong-and-alchemical-yogas holds the key talkUrl 5 times and meetingUrl 5 times, with null values. /gatherings/ritual-theatre-lab holds zoom.us 6 times, because the coded thread page prints join links to anyone by existing policy, which S2 section 7 states. A key-name grep fails on correct pages and misses real leaks.
- Evidence: curl -sk --resolve paratheater.arts-collective.com:30022:127.0.0.1 on both paths, 2026-11-02; apps/sunjay/src/app/[feed]/[slug]/page.tsx:179-184,205-212; 2-specialist-2.md:500,995
- Change: Assert values, not names: on pages using live-* or the event template, no non-null talkUrl or meetingUrl for a thread fixture that has one, and no /call/ token. Exclude the coded thread page explicitly, and ask the developer separately whether that policy stands.

### should-change 4

- Claim: Stone 5 is one stone, with done-when 'State Cancelled flips all four' and 'the count moves in another block' (3-synthesis.md:472-480).
- Problem: Its scope is a package, four blocks, the Data section, the picker, tokens, Try it, two menus and the fence, so it is not firm. Two done-when items contradict the spec. live-discussion reads only replies, title, href, and pickView enforces that, so it cannot flip on cancelled. No block in the set other than live-rsvp reads rsvp, so no 'other block' has a count. Stone 4 gets a mock-up before wiring, but the Data section has no reference image and no mock-up, though the standing direction compares UI literally.
- Evidence: 2-specialist-2.md:555-558 (reads table), :14 (reads enforced); 3-synthesis.md:178-188; harness/reference has no Data section (rowlayer4.png, 'text chosen...' read)
- Change: Split it. 5a: subject, picker, countdown, event, words tokens, read-only Data section. 5b: RSVP, discussion, Try it, State, Seen as, fence log. Mock the Data section first. Rewrite the done-whens: three pieces flip on cancelled and the discussion stays; the count test uses two RSVP pieces or the Now row.

### should-change 5

- Claim: The popup has 'a phone-width switch', and it is the mitigation for 'a look fine on desktop may misbehave on a phone' (3-synthesis.md:159, :582; stone 10 'check at phone width').
- Problem: A same-document stage narrows width only. Viewport sets page.style.width and has no iframe. blocks.css has 7 width @media rules, the pt-banner file has 4 and tour/blocks.tsx 13 Tailwind breakpoint utilities, and the morph font guard uses vw. None of these respond to a narrowed stage; only the @container rules do. The switch would show a false phone view for exactly the Tailwind monoliths R6 names.
- Evidence: packages/direct-edit/src/canvas/view.ts:44-48; grep packages/blocks/src/blocks.css lines 351,994,1173,1514,1575,1946,2019; grep sm:|md:|lg: in apps/sunjay/src/blocks/layout-blocks.tsx and apps/elktours/src/blocks/tour/blocks.tsx; 2-specialist-1.md section 5.3
- Change: Choose one and state it. Call it 'Narrow' and say what it does not test. Or draw the phone view in an iframe with the same CSS for preview only, accepting no React context. Keep the risk open in section 13 until a real phone is checked at 8a.

### should-change 6

- Claim: live-discussion renders replies safely: SubjectReplies.items[].html (2-specialist-2.md:143).
- Problem: The spec marks only bodyHtml as sanitised. listReplies returns the stored column as is (contentHtml: r.content), and the threads rule requires sanitising before render because renderers use dangerouslySetInnerHTML. SeriesWeekPage:290 is the source being copied and does not sanitise. Replies also arrive by Nextcloud sync, not only through textToHtml. The new block sits in SHARED_BLOCKS on public pages.
- Evidence: packages/services/src/forum.ts:735; packages/services/src/forum-write.ts:65-77; packages/series-site/src/pages/SeriesWeekPage.tsx:290; .claude/rules/areas/threads.md (sanitise line)
- Change: Run sanitizeRichText in loadSubjectView for replies and state it in S2 section 2.3. Test through the sanitiser, per .claude/rules/03-verification.md.

### should-change 7

- Claim: Reads are protected by one loader and the picker offers this org's threads (2-specialist-2.md sections 6.1, 12.3).
- Problem: subjectCandidates filters by org, kind and status only, so titles of 'Only me' and owners-only threads reach guides through /api/live/candidates, which canViewThread would refuse. The loader has no kind filter, so a hand-edited document can name a document, wiki_page or writing thread, and postReply has no kind check, so reply.post could reach them. The threads rule treats documents as sensitive. The picker also omits post, the most common published kind, so 'a discussion lower down' cannot attach to one.
- Evidence: 2-specialist-2.md:813, :443-451; packages/services/src/forum-write.ts:107-128,161-176; .claude/rules/areas/threads.md (documents line)
- Change: Apply canViewThread with the editor's real role to candidates. Give the loader an allow-list of kinds, the same as the picker, returning hidden otherwise. Ask the developer whether post belongs on that list.

### should-change 8

- Claim: The first controls land while 'the six existing RSVP implementations stay until their hosts are next touched' (3-synthesis.md:283).
- Problem: That makes seven, with no retirement rule. Sunjay would offer pt-event-rsvp and live-rsvp on one thread, plus SeriesRsvp, bridged by window events. The mission asks for the mature code's current coherence. The cascade could be proved on real data with the existing pt-event-* blocks: S2 section 3.3's scopedMeta already lets a box scope them, with no new write route. LiveRoutes.style 'status-body' exists only for IFAC, which has no Puck page.
- Evidence: 2-specialist-2.md:212, :880, section 9.1; 1-cpo-survey.md section 4
- Change: Stone 8b proves the cascade with pt-event-* plus live-countdown. Write a per-host retirement rule, for example hide pt-event-rsvp from Add when live-rsvp ships. Drop status-body until IFAC has Puck pages.

### should-change 9

- Claim: D4 offers the first signed-in run after stone 1 or after stone 5 (3-synthesis.md:555).
- Problem: The stated reason, that every stone before the run adds source on an unverified base, argues for running it before stone 1, an option D4 does not offer. Nothing blocks that: 0 migration files are unapplied. Two runs the risk table schedules 'before stone 8' have no owner stone: the fence log with every block, and next dev with a stored morph.
- Evidence: 3-synthesis.md:555, :494-496, :578, :586; comm of packages/db/migrations against app_schema_migrations = empty, 2026-11-02; innergathering BUILD_ID 2026-11-02 19:36 UTC
- Change: Add option 'now, before stone 1' and recommend it. Assign the two orphan runs to the gate or to 8a's entry conditions.

### should-change 10

- Claim: Dog-ear is cheap: 'Actions, in the popup's Saved tab' (3-synthesis.md:300).
- Problem: The developer asked for 'just dog earing it'. As specified it needs opening the popup, the Saved tab and a name. For a look applied on the page itself, the cheapest gesture is missing.
- Evidence: 3-synthesis.md:300; 2-specialist-1.md section 8.2; mission text
- Change: Add Dog-ear to the right-click menu and thin bar with an automatic name ('Version 3', already specified in S1 section 2.3), written at once. Keep the Saved tab for listing, Use and rename.

### should-change 11

- Claim: The design is sized for artists who want quick hands-on editing.
- Problem: Several parts are heavier than the first round needs. The Data section has 9 rows, including Reads, From and On page, on every piece. Artists get Try it, State and Seen as menus and a write log. There is a second canvas for Compare and a 30-day 'Removed blocks' list. morph.rows has key remapping for 'Just this one'. SubjectPick has { at } and { dep }. The spec carries 26 subject fields, 15 state ids and 10 note reasons.
- Evidence: 3-synthesis.md:178-188, :300; 2-specialist-1.md section 4.1; 2-specialist-2.md sections 2.2-2.4
- Change: First round: About, Which, Seen by and Now visible, the rest behind the section's plus. State and write log in the lab or behind a plus. Compare is the field list only. Defer Removed blocks and per-row looks until the developer asks. References are thread and next, with weeks by number.

### should-change 12

- Claim: Stone 1 is firm and hand-testable on the test page (3-synthesis.md:423-449).
- Problem: It is small and needs no migration or rebuild, but the hand test has gaps. Step 4 needs a wall with pictures and captions, yet no seed document is specified; dataOf skips declared props, picture-wall draws null with no pictures (:242), and rows are not editable until stone 3, so Add then Picture wall is a dead empty box. The sealed branch of context() has no code value, so the Code tab, which the reference shows and the developer will click, is undefined. The test-page wrapper exists only in the non-durable scratchpad. Stone 2's window.published is a console call, not a hand test.
- Evidence: packages/blocks/src/blocks/picture-wall.tsx:242; 2-specialist-2.md:206; packages/direct-edit/src/canvas/tree-editor.ts:303-311; scratchpad artifact-files/.../index.html; 3-synthesis.md:458
- Change: List the seed document in stone 1 (hero, wall with data-URI pictures and captions, FAQ). Say what Add shows for an empty wall. Show the node's props as read-only JSON in Code, which also starts on 'confirms the config'. Keep the wrapper as harness/test.html. Replace window.published with a 'Show as published' button.

### should-change 13

- Claim: Stone 13 done-when: 'signed-out HTML per host is unchanged' (3-synthesis.md:539).
- Problem: Each rebuild deploys all uncommitted work, so an HTML change cannot be attributed to Puck. danamccool's build is dated 2026-10-04, so its rebuild ships 29 days of tree to the largest stored user, a live client site. The cost section lists this rebuild without saying so.
- Evidence: stat of /app/apps/danamccool/.next/BUILD_ID = 2026-10-04 18:13 UTC; 3-synthesis.md:391-394; .claude/rules/00-working-style.md
- Change: Compare only the Puck-rendered region, or take the baseline from a same-tree rebuild on 0.23 first. Schedule danamccool as its own step, with screenshot compare of its 27 rows.

### should-change 14

- Claim: R1: Puck and direct-edit become one way of editing.
- Problem: After stone 8 a sunjay page has two editors. The existing link says 'Edit this page' and goes to /studio/<slug>, which is Puck's editor with no parts, dog-ears or subject controls; the canvas is a separate route. danamccool's React fields need Puck's panel. The synthesis says Puck's editor 'must keep opening every document' but not which door an artist gets or when Puck's editor stops being offered.
- Evidence: apps/sunjay/src/lib/puck/render.tsx:67; apps/innergathering/src/components/studio/CanvasEditor.tsx (blockEditorHref); 3-synthesis.md:91; 2-specialist-1.md:621
- Change: State the rule: on a wired host, Edit opens the canvas, Puck's editor is reached only through 'Edit its settings' for fields the panel cannot draw, and a host drops the link when none remain.

## Note

### note 1

- Claim: Stone 5 needs 'one coordinated install' listing utils in direct-edit and node-html-parser in blocks.
- Problem: The list is short. page-builder has no @elkdonis/utils dependency, but S2's adapter calls pickView and savePage calls cleanSubject. utils needs a ./subject export. The parts smoke is scoped by section 6.4 as an authoring check but cannot run before this install. ELKTOURS_CONVERGENCE Round A plans its own coordinated install, which 'touches every container's node_modules'.
- Evidence: packages/page-builder/package.json dependencies; packages/utils/package.json exports; 3-synthesis.md:478; docs/open/ELKTOURS_CONVERGENCE_2026-11-02.md:161
- Change: Merge into one install with the elktours list and add page-builder's line. Say the parts smoke starts at that install; harness runs cover parts until then.

### note 2

- Claim: Delivery adds only an inert marker (3-synthesis.md:141-143).
- Problem: The plain font link stays in place after the block (verified in the probe: link in the slot div, next sibling a template), so a morphed block with a font is no longer :last-child. blocks.css has rules on that at :423 and :1038, and :848 for prose bodies. Small spacing change on that block only.
- Evidence: team/probes-cpo/page.html; packages/blocks/src/blocks.css:423,1038
- Change: Write the font link before the template marker, or gather fonts per page. Add to the screenshot compare.

### note 3

- Claim: Media privacy (the synthesis does not mention Private/ paths).
- Problem: No new leak was found: morph refuses url(, dog-ears are never read on a public path, and a Private path is not served to anonymous visitors. But the guard is isPrivatePicture in shell.openPicture only. cleanBoxDoc's safeSrc does not check it, and a React field control mounted through fieldControls bypasses it. The result is a picture the editor sees and visitors do not, and Seen as cannot reveal it because the browser holds the editor's cookies.
- Evidence: packages/direct-edit/src/canvas/edit-shell.ts:16-20,116; packages/direct-edit/src/block/bind.ts:66-71; apps/innergathering/src/components/landing/page-picture-chooser.tsx
- Change: Route stone 3's image and rows picture columns through shell.openPicture, require the same check in fieldControls for image kinds, and add one line to section 5.5.

### note 4

- Claim: cleanMorph refuses click traps (2-specialist-1.md section 6.2).
- Problem: Rule 1 keeps pos 'relative' with x and y (bounds -400 to 1200), and rule 2 filters css text only, so structured sx and sy (0.2 to 3), tx and ty still emit transform. An invisible link can still move or grow. Harmless while only org editors write; it matters if D3 option C or member pages come later.
- Evidence: packages/direct-edit/src/block/style.ts:52-58,116-143
- Change: Drop structured pos, x, y, sx, sy from morphs on any host where members can save, and record the limit.

### note 5

- Claim: Stone 13 includes renderFieldsFor(def) so hosts on Puck's panel get groups (3-synthesis.md:383).
- Problem: This is new work in Puck's own editor, which the standing direction says not to polish. R6 asks for the upgrade and the options model, and the options model is already answered by the custom panel.
- Evidence: 3-synthesis.md:383,387; standing direction in the computed task
- Change: Keep the package upgrade in stone 13. Make renderFieldsFor a separate item the developer opts into.

## Claims verified

- Server-rendered output is achievable as described, up to Next's router: real Puck 0.23.0 Render and resolveAllData under Next 16.1.6's vendored Flight, Fizz and hydrateRoot in jsdom, NODE_ENV production and development, plus one row-by-row delayed stream with pending Suspense boundaries. Markers stayed adjacent to block roots, including in slots, around a client component and after a late boundary. Hoisted styles coalesced into head (late one streamed separately, none in body), two nodes with one morph shared one scope, 0 recoverable errors, 0 console errors, client click worked. Probes: /tmp/claude-3003/-mnt-pool1-home-guru-eac/7236b31a-7646-4e28-8b29-be60fa6c575f/scratchpad/team/probes-cpo/. MorphMark there is hand-written to S1 section 5.5's shape, not the patched config. Not run: Next's router layer, a real browser. This narrows the unknown at 3-synthesis.md:578.
- Not re-run by this review: S1's Chromium cascade matrix, S2's portal probe, check-types baselines (blocks baseline is unknown), Puck 0.24 dist.
- Adapter shape holds (read packages/page-builder/src/config.tsx:433-462): Interactive strips puck, Styled and GenericStyle wrap inner, so S1's innermost wrap fits.
- RESERVED_PROP_NAMES and the module-load throw hold (packages/blocks/src/registry.ts:79,86-91). No declared prop named morph, subject or live in packages/blocks, page-builder, series-site, direct-edit or apps/*/src/blocks and lib/puck (grep). 0 puck: rows hold a live key (SQL). contact-form's subject is a form field, not a prop.
- Sidecar key holds: listPages and both danamccool hud-actions queries use LIKE 'puck:%' (store.ts:117; hud-actions.ts:62,148). 0 puck- keys today. site_config grants only eac_tenant and postgres, anon has none; tenant_isolation policy present (SQL). Reader grep found no public reader of all keys on a live app; apps/elkdonis-arts-collective/src/app/api/admin/site-config/route.ts:35 lists every key but the app is retired and the route is admin.
- page_revisions and org_blocks do not exist (SQL to_regclass null).
- data-event.ts:41 checks status or canEdit only; render.tsx:64 passes no metadata to Render; getThreadById is org-scoped (apps/sunjay/src/lib/data.ts:299-306). The stored-reference hazard and the fix are as described.
- canViewThread signature and semantics read (packages/services/src/thread-audience.ts:91-103). postReply's gate applies visibility, thread min_role and feed role, and textToHtml escapes (forum-write.ts:65-77,107-128).
- TreeCanvas.tsx:63 finder would mark a template without the one-line change; mount.ts:46 uses createRoot and flushSync (read).
- clickthrough.ts:19 and :191-193: isUi returns before held, so the single data-de-live attribute approach works as S2 section 10.3 says (read). Not run in a browser by this review.
- cleanOwn rebuilds own nodes from a whitelist and sealed nodes pass through (puck-tree.ts:177-215), so subject on a box needs the stated three lines. Morph is not cleaned at save today.
- safeDecls defect holds by reading (style.ts:88-102: no comment or bracket check, value.slice at 160, patch.ts:102 joins into one stylesheet). Refusing '!' is safe: 0 site_config rows contain !important (SQL).
- look-prop defect holds: faq.tsx:41 and apps/sunjay/src/blocks/layout-blocks.tsx:398 declare look; menuTools reset deletes props.look (tree-editor.ts, runTool 'reset').
- Panel facts hold: TabId includes tweaks and saved, PanelContext has tweaks and saved, Control has no text or textarea, toggle has no case (panel.ts:41,103-108,348-406; schema.ts).
- Stone 1 needs no migration, no production rebuild and no install, provided the harness imports contract.ts by absolute path as test.ts already does for blocks. harness/test.ts already bundles SHARED_BLOCKS; eac-dev, zenika/alpine-chrome and node:24-alpine images are present; adding SectionId values affects only direct-edit (grep).
- No collision with OFF_FEED_KINDS: the plan adds no thread kind (grep of the synthesis). No retired app is used (grep for inner-gathering, elkdonis-arts-collective = 0).
- Elktours held paths are not touched by stones 1 to 13 (ELKTOURS_CONVERGENCE lines 6-7 against the stone scopes). No file in apps, packages or docs changed in the 60 minutes before 21:09 EST on 2026-11-02 (find). packages/page-builder has another session's uncommitted edit in editor.tsx and package.json, not in config.tsx (git diff --stat).
- All migration files are recorded as applied (comm against app_schema_migrations, empty result); CLAUDE.md's lines on 174, 176 and 188 are stale. Gate has no migration dependency.
- @puckeditor/core 0.23.0 exact pin in 9 package.json files (grep). Port 3022 unclaimed in compose files and on the host (grep, ss, docker ps).
- Routes hold: /next-session is reachable through apps/sunjay/src/app/[feed]/page.tsx renderPuckPage when no feed has that name; apps/sunjay/src/app/layout.tsx:31 is force-dynamic, so per-viewer output is not cached on the first host. Other hosts were not audited.
- Reference claims hold: rowlayer4.png shows Properties, Code, Tweaks, tree, declarations, From group with plus; 'text chosen...png' shows Fill {{spot}} and the Size, Layout, Link, Text, Appearance order. S1's part-selected.png matches that panel shape; neither reference has a Data section or popup.
- Elktours is not a Puck-page collision today: 0 stored rows per survey, and TourMain as last is consistent with ELKTOURS_CONVERGENCE.

## Requirements not covered

- R7 context 1 and R8: editing on code-built pages, including the IFAC series pages and sunjay's public pages. Named at 3-synthesis.md:331, no stone builds it.
- Mission and R1: a stone for what must exist before any artist other than the developer edits a real page (D2 option B or an explicit decision, plus R-c). Recommended in text, not scheduled.
- R1 and R6: roll-out beyond sunjay. No stone wires danamccool (27 of 31 stored rows), art-auction, or individual artists' own pages on ArtDirect (user_pages, no sidecar). Elktours waits for stone 14.
- R1: which editor the Edit button opens on a wired host, and when Puck's editor stops being offered.
- R7 context 3: 'review of others' is a per-entry checklist in the lab; where a review outcome is recorded is not specified.
- R2: a phone view of a component in the popup is named but cannot be delivered as a same-document stage for @media and Tailwind blocks.
