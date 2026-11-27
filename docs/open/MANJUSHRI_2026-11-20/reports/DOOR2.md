# DOOR2: two new steps, and a wider Fields lens (2026-11-22)

## Step shapes (packages/house-editor/src/steps)
- `{ op: "unset", block, prop }`: declared setting back to its declared default; no default means the key is removed. Refused: look keys, editor keys, unknown setting, slot (`slot_prop`). Already there answers `same`. (`words.ts` unsetWord, `index.ts` contentStep)
- `{ op: "bind", block, prop, record }`: `prop` must be declared with `binds`; `binds: "record"` takes `kind:id`, other kinds take an id/path/colon key (no spaces, no `<>`, no leading `//`, no `..`, 300 chars). `""` clears. Never fetches. Refusals `not_bound_prop`, `bad_record`, `unsupported_kind`.
- `set_prop` still refuses a bound setting (`bound_prop`), message now points to bind. `set_prop` on `richtext` needs `ctx.sanitizeRichText` (host passes `sanitizePageText`), else `unsupported_kind`.

## Lens (packages/house-editor/src/fields)
- `blockmap.ts`: map now offers every plain content setting: string, text, richtext (only if the host gave a sanitiser), url, image, select (options, default), boolean (default), number (min/max/step/unit), and settings filled from a record (`binds`, input "record"). Not offered: colours, rows, lists, slots, the look and editor keys (a block's own `look` choice is reserved). Settings no part draws are `others`.
- `scan.ts`: a block with `others` gets its own box as a field named `*` (clicking the block opens its first such setting).
- `blocks.ts`: `stepFor` turns each saved value into one step (bind / unset when empty for select, boolean, number / set_prop with a typed value); load returns every offered setting as text; `sanitizeRichText` option; `site.ts` passes it through.
- `registry.ts`: FieldSpec gains default, range, binds; `checkValue` refuses numbers outside the range, switches that are not true/false, records with spaces.
- `FieldsLens.tsx`: block panel shows ONE value at a time with "Another setting of this block" list; controls: select (shows "Default (x)"), checkbox, number with unit and range, link, picture (host chooser; not offered if the host has none), rich text (cms-ui editor), record ("Comes from: ..." + Choose another / clear, via new `records` prop; without sources it is read only with a reason). "Back to the default" sends an unset.
- sunjay: `lib/fields-blocks.ts` (sanitizer, map from the door), `components/fields/FieldsLensMount.tsx` (records from person-records).

## Checks
check-steps 87 -> 143; check-fields 102 -> 155. tsc: house-editor, page-builder, sunjay 0 errors before the lens edits' last run and after (one transient error seen mid-way in the CANVAS lane's tree-editor.ts, gone on the final run).

## Signed in (sunjay dev copy, localhost:4032, `.next` in scratch, test editor, every save aborted)
Page /try. Lens on, 37 block fields, 24 block boxes. One of each opened, changed, Save pressed, request captured and aborted:
url `ctaHref`, image `imageUrl` (host picker, "This site" tab), text `title`, textarea `body`, number `scrim` 60->70, select `align`, boolean `rule` ("false"), record `which` -> "next", rich `body` (HTML). Requests are `{"kind":"block","id":"try:...","values":{...},"version":...}`; the step is made on the server by `stepFor` (proved in check-fields). Visitor sees no bar. Screenshots and log: `~/scratch/manjushri/door/shots/`, `run.log`. Dev copy stopped; next-env.d.ts restored.
Note: `/` crashes the dev server on compile (container exits, not from this change as far as seen); /try used instead.

## Left out / limits
rows and lists (as asked); colours (look panel); richtext on the other sites (elktours, hidden-enneagram, innergathering) until each passes `sanitizeRichText` to createSiteFields; images need a host `choosePicture`; record choice needs `records`. Only sunjay passes `records`.

## Rebuild
sunjay (eac-sunjay is a production build). elktours, hidden-enneagram, innergathering pick up the wider map on rebuild (no change to their files).
