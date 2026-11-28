# apps/development: the shared desk

`arts-collective.com/development` (container `eac-development`, port 3031, basePath `/development`).
Only network admins can open it (`users.is_admin`, `src/lib/gate.ts`), on every page and in every server action.
Justin, the owner, works with Claude here. He is creative and non-technical, and he reads on-screen labels
literally. Keep counts honest and words plain. Nothing in this app changes a live site, except through the
gated review actions that already exist (Sites → draft review).

## Start here, every session that touches the platform's look, rails, dock, LMS, atlas or MCP

1. **Read the desk.** Justin leaves notes pinned to things on these pages. In a container:
   ```bash
   cd ~/eac && sudo -n docker compose run --rm --no-deps -w /app/packages/lms admin \
     node_modules/.bin/tsx ../../apps/development/scripts/desk.mts list --open
   ```
   Each note has the page (`path`) and the thing on it (`anchor`, e.g. `cap:site-banner-save`). Open
   that page or the code behind the anchor before you answer. Then `desk.mts seen <id>`.
2. **Answer in the desk, not only in chat.** `desk.mts reply <id> "…" [--status doing|done]`.
3. **Ask decisions as cards.** `desk.mts ask "question" --options "a|b|c" --path /rails --anchor cap:x`.
   He answers by clicking, and the answer comes back with `desk.mts list`. Mention the question in chat too.
4. **Say what changed.** After any change he can see (here or on a live site), write
   `desk.mts update "what changed, in his words" --path /<page> [--anchor …]`. One line per change.
   This feed is the "latest from Claude" he checks.

## Tabs (what each is for)

| Tab | Path | Shows | Data |
|---|---|---|---|
| Blocks | `/` | every Puck block, editable, with versions | `src/data/blocks.json`, `dev_versions` |
| Designs | `/designs` | design handoff bundles | `designs/` (admin-only route) |
| Design systems / Themes | `/design-systems`, `/themes` | theme variables and per-site mock themes | `src/data/themes.json`, `theme-roles.json` |
| Sites | `/sites` | real org pages, and assistant drafts to review | live DB (read), draft store |
| Ideas | `/ideas` | proposals shown as experiences | `src/ideas/**` |
| Workspace | `/workspace` | the workshop workspace mock-ups (spec for Sophia `/workspaces`) | `@elkdonis/workspace-ui` |
| Rails | `/rails` | the dock's trails (courses → tracks → steps), coloured by readiness; Justin edits drafts | `src/data/rails/readiness.json`, `dev_versions` subject `rail:<course>` |
| Map | `/map`, `/map/code` | the action atlas (every capability), and the apps ↔ packages graph | `src/data/rails/*.json` |
| Desk | `/desk` | his notes, Claude's questions, Claude's updates | `dev_notes` (migration 302) |

## The readiness ladder (rails, dock, MCP)

Every person-class capability in `packages/actions/atlas/` has one computed level. The levels are
0 Not built, 1 Place (we know where it is done), 2 Checked (the platform sees when it is done),
3 In the dock (a runnable entry with a dock form and a confirm card), 4 Assistant (agent exposure).
Money caps at 2. Source: `pnpm --filter @elkdonis/actions atlas:readiness` →
`packages/actions/atlas/reports/readiness.json` + `readiness.md`. Never hand-type a level.

## Keep it fresh

- After changing the atlas, tracks, catalogue, dock forms or status checks: run `atlas:readiness`, then
  `node apps/development/scripts/refresh-rails.mjs` (copies readiness + the workspace graph into `src/data/rails/`).
  The pages show what was copied at the last build, so refresh before every rebuild.
- Justin's trail edits are drafts in `dev_versions` (`rail:*`). Fold them into `packages/actions/atlas/tracks/`
  with `scripts/rails-drafts.mts` (prints each draft as a diff), then post a desk update.
- New cards, steps and nodes carry `data-dev-anchor="<subject>"` (`cap:<id>`, `rail:<course>/<step>`,
  `track:<id>`, `ws:<dir>`, `block:<app>:<id>`), so notes stay attached when layouts change.

## Rules

- Rebuild: `APPS="development:eac-development:3072" sh ~/eac-backups/rebuild-2026-11-20.sh`. It ships
  every uncommitted file in `apps/development` and the packages it imports. Other sessions work here
  (check `docs/open/*/BOARD.md` for apps/development lanes and post before you rebuild). Ask Justin first.
- Previews: a throwaway dev container only, with the fake-admin overlay
  (`-v ~/scratch/dev-gate/gate.ts:/app/apps/development/src/lib/gate.ts:ro`) inside that container only.
  Never mount it into `eac-development`. Recipe: `docs/open/DEVELOPMENT_APP_2026-11-20/DEPLOY.md`.
- Never serve data from `public/`: files there skip the admin gate.
- Test as test accounts only. Never impersonate a real person (the DB is production).
- Boards: `docs/open/DEVELOPMENT_APP_2026-11-20/` (blocks, themes, workspace),
  `docs/open/RAILS_DESK_2026-11-27/` (rails, map, desk).
