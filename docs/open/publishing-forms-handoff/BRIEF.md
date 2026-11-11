# Brief: Publication forms, design to code (2026-11-08)

From the PM session (system32-08) for Justin. The handoff is in this folder: open `README.md` first, then `Publishing Forms.dc.html` (the canvas) and `Publish Form.dc.html` (its `renderVals()` is the state spec). The zip is alongside.

## What this is
This is **just the beginning.** Your job is to **line up the circuitry**: the shared form shell, field components, kind schemas, presets, preview and validation. Build it so later themes slot in rather than a single look being locked in. Expect the work to be transitory. This first pass sets up the structure that the next passes mature, so go as deep into the code as you need to make the workflow mature. Keep the inline feel that people like in today's **compose** sheets and **direct-edit** components.

## How to read the design
- **Prefer the design's UI**: the layout, field patterns, More rows with summaries, the readiness rail, "Repeat → Present it as a series" growing the session planner in place, quick compose as a popover or bottom sheet, and the validation model.
- **Go beyond it where the code knows more.** Where we already do something, keep our circuitry and give it the new face. Where the UI implies circuitry we don't have, name the gap clearly.
- **Themes.** The design is drawn in "Broadsheet" (Source Serif, cyan/magenta, 2px radii). Treat that as **one theme**, not the system. Map every Broadsheet token onto our token layer (`packages/tokens`, `--eac-*` and area tokens; see `docs/reference/frontend-ui.md`) so an org's own theme and brand kit can restyle the forms. Hard-coding Broadsheet is the failure mode.
- **Ignore one line in the README.** It says to "disregard the existing compose/studio forms; build fresh". Ignore that. Build the UI fresh, but reuse or align the existing circuitry (below), and report what you replace.

## What we already have (explore first)
- `packages/cms-ui/src/compose/`: ContentComposer, SeriesComposer + SessionsEditor, ArtPieceComposer, QuestionnaireComposer + QuestionBuilder, ComposeSheet, `content-fields.ts`, `catalogue.ts`, `zoned-time.ts`, `series-card.ts`.
- `packages/studio/src/`: StudioShell, `kinds.ts`, kinds `writing`, `post` (= social post), `meeting`, `recording`, `wordart`, `video`. The route `/studio?kind=&org=` exists. Focus mode is a per-browser preference (`studio:focus`), and the Studio does not read `?focus=1` yet.
- `packages/direct-edit`, `packages/page-builder` (Puck), `packages/blocks`: the inline-editing feel to respect.
- `packages/content` (new today): KindStrip, PublishCard, ContentLibrary, ContentDetail, and `registry.ts` (`CREATE_KINDS`, `studioNewHref`). The Publish card's kind tiles hand off into these forms.
- Server side:
  - thread kinds: meeting, series, series_session, post, writing, workshop, …
  - RSVP and email triggers (see `docs/open/EMAIL_RSVP_DEBRIEF_2026-10-10.md`, `SERIES_KIND_DESIGN_2026-10-10.md`)
  - Nextcloud Talk/circle creation (fourthwayBookreaders `createReadingGroup` does it)
  - commerce artwork with variants, provenance and media (`packages/commerce`)
  - `org_site_sections`
- Today's direction (read):
  - `docs/open/PM_BOARD_2026-11-08.md`
  - `docs/open/NETWORK_SERVING_ARCHITECTURE_2026-11-08.md`: the form family is a shared package drawn in the Studio, plus inline on sites in the short variant.
  - `docs/open/CONTENT_LIBRARY_COMPONENT_2026-11-08.md`: presets on an item go in `content_prefs` and resolve item → org → person → default, which is also where the brand kit lives.

## Known tensions to settle (flag them, don't decide alone)
- **Naming.**
  - The design says "Gathering" where the code says meeting.
  - "Post" in the design means writing, but the Studio's `post` is a social post.
- **After publish.** The design shows no share/Channel step "by request". Channel's routines expect a hand-off, so leave a hook.
- **Where it lives.** The design suggests `packages/compose`; the architect suggests `studio/forms`. Recommend one.
- **Preview layout** is undecided (2a toggle vs 2b rail). Build it as a layout switch.
- **Session planner**: list, calendar or programme. Build the list first.

## Team shape
Spawn sub-agents as you see fit:
- **Bone (you)**: chief designer and architect. Owns the package location, the form-state model (`kind` schemas, series derived from a gathering), the preset resolution contract, the server actions and data contracts per kind, the theming contract, and the gap list. You review everything the others land.
- **Tendons**: an agent that **loads the design skills** (`design:design-system`, `design:design-handoff`, `artifact-design`). It owns the shared field components, the shell, the More rows, the readiness rail, the preview frame, the quick-compose popover and sheet, the token mapping, and the theme switching. These are the joints between the UI and the circuitry.
- **Soft tissue**: an agent for the fill. It owns kind-specific sections, copy, validation rules and states, mobile reflow, the planner variants and the Poll/Questions add-ons.

Other agents may send you notes: the integration architect, the PM, the Publish-card builder. Take them as input.

## Ground rules
- eris `~/eac`, branch `work/2026-11-08`. Commit by explicit path (never `git add -A`). Other sessions have uncommitted work in `apps/hidden-enneagram` and `pnpm-lock.yaml`, so leave it alone.
- End commit messages with your own model's attribution lines.
- **No deploys and no migrations without asking Justin.** Report to the PM (SendMessage to `system32-08`).
- Start with a written plan in this folder (`PLAN.md`): the circuitry map (have / missing / replace), the package decision, the passes, and the agent split. Message the PM when it's up.
