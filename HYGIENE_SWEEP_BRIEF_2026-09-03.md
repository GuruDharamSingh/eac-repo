# Platform Hygiene Sweep — handoff brief (2026-09-03)

Written for a fresh agent with no memory of the session that produced it. Read
this whole file before touching anything — it front-loads the traps that cost
real time to discover the first time around.

**Context**: this monorepo just went through a large profile-system
unification (migrations 084-087 — see the memory file
`project_profile_unification.md` if you have access to it, otherwise
`packages/services/src/profiles.ts`'s header comment is the canonical
summary). Along the way, three concrete platform-hygiene gaps got found but
only partly fixed. This brief scopes finishing them. **Do not start a new
feature. This is cleanup only** — the goal is fewer lines of hand-rolled
per-app code doing the same thing as a shared package, not new capability.

## How to verify anything in this repo (read this first)

- **Typecheck one app**: `docker compose exec -T inner-gathering sh -c "cd /app && pnpm --filter <app-name> exec tsc --noEmit -p ."` — run this from a *running* container (inner-gathering is usually up; check `docker compose ps`), not the host, because pnpm workspace resolution and some `dist/` folders are container-built.
- **Rebuild a shared package after editing it**: `docker compose exec -T inner-gathering sh -c "cd /app/packages/<pkg> && pnpm build"`. Apps resolve packages via `dist/`, not `src/` (except `@elkdonis/live-editor`, which ships raw TS and has no build step) — an edit to a package's `src/` does nothing to consuming apps until you rebuild it.
- **Trap**: package `dist/` folders can be **root-owned** from an earlier Docker-internal build, so a host-side `pnpm build` fails with `EACCES`. Always build inside a container (as above), not on the host.
- **Trap**: `pnpm install` on the host works fine for updating `node_modules` symlinks (workspace linking), you don't need to do that inside a container. Only the `pnpm build` step needs to run in-container.
- **Restart an app to pick up a rebuilt package or new env var**: `docker compose restart <service>` if only code changed; `docker compose up -d <service>` (forces recreate) if you changed `docker-compose.yml` or `.env` — `restart` alone won't pick up new environment variables.
- **Live smoke test**: apps are reachable at `http://localhost:<port>` per the port table in `CLAUDE.md`. `curl -s -o /dev/null -w "HTTP %{http_code}\n" <url>` is enough to catch a broken route; check `docker compose logs <service> --tail 30` for the actual stack trace when something 500s. Ignore `TURNSTILE`/`version is obsolete`/`Blocked cross-origin` log lines — pre-existing noise, not signal. IFAC in particular gets real internet bot-scan traffic (`/wp-json`, `.php` probes) in its logs; ignore those too.
- **A known TypeScript quirk you will hit**: a function in a `"use server"` file that returns a true discriminated union (`{ok:true; x} | {ok:false; error:string}`) fails to narrow correctly at `if (!result.ok) return result.error` call sites — confirmed reproducible, happens even with a locally-defined type, not just cross-package imports. Don't fight it. Use the non-discriminated shape instead: `{ok: boolean; error?: string}` (see `SaveResult` in `packages/live-editor/src/types.ts`, re-exported from `@elkdonis/ui`) — `error` being optional either way means no narrowing is ever needed.
- **Another one**: writing a JSON array/object into a `jsonb` column via a plain tagged-template placeholder (`` db`UPDATE t SET col = ${JSON.stringify(x)}` ``) type-checks fine and doesn't error, but silently double-encodes — the column ends up holding a JSON *string* scalar instead of the array/object. Use `db.json(x)` (postgres.js's own marker). If TS complains `db.json()` doesn't accept your type (it won't, for most named interfaces — postgres.js's `JSONValue` type requires an index signature a plain interface never has even when every field is JSON-safe), see the `jsonb()` helper in `packages/services/src/profiles.ts` for the sanctioned workaround (a narrow, commented cast — confirmed correct against real read/write round-trips, not a guess).
- **`tsx` vs `node --experimental-strip-types`**: this repo's containers run Node 20.20.2, which does not support `--experimental-strip-types` (that's Node 22.6+). Any one-off TS script needs `tsx` — check whether the app already has it as a devDependency (`ifac` does; `pnpm add -D tsx --filter <app>` if not) and run via `node_modules/.bin/tsx script.ts`, invoked with `cd /app/apps/<app> && DATABASE_URL="..." node_modules/.bin/tsx scripts/foo.ts` inside a running container of that app (not a different app's container — module resolution needs to be rooted at the app that has the dependency).

---

## Item 1 — 8 apps still bare-export `handleSignup` the fragile way

`handleSignup(request, options?: SignupOrgOptions)` takes an **optional
second parameter**. `export { handleSignup as POST }` only satisfies
Next.js's generated route-handler type by coincidence — TypeScript allows a
function with fewer parameters to be assigned where more are expected, but
the moment `handleSignup` has a *typed* second parameter that isn't
`{params: Promise<{}>}`, that assignability breaks. Some of these currently
still typecheck clean only because their `.next/types/validator.ts` hasn't
been regenerated recently (stale dev-server cache) — they are not actually
safe, they just haven't been caught yet. This exact bug already broke 3
apps' `handleOAuthCallback` routes this session when that function gained
the same kind of optional parameter (all 3 are now fixed — see the wrapper
pattern below, copied verbatim from those fixes).

**Confirmed current offenders** (re-verify with the grep below before
trusting this list — it may have changed):
```
grep -rl "export { handleSignup as POST }" apps/*/src --include=*.ts
```
As of this writing: `art-auction`, `arts-collective`, `blog-guru-dharam`,
`blog-sunjay`, `blog-tester`, `elkdonis-arts-collective`, `forum`,
`inner-gathering`.

(`amrit-canada` and `pigeonshoot` will also match this grep — check before
editing: in both, the match is inside a *comment* explaining why they wrap
it, not real bare-exported code. Read the whole file, don't just grep-and-edit.)

**The fix, and the one real judgment call per app**: wrap in a real
`async function POST`, and decide what `defaultOrgs` should be. `handleSignup`
defaults to `[{id:'elkdonis',role:'member'},{id:'inner_group',role:'member'}]`
(the shared network) when no `defaultOrgs` is passed — for a genuinely
cross-org app that's likely *correct* and the only fix needed is the export
style (no behavior change). For an app that's really one community's site,
signups should join that org specifically, or new members silently end up
scoped to the wrong org (this exact bug blocked IFAC's admin console from
ever seeing its own new signups until fixed this session).

Per-app assessment (verify before trusting — these are informed guesses from
reading `config/site.ts` / `config/blog.ts`, not confirmed with the app owner):

| App | Has a fixed org_id? | Likely correct `defaultOrgs` |
|---|---|---|
| `blog-sunjay` | Yes — `config/blog.ts`: `orgId: 'sunjay'` | `[{id:'sunjay',role:'member'}]` |
| `blog-guru-dharam` | Yes — `config/blog.ts`: `orgId: 'guru-dharam'` | `[{id:'guru-dharam',role:'member'}]` |
| `blog-tester` | No config found (sandbox app per CLAUDE.md) | Probably fine as shared default — just fix the export style |
| `art-auction` | No — "multi-artist marketplace" (cross-org by design) | Probably fine as shared default — just fix the export style |
| `forum` | No — "cross-org content aggregator" (CLAUDE.md) | Probably fine as shared default — just fix the export style |
| `inner-gathering` | No fixed org (the network's main app) | Probably fine as shared default — just fix the export style |
| `arts-collective` | No — each member gets their *own* org via the onboarding wizard, not a fixed one | Needs its own read: does signup here even use `handleSignup`'s org-join path meaningfully, or does org creation happen elsewhere (the wizard)? Check `apps/arts-collective/src/app/api/wizard/` before assuming. Don't guess — this one's the most likely to have a subtlety. |
| `elkdonis-arts-collective` | Unclear — check whether this app is still active or superseded by inner-gathering's `(marketing)` route group (CLAUDE.md's "In Progress" section mentions this merge as underway) | Confirm the app is still live before spending time on it |

**Exact wrapper pattern** (copy from `apps/pigeonshoot/src/app/api/auth/signup/route.ts`,
already correct, or `apps/hidden-enneagram/src/app/api/auth/callback/route.ts`
for the callback-route version of the same fix):

```ts
import { NextRequest } from "next/server";
import { handleSignup } from "@elkdonis/auth-server";
// import { siteConfig } from "@/config/site"; // only if scoping to a fixed org

export async function POST(req: NextRequest) {
  return handleSignup(req, {
    defaultOrgs: [{ id: "the-org-id", role: "member" }],
    // OR omit the whole options object / pass {} if the shared default is correct
  });
}
```

**Verify each fix**: typecheck the app (command above), then check the app
actually starts (`docker compose up -d <service>`, check logs for startup
errors) if it's easy to bring up. Not all apps in this table may currently
be running in dev — check `docker compose ps` first, don't spin up apps that
aren't already part of the working set without reason.

---

## Item 2 — Media-proxy route: 10 near-duplicate copies, one already-proven shared factory

```
wc -l apps/*/src/app/api/media/\[...path\]/route.ts
```
10 apps have this route, 66–115 lines each, ~620 lines total. **Three of
them are already fixed** — `blog-sunjay`, `blog-guru-dharam`, `blog-tester`
are each a 3-line file:
```ts
import { createMediaGetHandler } from '@elkdonis/blog-server';
export const GET = createMediaGetHandler();
```
`createMediaGetHandler()` (and its sibling `createMediaUploadHandler(config)`)
already live in `packages/blog-server/src/media.ts` — a working, proven,
org-agnostic factory. The remaining 7 apps (`amrit-canada`, `art-auction`,
`arts-collective`, `hidden-enneagram`, `ifac`, `inner-gathering`,
`pigeonshoot`) each hand-roll the same logic instead of using it.

**The work**:
1. **Move (not copy) `createMediaGetHandler`/`createMediaUploadHandler` out
   of `@elkdonis/blog-server`** into a more central shared package —
   `@elkdonis/services` is the natural home (it already has `getProxyFileUrl`/
   `getUploadPath`/`uploadFile` in `packages/services/src/nextcloud.ts`, which
   this duplicates almost exactly — check whether `media.ts`'s helpers can
   just be deleted in favor of calling those directly). Keep
   `@elkdonis/blog-server` re-exporting it for backward compat (its 3 current
   consumers shouldn't need to change their import) or update all 3 to the
   new location — your call, but don't leave two copies of the same function.
2. **Before migrating any of the 7 hand-rolled apps**, diff each against the
   factory's behavior — they are **not byte-identical** (confirmed:
   `amrit-canada` and `art-auction`'s copies have the same line count but
   different content). Two of the 7 have real, deliberate custom logic layered
   on top that the factory does not replicate — **do not blindly swap these
   two in**:
   - `ifac`'s route (`apps/ifac/src/app/api/upload/route.ts`) has a
     "staging" mode (upload before a DB row exists — an admin composing a
     new profile) and an `avatar` vs `gallery` distinction controlling whether
     the upload attaches to `users.portfolio`. Read the extensive comment at
     the top of that file before touching it.
   - `pigeonshoot`'s route has an EXIF-stripping pipeline (per project memory:
     "sharp EXIF-strip pipeline" — privacy-motivated, deliberate). Read it
     fully before touching it.
   - The other 5 (`amrit-canada`, `art-auction`, `arts-collective`,
     `hidden-enneagram`, `inner-gathering`) look like straightforward copies
     of the same base logic and are the safe first targets.
3. Migrate the safe 5 first, verify each (typecheck + a live `curl` against
   an actual uploaded file's proxy URL, 200 with real bytes back — not just a
   200 status, since a misconfigured Nextcloud path can 200 with an error
   body), then decide separately whether `ifac`/`pigeonshoot` are worth
   adapting to call the factory with extension points, or are fine staying
   custom.

---

## Item 3 — Upload route: 6 near-duplicate copies

```
wc -l apps/*/src/app/api/upload/route.ts
```
`amrit-canada` (181), `art-auction` (160), `hidden-enneagram` (85), `ifac`
(113), `inner-gathering` (201), `pigeonshoot` (276). Same story as Item 2 —
`createMediaUploadHandler(config: BlogConfig)` in `@elkdonis/blog-server`
already does this generically (org param, visibility, file-type/size rules,
`media` table insert). None of the 6 currently use it. Same caveat applies:
`ifac` and `pigeonshoot` have real custom logic (see Item 2) — the other 4
are safer first targets. Do this alongside Item 2 since it's the same
factory relocation, not a separate trip through the codebase.

---

## Explicitly out of scope for this sweep — noted, not assigned

Don't pull these in "while you're in there" — each is bigger than a sweep
item and deserves its own planning pass:

- **Duplicated `lib/data.ts` per app** (up to 37KB in inner-gathering, 7
  copies total). Real duplication, but each one has accreted app-specific
  query logic over time — consolidating this is a redesign, not a sweep.
- **Duplicated shadcn `components/ui/` forks** (7 apps each have their own
  copy of `button.tsx`/`card.tsx`/etc.). Higher regression risk (visual,
  hard to verify without a browser), lower payoff than the server-side items
  above.
- **`ADDITIONAL_REDIRECT_URLS`/Google OAuth**: already fixed and confirmed
  working live this session (`ifacgroup.com` added). Nothing to do here.

---

## When you're done

Re-run the grep at the top of Item 1 to confirm zero real matches remain
(re-check for comment-only false positives the way this brief did),
typecheck every app you touched one more time as a final pass, and leave a
short note in this repo's memory system (or a new dated `*.md` brief at the
root, matching this file's own naming convention) saying what you actually
did versus what's still open — the next agent after you will thank you the
same way this brief is trying to save you time.
