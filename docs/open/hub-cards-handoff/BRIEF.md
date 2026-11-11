# Brief: Hub cards (Site Builder + Member Management), design to shared code (2026-11-08)

From the PM session (system32-08) for Justin. The handoff is in this folder. Read `README.md` (510 lines) first. Its copy is final, so use it verbatim. Then open `Member Management.html` and `Site Builder.html` offline; every frame is clickable. The sources are in `source/`. The original zip sits alongside.

## The job
Integrate these two cards into the hub **the shared way**: build each card once in a shared package, and have every host app draw it through the kit. Don't build a copy per app. Each card has three states: the collapsed card, the pop-up, and the detail page with tabs. Together they retire the matching `/manage` tabs. The work is straightforward, so the craft is in fitting it into what exists.

## Decided already
- **Serving (D-1): one shared card package, drawn by each host.** Read `docs/open/NETWORK_SERVING_ARCHITECTURE_2026-11-08.md`, § hub cards and `defineHubCard`. Cookies are host-only, so each host serves its own card data. Cards take a `site` object, which comes from `defineSite` in a custom app or from the DB in the shell.
- **The theme.** The design is drawn in the "Industry" design system (Barlow Condensed, square corners, `+` corner marks). Treat it as **one theme**: map its tokens onto our token layer, so each org's theme restyles the cards. The forms lead is using the same approach (`--frm-*` ← `--eac-form-*`). Look at `packages/studio/src/forms/contract.ts` and align with it rather than inventing a second scheme.
- **The /manage survey.** Every tab, what it really does, and where it goes is logged in `docs/open/PM_BOARD_2026-11-08.md` § "Lane B survey". Read it.

## What exists (explore first)
- **The hub system:** `packages/cms-ui/src/hub*`, `surface/` (SurfaceShell, SurfaceCard, the surfaces), and each app's `src/app/hub`.
- **Member Management circuitry:**
  - Shared service: `packages/services/src/org-people.ts` (`listOrgPeople`, `setOrgPersonRole`, `setOrgPersonListed`; the guard refuses self, owners and owner grants; every change queues a Nextcloud sync).
  - Roles: `org-membership.ts` (owner, guide, member, viewer).
  - Storage: `org-nextcloud-access.ts` plus `NextcloudAccessPanel` and `createNextcloudAccessRoutes`.
  - Arrivals: `ArrivalsTable` in `cms-ui/network`, from the `network_arrivals` table (signed-in SSO arrivals).
  - Visitors: `@elkdonis/analytics` `AnalyticsDashboard`.
  - **ifac is the most complete today**: `apps/ifac/src/lib/manage.ts`, which duplicates org-people, and `directory-admin.ts`.
- **Site Builder circuitry:**
  - Puck pages: `listPages` in `packages/page-builder/src/store.ts` returns only slug and updatedAt (no thumbnails, no notes).
  - Site copy: `org_site_sections`, which has **four separate editors** (sunjay and innergathering `SectionEditor`, ifac `SectionsEditor`, fourthway `SectionForm`). Unify them.
  - Theme: ifac `AppearanceCard` and elktours `site-style-schema.ts`.
  - Template pages with copy slots: fourthway's landing page is the clearest case.
- **Kit and smart components:** `docs/open/SMART_COMPONENTS_KIT_2026-11-08.md`, from lane D (system32-a1).

## Known tensions (flag them, don't decide alone)
- **"Owners can promote someone to owner, behind a confirm"** (design assumption). The shared guard in `org-people.ts` refuses owner grants, and sunjay's looser action is a known bug. **Keep the shared guard** and ask Justin before you change it.
- **Gaps:**
  - page thumbnails
  - per-page notes
  - the Profile tab's "what kind of org" identity, which replaces the `/center` org card form
  - nested pages
  - saved templates
  
  Most of these need new columns or tables. **Migrations need Justin's OK.** The architect proposed an `org_capabilities` table for the site profile flags. Coordinate with that and don't make a second one.
- **Collapsed-card variants.** The ledger is the chosen default; role bar and faces are alternatives. Build the default.
- **Small orgs** (5 or fewer) get a single-page layout.

## Team and communication
- You lead. You have **one Sonnet sub-agent**. Use it for the wide code sweeps and the mechanical port of the two detail pages, and review what it lands.
- **Talk early and often. Send short updates to the PM (`system32-08`)** when your plan is up, at each pass, and whenever you hit a decision. I relay to Justin and the other leads.
  - **system32-a1** (lane D: hidden-enneagram and katie) reviews anything touching stored Puck block ids and props. Ask it before changing page-builder.
  - **system32-cd** leads the publication forms. Share the theming contract and the host-link contract (`FormHost`) with it.
  - The **integration architect** is reached through me.

## Ground rules
- eris `~/eac`, branch `work/2026-11-08`.
- Commit by explicit path only, never `git add -A`. Other sessions have uncommitted work in progress.
- End commit messages with your model's attribution lines.
- **No deploys, no migrations and no container restarts without Justin's OK.** The PM runs the deploys.
- arts-collective builds need a temporary memory bump (`docs/reference/ops.md`).
- Pilot hosts: **ifac** for Member Management (it has the most real capability) and **sunjay** for Site Builder (Puck pages plus site copy). Prove each card in one more host via the harness or a render.
- First deliverable: `PLAN.md` in this folder, covering:
  - the package location and the `defineHubCard` shape
  - a per-card circuitry map (have / missing / replace)
  - which /manage tabs each card retires, per app
  - the passes
  - the migrations needed
  - your questions
  
  Message the PM when it's up.
