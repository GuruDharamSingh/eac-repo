# Track nexus

Structure for the dock and LMS rails (Justin, 2026-11-16: "a nexus of tracks ready for possible courses to be the users' rails"). No course content and no tutorial wording here.

- **Track**: a short, reusable segment toward one outcome. `{id, area, label, steps, requires, provides?, leads_to, status: 'candidate'}`. `steps` are atlas capability ids, or `{ gap }` when no capability exists yet. `label` is internal and dry.
- **Gate**: a named readiness check on one person's state. `{id, label, resolver, param?}`. Resolver is `gates:<fn>` (read-only function in `src/server/gates.ts`, `unknown` instead of throwing when a table is missing), `services:<fn>`, `status:<entry>` (an existing registry check) or `todo`.
- **Nexus**: tracks joined by `leads_to` and, implicitly, by `requires` to the track that `provides` that gate. It must have no cycles.
- **Course**: an ordered pick of tracks, general to specific (`courses.ts`). The course tags `area` and `builds_on` (lms_courses, migration 277) are derived from the nexus: a track that needs a gate provided in another course makes that course something this one builds on. `check-rails` fails when a course's `builds_on` does not reach it.

Files: `types.ts`, `gates.ts` (declarations), `<areas>.ts` (tracks), `courses.ts` (candidate courses), `index.ts` (loader). Check and report: `pnpm --filter @elkdonis/actions check:rails` (throwaway container, as for `atlas:check`) writes `atlas/reports/rails-nexus.md`: graph by area, candidate courses as paths, and the gap list (steps with no capability, steps with a capability but no registry entry, gates still todo). That gap list is the work the MCP and the dock still need.

Upkeep: a new capability that fits a track goes into its `steps`; a `{ gap }` that gets a capability is replaced by its id.

MCP, later: a track becomes an MCP prompt (the ordered steps and what each needs), and a gate becomes an MCP resource (the person's state, read before choosing a track). Gates stay read-only. A step that is a money entry stays link-only, as in the dock.
