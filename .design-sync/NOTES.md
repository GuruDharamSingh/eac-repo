# design-sync notes: EAC design system

Synced package: a wrapper entry, `.design-sync/entry/` (`@elkdonis/eac-design-system`, global `window.EAC`).
It re-exports source from three workspace packages; none of them has a `dist/` build.

## Scope (Justin, 2026-11-07)
- Represent the platform's current direction, not every package:
  - `@elkdonis/series-site` components: the IFAC series and session building blocks, in the dark `.ifs` look.
  - `@elkdonis/cms-ui/surface`: Surface UI. A card opens a popup, which can also be a detail page. It holds the on-site CMS.
  - `@elkdonis/blocks`: Puck page blocks. Secondary, but new components should follow their prop shapes.
- Left out on purpose:
  - hub faces, compose, wizard, email, files, studio and forms ("not well hashed out").
  - cms-ui/whiteboard (Excalidraw).
  - cms-ui/manage (next/navigation; not in scope).
- shadcn: Justin may move away from it if it conflicts with Puck. Don't build the base on shadcn.
- Look: no settled look yet. Lean on IFAC: dark, light text, simple and clean.
- Principles: a focus/studio toggle; popups for expanded views at several levels; editing in place
  without opening the studio; smart Puck components that adapt content to their layout context.
- Possible later: the shadcn MCP (`npx shadcn@latest mcp`), for authoring new components.

## Build (run from the eris repo root `~/eac`)
- Node: the host has no system node. Use `source ~/.nvm/nvm.sh` (v20.20.2).
- `node .design-sync/build-theme.mjs` (cfg.buildCmd) compiles `apps/ifac/src/app/globals.css` with the app's own
  `@tailwindcss/postcss` (Tailwind 4.1). It adds `@elkdonis/series-site/site.css` and `@source` lines for blocks,
  series-site, cms-ui and the previews. It writes `.design-sync/entry/theme.css` (cfg.cssEntry) and copies the
  `/fonts/` files from `apps/ifac/public/fonts`. It also generates `stubs/baroque-signup.css` (see below).
  Then run package-build with `--node-modules packages/cms-ui/node_modules`.
- Fonts: Cormorant Garamond and Source Sans 3 come from Google Fonts, with the same URL as
  `apps/ifac/src/components/site/chrome.tsx`. Public Sans was added for the surface.css skins. Basteleur and
  Brothers are local files.
- Render check: eris lacks chromium's system libraries (libatk and others), so don't install anything there. Run
  validate and capture in the local image `mcr.microsoft.com/playwright:v1.60.0-noble`, with `.ds-sync` pinned
  to `playwright@1.60.0`:
  `sudo -n docker run --rm -v "$HOME/eac:/work" -w /work --user "$(id -u):$(id -g)" -e HOME=/tmp mcr.microsoft.com/playwright:v1.60.0-noble node .ds-sync/package-validate.mjs ./ds-bundle`
  (The cached `~/.cache/ms-playwright/chromium-1228` matches playwright 1.61.x, but can't launch on the host.)
- `@types/react`: the entry dir has no node_modules, so link
  `.design-sync/entry/node_modules/@types/react -> ../../../../.ds-sync/node_modules/@types/react`
  (gitignored; recreate on a fresh clone). Without it every prop type resolves to `any`.

## Bundling fixes (all in .design-sync/entry, no package code changed)
- `blocks/src/index.ts` has `export * from "./blocks"`. esbuild resolves that to `blocks.css` (it tries an
  extension before a directory index), so all 50 blocks vanished. The entry re-exports
  `blocks/src/blocks/index` explicitly. Next/webpack resolves the folder, so the live apps are unaffected.
- `next/server` is pulled in via `@elkdonis/utils` (api-response.ts) and crashed the bundle (`__dirname`).
  `next/navigation` is used by series-site (`useRouter`). Both are aliased to `entry/stubs/*` through
  `entry/tsconfig.json` paths (cfg.tsconfig = "tsconfig.json", resolved relative to the entry dir).
- `process.env.NEXT_PUBLIC_*` is read at module scope (utils/constants, auth-client, cms-ui/auth).
  `entry/process-shim.ts` defines an empty env and must stay the entry's first import.
- `@elkdonis/cms-ui/baroque-signup.css` (imported by series-site join-frame) references a `.webp`, and esbuild has no
  loader for it. The import is aliased to a generated copy with the image inlined as a data URI.
- Name clash: cms-ui/gallery and blocks both export `ProfileGallery`. gallery isn't in scope now; if it comes
  back, the blocks one should win (explicit re-export).
- `PreviewFrame` (entry/preview-frame.tsx) is preview-only scaffolding and isn't a platform component. Its job
  is to paint the `.ifs` root, because the card pages hard-code `body{background:#fff}`. It's cfg.provider and
  excluded from components (`componentSrcMap: null`).
- Groups come from source folders (cfg.srcDir = ../../packages). Components defined in shared files
  (SurfaceShell.tsx and others) are pinned in componentSrcMap so they land in surface/surfaces/blocks/series-site.

## Known render warns
- (none triaged yet: the RENDER_BLANK warns on unauthored cards are the dark PreviewFrame with nothing in it)

## Re-sync risks
- theme.css is compiled from apps/ifac globals.css: IFAC style changes alter every card (a re-sync picks them up).
- The Google Fonts URL is copied from ifac chrome.tsx; if IFAC changes families, update build-theme.mjs.
- The stubs (next/server, next/navigation, process-shim) hide server paths. A component that really needs the
  router or env renders inert in the design tool.
- The blocks `./blocks` vs `blocks.css` resolution trap: if blocks/src/index.ts changes its re-exports, check
  that the explicit folder re-export still covers them.
- The SeriesTop/SessionRows `.d.ts` files name `SeriesTopWeek` and `SessionRowItem` without declaring them.
  Consider `dtsPropsFor` if the agent misuses them.
