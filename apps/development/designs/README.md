# Design handoff bundles (apps/development/designs)

Unzipped design handoffs, kept as delivered so their prototypes run. Added 2026-11-27.

## Current state
- Served at `/development/designs/<bundle>/<file>` by `src/app/designs/[...path]/route.ts`, to network admins only (`getNetworkAdmin`). Others get a 404. The folder is outside `public/` so that the gate also applies to it.
- Viewed on the idea page `/development/ideas/design-handoffs`. Each file plays in an iframe at phone (390), tablet (820) or desktop (1440) width, or filling the column. Data: `src/ideas/design-handoffs/manifest.ts`.
- `.dc.html` files are Design Components. They load `./support.js`, which fetches React 18.3.1, ReactDOM and Babel standalone from unpkg, plus Google Fonts. The viewer's browser needs network access for those.

| Folder | Received | From | Read first |
|---|---|---|---|
| `publication-surfaces-2026-11-27/` | 2026-11-27 | `Single_page_publication_template_mockups.zip`, drawn against `apps/sunjay` | `README.md` (the whole spec) |
| `elktours-surface-2026-11-20/` | 2026-11-20 | `Surface_UI_component_variations_1.zip` | `README.md`, `docs/01`–`06`, `docs/CONVERSATION.md` |

- `elktours-surface-2026-11-20/designs/apps/elktours/public/fonts/` holds byte-identical copies of `apps/elktours/public/fonts/` (checked with `cmp` on 2026-11-27).
- `support.js` is the same file in both bundles (`cmp`).

## Rules
- Keep each bundle as delivered, so that relative paths keep working. Notes go in `manifest.ts` or this file, not inside a bundle.
- Name a new bundle `<topic>-<YYYY-MM-DD>/` and add it to `BUNDLES` and `DESIGNS` in `manifest.ts`. It is served by the same route; no code change is needed.
- These files are references, not code to copy. The handoffs ask for designs to be recreated in `packages/cms-ui`, as plain CSS on `--sf-*` / `--eac-*` tokens.

## Open
- The development app runs in production mode: the new route and idea appear after its next rebuild.

## Code built from a bundle
- `publication-surfaces-2026-11-27/`: the offer-page templates, surfaces and tokens live in `packages/cms-ui/src/offer-surface/`. Start with its `README.md` (file map, data contract, how to add a template or a layer). The same catalogued for people and agents: `/development/offer-templates/catalogue` (pages) and `/development/offer-templates/catalogue.json` (one JSON document), network admins only.
