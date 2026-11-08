# Prompt for the implementing agent

You're implementing the first pass of **Channel**, a new surface in the Elkdonis Arts Collective monorepo. The design handoff is in `docs/open/channel-handoff/` (move it there if it isn't already). Read `README.md` in that folder end to end, then read the root `CLAUDE.md`. Open `Channel.dc.html` in a browser whenever you need to check a screen. The newest round is at the top: 3a–3c, then 2a–2d, then 1a–1e.

## What this is for

Channel is where an artist (and the orgs they belong to) can see and steer everything they make, and everywhere it has gone: their page, the org's site, the market, Instagram, Facebook, the newsletter, and later other outlets. It starts to bring the hub console and the Studio together into one console. The feeling we want is **control and flow**: you can move between the website, socials and planning without losing your place.

The organising idea is a **natural progression** for each piece:
1. A **gap** (a piece isn't on an outlet yet) becomes a **suggestion**.
2. The suggestion is placed in a **slot**. Slots are opened by **routines**.
3. It becomes **scheduled**, then **published**.
4. **Follow-ups** come after: a video, a longer piece of writing, a live.

Keep every screen honest about this progression.

Principles from the owner, in priority order:
- **Artist first, org alongside.** Show artist and org content together. Tag every post with the identity it went out under. The artist's own publishing identity matters more than the org's.
- **Three weights of editing.** Each has its own place; don't merge them.
  1. The **quick sheet** fills a slot or a gap from wherever you are, and can expand to every outlet.
  2. **New post** cross-posts work that already exists (1d).
  3. **Content** is the serious Studio CMS. New long writing opens in the writing room's focus mode: a blank page, plus a Blocks switch (Puck).
  4. **Queue** is the deeper planner.
- **"In motion" has a definition.** A piece is in motion if it has a dated delivery or event ahead, was published in the last 14 days, or has an open to-do or plan step. Always show *why* it is in motion.
- **Routines come from the Sophia (LMS) dock** and open slots in the Queue. I couldn't find the dock in the repo, so **ask the owner where it lives** before modelling routines on anything else.
- **plan.md** is how someone begins organising around a piece. It starts empty when the piece joins the queue, fills as board suggestions are accepted, and agents in the action registry can read and write it. Every agent edit must be attributable.
- **The content library sits inside network search.** It is scoped to the sites the person belongs to and grouped by site. Show it as a **brick/gallery grid with a lightbox**, not the list in the mock.
- **The action registry / MCP** shows up only as light inline "next" chips on pieces, slots and gaps.
- **Colour is provisional.** The owner will send muted palettes built on a three-colour principle, one per area: Channel / Studio / Queue. Build on `--eac-*` tokens and expose `--eac-area-channel`, `--eac-area-studio` and `--eac-area-queue`. The mocks are set in a stand-in system (Broadsheet); don't hard-code its hex values.

## How this codebase likes to be written (match it)

- **Facts that prevent damage** (from `CLAUDE.md`):
  - `elkdonis_dev` is the production database.
  - The Stripe keys are live.
  - `org_id` goes on every content table.
  - Resolve the viewer with `getServerSession()`, never from request params.
  - A media path without `Private/` is public.
  - Run `\d <table>` before writing SQL; several documented columns don't exist.
  - Store jsonb with `db.json(x)`.
  - A new `threads.kind` must go into `OFF_FEED_KINDS`.
  - Build external URLs with `publicOrigin()`.
  - `@elkdonis/services` exports TypeScript source, so one broken file fails every app's type check.
- **Operating rules:**
  - Install only through the container.
  - Create migrations with `/new-migration`; never edit an applied one.
  - The type-check script is `check-types`.
  - There are no automated tests. Verify by hand per `docs/reference/testing.md`.
  - Never run a bare root `pnpm dev`.
- **Meta / Instagram (`packages/meta/src/instagram.ts`):**
  - Publishing is two calls: create a container, wait, then publish.
  - Images must be JPEG; PNG fails silently.
  - Caption links aren't clickable, so swap in "Link in bio" and say so in the UI.
  - The limit is 25 posts per rolling 24 h. Use `remainingInstagramQuota`.
  - Facebook link previews read from the site page, so publish Facebook *after* the site.
  - **Do not publish to real accounts during development.** Add a dry-run mode first.
- **Surfaces (`packages/cms-ui/src/surface`):**
  - Detail opens as a surface that grows from the card that opened it: `surface.open(descriptor, originEl)`.
  - Surfaces stack, with a back link, and keep their state in `?surface=`. Build them with `SurfaceFrame` (kicker, title, actions, status).
  - Register Channel's own surfaces as host `custom` surfaces, the way `OrgConsoleHost` registers `CONSOLE_SURFACES`. The shared package gains no Channel-specific vocabulary.
  - A face that shows a count opens instantly onto data that was already loaded, with no spinner.
- **Compose (`packages/cms-ui/src/compose/catalogue.ts`):**
  - What someone can make is derived from what the org actually has. Never show "Soon" cards; if a capability is missing, the option isn't there.
  - Reuse `composeSlots.body` (`RichTextEditor`) and `composeSlots.media` (`MediaPicker`, upload or library, never a URL box).
- **Writing:** focus mode is `writing-room.tsx` (`useWritingRoom`, `WritingRoomBody`) and `WritingDesk.tsx`, with the Write / Side by side / Preview views. Add the Text / Blocks switch there; don't build a new editor.
- **Identities:** `/api/hub/identities` lists the names a person publishes under. Use it for the "Publishing as" section and for tagging posts.
- **Email:** Newsletter opens the existing Email suite (`@elkdonis/cms-ui/email`); don't rebuild it.
- **TypeScript gotcha:** the repo compiles with `strict: false`, so result unions don't narrow. Compare `result.ok === false` explicitly, as the rest of the code does.
- **Voice:** write UI copy and comments the way the hub console does: plain, specific and honest about state. "0 drafts" is information; a face that leads to "you may not" is furniture.
- **LMS rules worth borrowing (`lms/SYNTHESIS.md`):** write an append-only event log in the same transaction as the state change; record an actor type on every record (user or agent); agents write drafts only.

## First-pass scope (in this order; stop and show me after each phase)

0. **Plan.** Write a short brief at `docs/open/channel.md` that maps the handoff onto real tables, services and routes. Check `\d` on threads, artwork, identities and media before proposing columns. Flag anything in the README's data model that conflicts with the repo.
1. **Schema, services and a seed.** Create `channel_deliveries`, `channel_plans` plus `channel_plan_events`, and `channel_todos`. Hold `channel_routines` until the Sophia dock question is answered. Add services in `@elkdonis/services` (or a new `@elkdonis/channel` package that exports TS source), and a seed script for one artist and one org.
2. **Read-only Home.** Build `/channel` in `apps/arts-collective`: ChannelNav, Home (1a, with routines in place of the count bands) and the matrix view (1b), all from real data, with "in motion" computed on the server.
3. **The piece surface and the library.** Build the piece pop-up (3a), its Plan tab (3c) and the content library as a brick grid with a lightbox (3b), all as custom surfaces.
4. **Queue and the piece board.** Build Queue week (2a) and the piece board (2b). Accepting a suggestion writes a draft delivery and appends a step to plan.md.
5. **Compose.** Build the quick sheet (2c) and New post (1d), publishing through `packages/meta` behind dry-run, with the site going first.

Out of scope for now:
- the Studio toggle in New post (in-depth social and clip editors)
- Instagram presets and filters
- Queue calendar zoom, drag and shift-the-plan
- the Go live flow
- Site settings with Puck pages
- the final palette

When you're unsure, ask rather than invent. The owner prefers short, direct updates.
