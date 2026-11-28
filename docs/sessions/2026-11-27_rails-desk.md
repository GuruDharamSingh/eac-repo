# Rails & Desk, 2026-11-27 (handover)

Plan and board: `docs/open/RAILS_DESK_2026-11-27/` (PLAN.md has round 1 + round 2; BOARD.md has every lane's posts).
Everything below is in SOURCE on eris `~/eac`, type-checked, uncommitted, and **not live**. Nothing was rebuilt, migrated or seeded.

## What Justin asked
1. Continue the MCP/LMS/dock work. On sophia.elkdonis-arts.org, 74 of the 104 steps in the 21 `rails-*` test courses read "Not wired to the dock yet: X".
2. A space on /development for the rails, courses and action flows (editable), the codebase graph, and site-wide notes for Claude with a "latest" record.
3. Mid-session: "i would ideally not have a take me there step... actions done anywhere the dock is", "sophia first", then the refinement: on Sophia the dock opens Sophia's own lesson step and the step shows the form (no duplication); "take me there" is fine for layout-type work when it deep-links.

## What exists now (source)
- **Readiness ladder** per atlas capability: 0 Not built, 1 Place, 2 Checked, 3 In the dock, 4 Assistant (money caps at 2). `pnpm --filter @elkdonis/actions atlas:readiness` → `atlas/reports/readiness.{json,md}`. Today: 12 / 553 / 17 / 9 / 6 of 597.
- **Where** (`Capability.where = {mode: dock|place, why, deep}`) on the 76 rows the courses name: dock 41, place 30, 15 unclassified.
- **Form engine (one declaration, three renderings).**
  - `packages/actions/src/fields.ts` (ActionForm, FieldSpec) and `forms.ts` (the ACTION_FORMS registry: `forms-base.ts` + `forms-wave1.ts`).
  - `server/forms.ts`: `loadDockForm`, `performDeclaredForm`, `FORM_READERS`, `actionFormJsonSchema` for the MCP.
  - `packages/dock/src/declared-form.tsx`: `DeclaredForm`, `DeclaredFormStep`.
  - Confirm placeholders `{org}`, `{name}` … are filled, and a brace never shows.
  - Check: `scripts/check-forms.mts` (13 forms, 0 problems).
- **In the dock (level 3+)**: profile, store-front, ship-from, listing, org-details, org-email, pen-name, writing-start, plus wave 1:
  - `profile-photo` (only `/api/media/` paths, tightened by the PM);
  - `profile-sections`;
  - `pen-name-retire` and `pen-name-restore`;
  - `post-anywhere` (host door only; it publishes).
- **Place steps**: lms step type `place` ("Somewhere to do it", "I did it"); the seed writes a deep "Take me there" (path + `?surface=`, anchor) and the dock shows it through its own trail.
- **Sophia**: `<Dock>` mounted (`src/lib/dock-actions.ts`, `/api/actions/dock`, lesson links to Sophia's own steps). The lesson step page renders the same declared form (`src/lib/step-form.ts`, `components/StepActionForm.tsx`, `runDeclaredForm`). The workspace link `apps/sophia/node_modules/@elkdonis/dock` was made by hand (symlink, as pnpm does).
- **Seed** (`seed-rails-courses.mts`, dry run): 104 steps = task 32, place 54, gap 18 (was 20 / 74 not-wired / 10). No "Not wired" text anywhere.
- **/development**: tabs Rails (`/rails`, `/rails/[course]` trail editor storing drafts in `dev_versions` as `rail:<course>`, `/rails/nexus`), Map (`/map` atlas cards, `/map/code` workspace graph), Desk (`/desk` + the floating "Note for Claude" on every page, table `dev_notes` = migration 302, CLI `apps/development/scripts/desk.mts`). Data snapshot: `node scripts/refresh-rails.mjs` (run in a container). Preview passed signed in (fake-admin dev copy): all pages 200, no console errors; screenshots in `~/scratch/he-test/out-rd1/`.
- **Instructions**: `apps/development/CLAUDE.md` (desk protocol), a root CLAUDE.md "Development desk" section plus the Apps table rows for sophia and development, and `.claude/rules/desk.md`.

## Waiting on Justin (exact go needed)
1. **Migration 302** (`dev_notes`), applied alone: 301 and two others are pending for other sessions.
2. **Rebuilds**, in this order:
   - development (`eac-development`; coordinate with the Offer Templates session, board `docs/open/OFFER_SURFACES_2026-11-27/BOARD.md`);
   - sophia;
   - art-auction;
   - arts-collective. Its tsc has 4 errors in `packages/cms-ui/src/offer-surface/templates/body.tsx` (another session's work in progress), so its build fails until they fix them.
3. **Seed `--write`** of the 21 rails courses, AFTER the rebuilds. Before them, the old dock would see entries it does not know.
4. Wording waves `atlas/reports/wording-wave-02.md` (4 cards) and `-03.md` (5 cards).
5. Decisions:
   - user-theme-save: which colours/fonts a person may set;
   - may the dock change or remove people in an org (`org-person-role` / `org-person-remove` are appOnly);
   - publish-draft-post needs a thread-scoped course step with a pick (a behaviour change in lms + dock);
   - agent exposure for the new entries (none given).
   - Open from round 2: is a layout step's "open the editor as a pop-up over the page" wanted, or is the deep link enough?

## Next build-out
- Wave 2 of in-dock forms from the `where: dock` list (41): site copy (banner, welcome, hero, section copy, feed), booking (times propose, slots), orders (tracking), elktours artist rows, video (create, render, publish), org site create, email contacts.
- Fold Justin's trail drafts: `apps/development/scripts/rails-drafts.mts`.
- After 302: move the decisions above into desk cards (`desk.mts ask`).


## Update 2026-11-27 19:00 EST (after Justin: "go 302, rebuilds"; no pop-up editor for layout work, which will be templates and options later)
- Migration 302 was applied alone. The runner shows it applied with no drift. The desk CLI was tested end to end and its test row deleted.
- Live:
  - development `a_YKzRCGY83gqCdMv7lju` (18:34);
  - sophia `LQr_3Zyj4xjGBFMFZvhQm` (18:47);
  - art-auction `Q8X4Uts_gM1kISKS9nMYY` (18:53).
  - Edge checks: 200 on `/`, 401 on `/api/actions/dock` signed out.
- Sophia was seen signed in on a dev copy, as test participant A, with the overlay `~/scratch/dev-gate/sophia-dock-user.ts` on `src/lib/dock-user.ts` in the throwaway only (runner `~/scratch/ws-r4/run-dock.sh`). The dock shows the trail.
  - The step-page form is not seen yet. It needs an open task step with a declared form, and the rails courses only get those with the seed write.
  - A hydration warning on the lesson step page sits inside the page segment, not in the layout; likely pre-existing.
  - The test enrolment was deleted.
- **arts-collective is NOT rebuilt.** The Offer Templates session (system32-63) was refused permission to rebuild it and is asking Justin. Their work would ship with it, including `writing` removed from OFF_FEED_KINDS (18 public writing pieces become listable). It waits for one explicit go from Justin covering both sessions' work.
- Seed `--write` is NOT run. It waits for Justin (desk card bde0bed6).
- The desk holds 7 decision cards plus updates. The MCP direction is in `docs/open/RAILS_DESK_2026-11-27/MCP_DIRECTION.md`.


## Update 20:05 EST
- arts-collective `FYLNbsBm0g9TDa3vKybSG` is live (both sessions' work); tenant-smoke 9/9.
- Seed written: 21 courses, task 32, place 54, gap 18.
- That write (and the one on 11-16) double-encoded every jsonb value (`$n::jsonb` + JSON.stringify through `db.unsafe`). It took Sophia's course pages and arts-collective `/learn` down for about 15 minutes.
- Repaired on Justin's go. SQL and backup: `~/eac-backups/lms-dblenc-20261127/`. `lms_events` (append-only) was left as is.
- Seed fixed to `$n::text::jsonb`.
- Every page checked: 200.
- Next session: see "Next build-out" above, and `MCP_DIRECTION.md`. Read Justin's desk answers first (`desk.mts list`).
