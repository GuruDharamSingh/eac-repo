# Silex and Puck across the codebase: survey

Written 2026-10-04 from three read-only surveys (Silex, Puck, and the layer
between them), each checked against code, the running containers and SELECT-only
SQL. Status words: **verified** (how), **doc-only**, **unknown**. HEAD is
`56f5639` (2026-09-23); nearly everything below the packages named is
uncommitted work in a shared tree.

## Summary

Two editors exist for different jobs. Puck edits pages inside the React apps
and is live on six hosts. Silex edits static pages and templates and is live on
one org. They share no block vocabulary, no theming path and no bridge. Four
separate "block" vocabularies exist (Puck blocks, Silex live components,
cms-bindings manifests, Studio essay nodes), plus CSS-only pens.

## Current state

### Puck

- `packages/blocks`: 40 block definitions, all `styling: "tokens"` (verified,
  grep of defs). `SHARED_BLOCKS` is 30 (`src/index.ts:87`); `STORE_PANEL_BLOCKS`
  15, `PROFILE_PAGE_BLOCKS` 23, `FEATURED_PAGE_BLOCKS` 16. `dataDriven`: 15.
  `interactive`: contact-form, gallery-grid. `blocks.css` carries the `--blk-*`
  tokens, each overridable by `--eac-block-*`.
- `packages/page-builder`: one config builder, one editor, canvas tools (drag,
  height handle, right-click menu, item focus), image/size/colour fields, a
  templates plugin, an org store (`site_config` key `puck:<path>`, depth 3,
  512 KB) and a person store (`user_pages`).
- Generic "Style" on every block (`src/style/`, prop `blkStyle`, written
  2026-10-03). The wrapper is on the published config of every host; the control
  comes only from the editor config. Verified by `scripts/smoke-style.cjs` and a
  sunjay preview. Rebuilt into all five production hosts on 2026-10-04 (each
  build checked: bundle contains `blk-style`, pages answer as before).
  No `blkStyle` is stored in any row yet (SQL). **Unverified on danamccool,
  innergathering, ifac, art-auction and artdirect beyond type-check and
  responses.**
- Hosts (run mode from `docker inspect`):

| Host | Mode | Editor | Published at | Notes |
|---|---|---|---|---|
| danamccool | prod | `/studio/[...path]` | `app/[[...path]]` | 14 site blocks, theme, menu, galleries, text style; 27 pages |
| innergathering | prod | `/studio/[slug]` | `/p/[slug]` | shared blocks only; 3 pages |
| sunjay | prod | `/studio/[slug]`, list `/manage/builder` | `/`, `/[feed]` fallthrough, event and piece templates | 26 `pt-*` blocks; `puck:home` published 2026-10-02 |
| art-auction | prod | `/panel/[orgSlug]` | rendered by ifac | store panel, 720x720, submit for review |
| ifac | prod | none (hands off to art-auction) | `person-view.tsx`, `store:1` only | 3 `user_pages` rows |
| artdirect | **dev** | `/[slug]/design`, `/[slug]/featured/design` | `/[slug]`, `/[slug]/featured` | org `oad`; no rows yet |

### Silex

- `eac-silex` runs Silex 3.9.0 (verified, `/silex/package.json`), image built
  from `packages/silex/Dockerfile`; editor at `https://edit.arts-collective.com`.
  Storage and publish go to Nextcloud through `packages/silex-nextcloud-connector`
  (`NextcloudStorage.js`, `NextcloudHosting.js:144`).
- Rendering: `packages/silex-render` (`SilexSite`, embeds, sanitiser).
  `/sites/[slug]` in arts-collective renders it when
  `organizations.layout_mode='silex'`; hidden-enneagram renders its pages with
  `SilexSiteBySlug`. **One org** uses it (17 `default`, 1 `silex`; SQL).
  Its `silex_published_at` is 2026-06-09, before the 3.9 move.
- Templates (`silex-nextcloud-connector/src/templates/`), bindings counted from
  manifests: workshop 38, dossier-classified 50, article 15, hub 10, brochure 0,
  enneagram 0, portfolio 0. Portfolio is not served to the editor.
- Live islands: 14 `<eac-embed>` components (`components.data.json`;
  `renderEmbed` handles all 14, an unknown id falls back to the org feed).
- Silex 3.9 phases: 0 done, 1 replaced by the binding engine, 2 and 3 not
  started.
- No user is on the dossier layout (all 61 `users.profile_layout='standard'`).

### Between and around

- `cms-bindings`: the hub template fails `validate:template` because three
  bindings (`lede`, `toolsNote`, `resourcesNote`) have neither `from` nor
  `fallback` (read, not run). `hideWhenEmpty` is not an engine key; use
  `omitWhenEmpty`.
- `live-editor`: mounted by arts-collective, ifac, artdirect; `ThemeStyle` and
  `site_themes` only on those three.
- Pens: four, with the `react` pointer in each manifest read by nothing; the
  link to the React twin is only the shared CSS file. `spotlight-grid` names a
  twin that `cms-ui/pens` does not export.
- `silexRoot` (`blocks/src/types.ts:359`) is set on three blocks and walked by
  nothing; `toSilexTraits` has no caller.
- `@elkdonis/studio` (essay canvas, `threads.body_doc`, 26 of 145 threads) shares
  no code with blocks or Puck.
- Theming: a change in one path does not reach the others. Crossing hooks:
  `--eac-accent` and `--eac-block-*`, plus whatever an app maps by hand.
  danamccool uses its own `site_config` `theme:palette`.

## Rules and constraints

- Puck is for pages inside the React apps; Silex is for static pages and
  templates (decision 2026-09-15). Do not build a Puck-to-Silex bridge on the
  assumption that `silexRoot` or the pens' `react` field works: neither does.
- Resolver output must be plain JSON (Puck deep-copies a `Date` into `{}`), and
  a resolver key must not equal a declared prop name.
- Read `blkStyle` only through `cleanStyle`/`styleToCss`/`cleanCustomCss`: it is
  editor-writable JSON drawn on public pages.
- Each production host serves a prebuilt `.next`: a source change needs a rebuild
  per host, and a build deploys every session's uncommitted work.

## Open items

1. **Security (verified in code, not in a live cookie).** `/api/silex/auth`
   (`apps/arts-collective/src/app/api/silex/auth/route.ts`) returns the Nextcloud
   service account's user and password (`NEXTCLOUD_ADMIN_USER`/`_PASSWORD`) to
   the connector, which stores them in the Silex session (`auth.js` around line
   101). Silex uses `cookie-session` (`/silex/dist/server/server/express.js:31`),
   which keeps the session in the browser cookie: signed, not encrypted. An
   owner or guide who opens the editor therefore probably holds that password in
   a cookie. Options: keep credentials out of the session and fetch them per
   request from the bridge; scope the account to the folders Silex needs;
   rotate the credential after a fix. Not changed.
2. Save and Publish on Silex 3.9 has never been recorded as verified.
3. Puck org pages have no draft, history, unpublish or delete (one row, save is
   publish). danamccool, innergathering and art-auction do not strip resolved
   props before saving; artdirect and sunjay do (two copies of `stripResolved`).
4. art-auction `saveStorePanel` writes the org id the client passes after a
   sign-in check only (`lib/store-panel/actions.ts`); review gates only
   `submitUserPage`. Needs a look before panels widen.
5. Fix `hub/manifest.json` (three bindings) so `pnpm check-types` in
   `@elkdonis/cms-bindings` passes.
6. Boilerplate repeated per host (config pair, save action, studio page,
   thread-feed, media routes). Byte-identical copies in innergathering and
   sunjay.
7. Style layer: confirm on the four non-sunjay hosts and on a person-page host
   (`.eac-person-slot > .eac-writing-section` in
   `packages/cms-ui/src/profile/person-page.css:163` would not match through a
   wrapper `div`).
8. A Silex live preview of bound values and a trait picker for islands (steps 2
   and 3 of "Silex over the page") are not started.

## History

- 2026-10-04: survey written; Style layer rebuilt into all five production
  hosts.
