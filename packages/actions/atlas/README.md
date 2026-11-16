# The action atlas

A map of every thing a person can do on the EAC network: where it happens, who may do it,
what it risks, and how we know it's done. It is the rails' source (the dock and LMS courses)
and the MCP's source (tools, prompts, `ui://` views). Plan:
`docs/open/mcp-foundations/DOCK_RAILS_PLAN.md` (L1, L2; decisions D-13 and D-16).

## Files

| Path | What | Edited by |
|---|---|---|
| `types.ts` | the shapes: `InventoryHost`, `Capability`, `Host`, `Address`, `Wording`, `Ignored` | hand |
| `inventory.json` | every write host in the repo (server actions, write routes, raw SQL) | **generated**: `scripts/atlas-inventory.mts` |
| `areas/<app>.<area>.ts` | curated capabilities plus ignored keys, one file per area | hand (curation) |
| `index.ts` | collects every area | hand (add a line per new area file) |
| `reports/coverage.md` | per app and area: hosts, claimed, ignored, unclaimed; registry coverage | **generated**: `scripts/atlas-reports.mts` |
| `reports/drift.md` | capabilities whose hosts call different services or write raw SQL: candidates to homogenise | generated |
| `reports/wording-wave-NN.md` | confirm wording for Justin to review, with an explanation brief per row | generated, then Justin answers in it |
| `JOURNAL.md` | curation log: conventions decided, judgement calls, open questions, what's next | hand, append-only |

## Commands (any container with the workspace at /app; Node 20 as with check:registry)

```
cd ~/eac && sudo -n docker compose run --rm --no-deps -w /app/packages/actions admin \
  sh -c 'pnpm --filter @elkdonis/lms exec tsx ../actions/scripts/atlas-inventory.mts'
# same pattern for check-atlas.mts and atlas-reports.mts
```

## Rules

- Never hand-edit `inventory.json`. Regenerate it.
- A capability claims hosts by key (see `HostKey` in `types.ts`). Each inventory key is claimed by
  exactly one capability or ignored with a reason. `check-atlas` fails otherwise.
- `class: 'person'` rows are rail candidates. They need `risk`, `status` (or "unverifiable: why"), an
  `address` on at least one host, and a `confirm` draft.
- Confirm wording starts as `draft`. `atlas-reports` gathers drafts into a wave. Justin's answers
  set `approved` / `changed`, plus a `note`. Only `approved` wording may reach a live dock.
- `money` risk means the dock links, never runs.
- Drift is recorded, not fixed. Code is merged to the `canonical` path in a separate, approved pass.
- Write judgement calls in `JOURNAL.md` (date, area, decision, why), so the next session picks them up.
