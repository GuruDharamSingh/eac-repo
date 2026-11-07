# Site style on elktours (2026-11-06)

An owner's site-wide style: theme values and the looks of the header and footer, edited in a drawer over the live site. Live on elktours since the 2026-11-06 rebuild (about 12:15 EST); nothing committed. First signed-in save by the developer 2026-11-06 17:58 UTC.

## What exists

- `packages/direct-edit/src/site/style.ts` (`@elkdonis/direct-edit/site`): `SiteStyleSchema` (what a site declares in code: variables with a kind, fonts, header/footer parts), `cleanSiteStyle`, `siteStyleCss` (one function for the published page and the editor's preview), `siteStyleFontsHref`, colour conversion. Theme values go on `html:root`; a variable with `applies` is also written onto the named elements when set (elktours' body is a gradient and its fonts are literals). Chrome looks use the block-part vocabulary minus position, size and transforms; the CSS box keeps only what `partSafeDecls` allows and drops position, inset, z-index, transform and display.
- `packages/direct-edit/src/site/SiteStyleEditor.tsx` (`@elkdonis/direct-edit/site/editor`): React drawer. Theme tab (colours with contrast notes, fonts, corners), Header and Footer tabs (click a part on the page; links do not navigate while open), undo/redo, Save, Close. Refuses a value the site would not draw and says so. Switches the server sheet (`style[data-site-style]`) off while previewing.
- elktours: `src/lib/site-style-schema.ts` (11 variables, 9 fonts, header 6 parts, footer 4 parts), `src/lib/site-style.ts` (theme in `site_themes` page_key '', chrome in `site_config` `site-style:chrome`, both through the cleaner; chrome through `withOrg`), `src/lib/site-style-actions.ts` (owners and guides, `getApiEditor`), `src/components/site-style/SiteStyleButton.tsx` (bottom right, loads the editor on click), `data-chrome`/`data-part` marks in `site-header.tsx` and `site-footer.tsx`, and `app/layout.tsx` drawing the sheet and the button.

## Verified (2026-11-06)

`style.cjs` 38/38 in isolated Chromium over elktours' served CSS (fetched read-only through the edge), the real header, footer and button, and a stand-in save action that cleans as the server does: theme preview, contrast warning, fonts, corners, a hostile length refused, click-to-pick in header and footer, refused CSS (position, url, z-index), whole-header fill, hide (faint while editing, gone for visitors), undo/redo, save, close keeps the look, reload draws it, phone menu, hostile stored data (closing tags, unknown variables and regions, `constructor`/`__proto__` names). Type checks 0 in direct-edit, elktours, sunjay.

Run: `ALIAS='{"@/lib/site-style-actions":"/app/packages/direct-edit/harness/site-style/actions-stub.ts"}' W=<scratch> bash ../frankenstein/run.sh site-style/entry.tsx:ss.js -- style.cjs` with `elk.css` (the site's served CSS chunks, joined) in `$W/h`.

## Live (2026-11-06)

Rebuilt in `eac-elktours` (build `VTe7dg0k8YhHSzaZgqfFH`; backup of the previous build `~/eac-backups/next/elktours-20261106-1208.tgz`), restarted. Through the edge: `/`, `/tours`, `/about`, `/places` 200; visitor HTML carries `data-chrome` (header, footer) and the part marks, no `style[data-site-style]` and no button. The save action called signed out answers `{"ok":false,"error":"Only owners and guides can change the site's style."}`; `site_themes` and `site-style:chrome` rows for elktours: 0 after the call.

Signed-in save (developer, 2026-11-06 17:58 UTC): rows written, `site_themes` elktours '' `{"--card","--background","--foreground"}` and `site-style:chrome` `{"footer":{"root":{"fill":"#1e1a4b"}}}`; the signed-out home page through the edge carries the matching `style[data-site-style]`; no site-style errors in the container log. Reported by the developer as looking right.

## Not verified

 local fonts (not served in the harness), touch, Safari, Firefox. Contrast is checked for theme pairs only; a header part's text against its own fill is not.
