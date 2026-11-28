# Rails & Desk (2026-11-27)

PM: the Opus session ("Rails PM"). Three Sonnet lanes: **A** (rails wiring), **B** (maps on /development), **C** (desk on /development).
Board: `BOARD.md` in this folder, append-only, newest at the bottom, `### [A|B|C|PM] HH:MM  title`.

## Justin's brief, in his words (2026-11-27)

> "we are aiming at maintaining a list of actionable + forms, that we can serve directly to the user through the dock ... laying ground work so the ai assistant is in a very well layed out environment for itself (and the more on-rails dock before it)... this way making and editing the on-rails dock trails etc i can finesse what is important to include for each use case"

> "creating your own space on apps/development to showcase these on rails diagrams/courses/action flows.... allowing me to edit it a bit... and perhaps even more foundational to that displaying the codebase ... a way of putting notes for claude on apps/development site wide, that gives context of where its put, and i guess a record of latest for claude to check"

He is a creative, non-technical owner. He reads on-screen labels literally: keep counts and labels honest, plain words, no jargon on screen.

## The problem on sophia.elkdonis-arts.org

`packages/actions/scripts/seed-rails-courses.mts` turned the 21 nexus courses (`atlas/tracks/`) into 21 public `rails-*` test courses on 2026-11-16. Dry run today: **104 steps = 20 task, 74 "not-wired", 10 gap.** A not-wired step is an atlas capability with no registry entry the dock can use (no catalogue entry, entry not a course action, or no registry-data), so the seed wrote a reading step whose body is "Not wired to the dock yet: <capability id>". Ten more are named in the seed's NOTES (e.g. `org-publish has no registry-data`, `site-section-save is not a course action`).

## The idea: one readiness ladder per capability (the "actionables + forms" list)

Every person-class capability in the atlas gets one computed level. This IS the list Justin asked for; the dock, Sophia, the dev app and the MCP all read it.

| Level | Name on screen | Means | What the dock does |
|---|---|---|---|
| 0 | **Not built** | a `{gap}` in a track, or no host | shows the step as "coming later" |
| 1 | **Place** | the atlas knows where it is done (a host with an `address`) | "Take me there" (route + highlight), person ticks "I did it" |
| 2 | **Checked** | + a status check, so the platform sees when it is done | "Take me there", ticks itself |
| 3 | **In the dock** | + a runnable entry with a `dockForm` and a confirm card | the form opens inside the dock |
| 4 | **Assistant** | + `agent` exposure (read or draft) in `packages/actions/src/agent.ts` | the MCP can read it / propose it |

Money (`risk: money`) caps at 2 by rule (the dock only links). Level is computed, never hand-typed.

## Data contract: `packages/actions/atlas/reports/readiness.json` (lane A writes, lanes B/C read)

```ts
interface Readiness {
  generated: string;            // ISO time
  counts: Record<'0'|'1'|'2'|'3'|'4', number>;
  capabilities: Array<{
    id: string; label: string; does: string; area: string; family?: string;
    scope: string; actors: string[]; risk: string[];
    level: 0|1|2|3|4;
    why: string;                // one plain line: what keeps it at this level ("no status check", "no form yet")
    next: string;               // one plain line: what lifts it one level
    entry: string | null;       // registry entry id
    dockForm: string | null;
    status: string | null;      // CHECKS id or description
    confirm: { status: string; text: string } | null;
    address: { app: string; path: string; how?: string } | null;  // first usable address
    hosts: Array<{ key: string; file: string; line?: number }>;
    tracks: string[];           // track ids that name it
    courses: string[];          // nexus course ids whose tracks name it
    open?: string;
  }>;
  tracks: Array<{ id: string; label: string; area: string; steps: Array<{ cap?: string; gap?: string; level: number }>; leads_to: string[]; gates: string[] }>;
  courses: Array<{ id: string; label: string; area: string; tracks: string[]; builds_on: string[]; levels: Record<string, number> }>;
}
```

Lane B snapshots this into `apps/development/src/data/rails/readiness.json` with a script (the dev app does not import packages/actions; same pattern as `scripts/refresh-data.mjs`).

## Lanes

### A: rails wiring (packages/actions, packages/dock, packages/lms only where needed, the seed)
1. `scripts/atlas-readiness.mts` (+ `atlas:readiness` script) writes `readiness.json` and a readable `readiness.md` (by course, then by level).
2. Level 1 for real: a not-wired step becomes a **place step**: what it does, where ("Take me there" link from the atlas address, cross-app hosts are full URLs), and the normal Sophia "mark done". No "Not wired to the dock yet" text anywhere. Decide (and post) whether this is a reading step with a richer body, or a task step pointing at a light "place" entry so the dock routes it. Prefer what the dock already supports (`kind: 'go'`, `routeFor`, `dockAckDone`); do not invent a parallel path.
3. Fix the seed's NOTES cases (e.g. `org-publish` registry-data) where the fix is data, not new behaviour.
4. First forms: pick 4-6 low-risk, high-use capabilities on the courses (profile, site copy, org basics), each with an existing service function, and take them to level 3: catalogue entry, runner, status check, `dockForm` in `packages/dock/src/forms.tsx`, confirm wording `status: 'draft'` (the live dock shows the generic line until Justin approves). Follow `atlas/JOURNAL.md` conventions; regenerate registry-data the way the journal says.
5. Gates: `check:registry`, `atlas:check --strict`, `check:rails`, `tsc` in actions, dock, lms, arts-collective, sophia, art-auction. Seed `--dry` only. **No `--write`, no rebuild, no migration**: the PM does those with Justin's go.

### B: maps on /development (new: `src/app/rails/**`, `src/app/map/**`, `src/rails/**`, `src/map/**`, `scripts/refresh-rails.mjs`)
1. **Rails** (`/rails`): the trails as diagrams. Course → modules (tracks) → steps, each step coloured by level, with the ladder legend and honest counts. A course page shows its steps in order with what each does, where it is done, why it is at its level and what lifts it.
2. **Edit the trails** (Justin "finesse what is important for each use case"): reorder, drop, add a capability (picker over the atlas), mark a step "essential / optional / later", add a note. Saved as drafts in the existing `dev_versions` table (subject `rail:<course id>`, versions + branches as the block editor does; reuse `src/lib/versions.ts`). Nothing touches the atlas or the live courses; a `scripts/rails-drafts.mts` prints each draft as a diff against `atlas/tracks` for Claude to fold in.
3. **Atlas** (`/map`): every capability, filter by area / app / level / actor, search; a card shows does, level, why, next, hosts (file:line), entry, confirm wording status, open questions. Top line: the ladder counts.
4. **Code** (`/map/code`): the workspace dependency graph from `scripts/workspace-graph/` (built 2026-10-16: apps ↔ packages, reach, cycles, declared-not-imported). Serve it through a gated route or render natively from `extract.mjs` output; **never from `public/`** (files there bypass the admin gate).
5. Put `data-dev-anchor="<subject>"` on every card and step (`cap:<id>`, `rail:<course>/<step>`, `track:<id>`, `ws:<dir>`) so lane C's notes attach to stable things.

### C: desk on /development (new: `src/desk/**`, `src/app/desk/**`, `src/app/api/desk/**`, `scripts/desk.mts`, one migration file)
1. Migration `302_dev_notes.sql` (written, not applied; PM applies it alone). Table `dev_notes`: id, parent_id (replies), path (page), anchor (data-dev-anchor or a CSS path), anchor_text (snippet of what was clicked), kind (`note|question|change|bug|idea|update|decision`), body, options jsonb (a decision's choices), answer, author_id, author_kind (`person|claude`), status (`open|seen|doing|done|wontdo`), created_at, updated_at, resolved_at. RLS on with no policy, as 281. Platform-level, admin gate only.
2. **Note for Claude** on every page: a small floating button; "pick" mode outlines the nearest `data-dev-anchor` (else a CSS path) under the pointer; a short form (kind + text). Open notes on the current page show as pins at their anchor; a side panel lists this page's notes and replies. One mount in `layout.tsx` (PM adds the line).
3. **Desk** tab (`/desk`): (a) *Your notes*: open first, with Claude's replies; (b) *Questions from Claude*: decision cards with option buttons and a free answer, answered in place (replaces "liaison:" messages); (c) *Latest from Claude*: `update` rows, newest first, each linking to the page it concerns.
4. `scripts/desk.mts` for Claude (run in a container with tsx): `list [--open] [--path]`, `show <id>`, `reply <id> "text" [--status done]`, `ask "question" --options "a|b|c" [--path /rails] [--anchor cap:x]`, `update "what changed" [--path] [--anchor]`, `seen <id>`. Writes as `author_kind=claude`.
5. Server actions call `getNetworkAdmin()` first, every time. Text is plain (no HTML); cap lengths.

## Shared files and boundaries
- `src/app/layout.tsx`, `src/components/TopBar.tsx`: PM only (tabs Rails, Map, Desk; the note mount).
- Another session (Offer Templates, board `docs/open/OFFER_SURFACES_2026-11-27/BOARD.md`) is working in `apps/development/src/offer-templates/**`, `Frame.tsx`, `GalleryLive.tsx` and `packages/cms-ui/src/offer-surface/**`. Do not touch those.
- The tree is shared and uncommitted; never revert or reformat files you did not write. No `git` writes.
- Production DB is live. Reads are fine; no writes except lane C's CLI against `dev_notes` once the PM has applied 302.
- Previews: a throwaway dev container only (recipe in `docs/open/DEVELOPMENT_APP_2026-11-20/DEPLOY.md` and the fake-admin gate trick below), check `free -g` first, remove it after. Never restart a production container.
  - Fake-admin trick: mount `~/scratch/dev-gate/gate.ts` over `apps/development/src/lib/gate.ts` **inside the throwaway container only**.
- Style: the dev app's own CSS (`src/app/dev.css`, `--dev-*` variables). Plain words on screen.


---

# Round 2 (2026-11-27 18:30): everything in the dock, Sophia first

Justin, mid-session: **"i would ideally not have a take me there step... i would like the actions to be done any where on the platform the dock is"** and **"prefferable sophia.elkdonis-arts.org first."**

So "Place" (level 1) is a waiting room, not a design. The target for every step is **level 3: done inside the dock, on whatever site the dock is open on.** The dock card does not show "Take me there". A step that is not in the dock yet reads "Coming to the dock: <what it does>". The where-it-is-done-today information stays in the atlas and on /development (Rails, Map) for Justin and Claude only.

Exceptions, each proposed to Justin and NOT yet decided:
- money (Stripe pages) stays a link, by his own rule;
- layout and visual work (arranging a page, a tour's stops on a map, video) does its field part in the dock, and the arranging part opens the editor as a pop-up over the current page.

## One declaration per action (the join from SITE_FORM_2026-11-16/SYNTHESIS.md)

Every in-dock action is declared once as data. That one declaration renders the dock form, gives the MCP tool its input schema, and later feeds the house editor sidebar. It has no hand-made React form per action. Vocabulary: reuse `ContentFieldSpec` / `WizardFieldSpec` (`packages/cms-ui/src/compose/content-fields.ts`) if it fits the dock. If it does not fit, write a small client-safe `DockFieldSpec` in `packages/actions` with an adapter, and say why on the board. Do not create a fifth vocabulary without saying so.

```ts
// packages/actions/src/fields.ts (client-safe, no deps). Lane E owns it and posts the final shape on the board first.
interface ActionForm {
  entry: string;                    // catalogue id
  fields: FieldSpec[];              // text | textarea | toggle | select | choice | image | date | time | pick (one of my things)
  load?: string;                    // server reader id that pre-fills values for the person (and org)
  pick?: { reader: string; label: string };  // "which one?" list for thread/booking-scoped actions
  submitLabel: string;              // plain verb: "Save", "Publish", "Add"
}
```
Server side (lane E): `loadDockForm(entry, ctx)` → values + pick list; submit is validated by the runner's zod schema and run through `performAction` (`via: 'app'`), after the confirm card, as today. The 6 existing forms (profile-basics, store-front, ship-from, listing, org-details, pen-name, writing-start) move onto the declarations. `forms.tsx` keeps a custom-component escape hatch only for a case the spec cannot draw.

## Lanes, round 2
- **D: the dock on Sophia.** Mount `<Dock>` in `apps/sophia/src/app/layout.tsx` the way art-auction did (`docs/open/MARKET_CENTER_AND_DOCK_2026-11-24.md`: dock-actions.ts, `/api/actions/dock`, links; lessons link to Sophia's own lesson pages). Remove "Take me there" for place steps in `packages/dock/src/dock.tsx`, and in the seed's place body (no link; "Coming to the dock: <what it does>"; keep `settings.place` as data). Seed `--dry` only. tsc on sophia, dock, actions.
- **E: the form engine.** `fields.ts` plus a generic renderer in `packages/dock` (match the dock's CSS) plus `loadDockForm` and the pick list plus image upload through the existing upload path (`docs/open/UPLOADS_ONE_PATH_2026-11-16.md`; find the one that exists) plus the JSON schema for MCP from the same declaration. Fill `{org}`, `{name}`, `{title}` … in approved confirm text from the loaded values (bug found by lane A: braces show today). Convert the existing forms.
- **F: wiring wave 1** (profile, publishing, organisation steps on the rails courses). Pick from: upload-profile-photo, profile-section-toggle, user-theme-save, retire/restore pen name, post-to-a-site, publish-draft-post (thread scope: needs `pick`), set-workshop-listing, forum-topic-start, workshop-save, org-person-role-set, remove-person-from-org. For each one: catalogue entry, runner over the canonical service function, status check, an `ActionForm` declaration, `draft` wording in `wording-wave-03.md`, the atlas row updated, a JOURNAL line. Allowing thread-scoped course steps (with a pick) is a behaviour change: make it in one place (`COURSE_ACTIONS` / `dock.ts`) and say so on the board. Write runners and status checks first, while E settles `fields.ts`.

Same hard rules as round 1: no seed --write, no migration, no rebuild, no git writes, no DB writes.
