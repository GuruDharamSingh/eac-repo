# Featured person (2026-11-06)

A block that shows one person, chosen from a record, with a shared "From what?" chooser in the canvas editor. Built for the elktours landing page; live since the 2026-11-06 18:29 EST rebuild, nothing committed.

## What exists

- `packages/services/src/featured-people.ts` (`@elkdonis/services/featured-people`): the reference grammar (`user:<uuid>`, `thread:<id>:author|next-host|next-guide`), `resolveFeaturedPerson`, `listPersonSources`, `listPersonChoices`.
  - The associations it reads: `threads.author_id`; `meeting_hosts` of the thread or of its series' sessions (through `series_sessions`), with the stored `role`; and `tour_departures.guide_user_id`.
  - People who RSVP'd are not read. There is no default person.
  - A person is shown only with a public `org_profiles` row in the site's org and `users.entity_type = 'person'`. A thread is read only when it is the org's, published, `PUBLIC` and has no `min_role`.
- `packages/blocks/src/blocks/featured-person.tsx` (`featuredPerson`, not in `SHARED_BLOCKS`):
  - the prop `person` (`binds: "person"`); `who` comes from the host's resolver;
  - parts: root, portrait, body, name, role, via, bio;
  - styles in `blocks.css` (`.blk-fperson*`).
- `packages/direct-edit/src/canvas/records.ts`:
  - `RecordSources` (host-supplied lists and resolution), `mountRecordChooser` (drawer: sources, filter, follows/fixed choices, clear), `Binding`;
  - `tree-editor.ts` shows a bound prop as a "Who" field with Choose…/Change…;
  - `edit-shell.ts` `openDrawer`;
  - `puck/mount.ts` keeps what each value drew in a cache keyed by block type, prop and value. The cache is shared with the popup and never stored, so undo and the popup's discard draw the right person.
- elktours:
  - `lib/featured-person.ts` (resolver bound to the deployment's org; person page `/about/<slug>`);
  - `lib/featured-person-actions.ts` (owners and guides);
  - `components/landing/person-records.ts` (contract + `records`);
  - `page-editor-mount.ts` (passes `contract`, `records`, `resolved`);
  - `app/page.tsx` (hands the editor what stored people drew);
  - `lib/puck/config.{client,server}.ts`: Featured person added, `morph: MorphMark`, and `buildPuckConfig` imported from `@elkdonis/page-builder/config`.

## Verified (2026-11-06)

- **`featured.cjs` 41/41** in isolated Chromium. It runs on elktours' real canvas config, contract and `person-records.ts`, with the server actions stubbed (`actions-stub.ts`). It covers:
  - a stored person is drawn without a fetch;
  - the chooser opens with Choose… (no text box), and the filter works;
  - choosing a person from the site's people;
  - undo and redo with no new fetch;
  - a following choice draws today's person and their stored role;
  - a person with no public profile is disabled;
  - clearing the choice;
  - choosing in the popup, then "Use on this page" as one undo step;
  - Discard after the leave-prompt leaves the page and its panel unchanged;
  - the save holds references only;
  - placing a new one from the right-click menu (it asks who, with the chooser selected);
  - visitor output: nothing for no one; hostile values escaped; `javascript:` and `//` links dropped.
- **`probe.mts` and `probe-thread.mts`, read only, against the live database:**
  - elktours' site people list Dana McCool and Guru Dharam Singh; the 30 place profiles are excluded;
  - the Napoléon tour offers "Its author", which resolves to Dana;
  - Para Theater series `bl0whFnG6dS_7J9NvvLyS` "Host of the next session" resolves to the stored `host` row for 7 Nov, with `co-host` listed.
- **`published.mts`, bundled by `bundle-node.cjs` in the elktours container, read only.** elktours' server config resolves and draws:
  - Dana with a `morph` on her name (scoped style);
  - the tour author;
  - nothing for a tour with no guide on a departure, for another org's series, for a place profile, and for a forged `who` with no reference.
- `tsc --noEmit` 0 in elktours and direct-edit. blocks and services still report errors in files this work did not touch (`services/src/gather.ts`, `utils/src/sanitize*.ts`).

## Page builder on elktours (2026-11-06, live since the 21:20 EST rebuild)

- **Routes:**
  - `/manage/builder` (page list, new page; a "Page builder" tab in Manage);
  - `/studio/<slug>` (`components/studio/page-editor.tsx`): Puck with the parts plugin, the block popup and `developer: false`;
  - pages served at `/<slug>` by `app/[feed]/page.tsx` when no section has the name (`lib/puck/render.tsx`).
- **Blocks:** one catalogue for the landing canvas, the popup and Studio (`lib/puck/catalogue.ts`): 15 shared blocks and Featured person. The box blocks are included too; Studio leaves out "Live part".
- **Naming and saving:**
  - reserved names in `lib/puck/reserved.ts`; a section's name is refused;
  - save is `savePageAction`, owners and guides only, with `who` stripped first (`lib/puck/resolved.ts`).
- **Featured person in Studio:**
  - Puck's right panel shows "Who" with the same chooser (`components/studio/person-picker.tsx`);
  - the Studio popup gets `records` (`direct-edit/src/puck/studio-popup.ts`).
- **Harnesses:**
  - `studio.cjs`, 16/16: Studio's real config. It checks that the person resolves, the panel chooser redraws the block, the popup chooser hands back, and Publish sends the reference.
  - `strip.mts`: 6/6 on elktours' own walker; since 22:35 EST, 12/12 on the shared `stripResolvedKeys` with elktours' keys. It covers top level, zones, two slot levels, a slot inside an object prop, rows, a stored `__proto__`, and keeping other blocks' props.
  - The Studio harness inlines its CSS. In this sandbox, Puck's canvas loader never cleared while its CSS came through a mirrored `<link>` (observed, cause not found).
- **Live (2026-11-06 21:20 EST):**
  - build `skEkqaiLsbrTEcn1yQJrD`; the previous build `-alyIh6W0u-x6jKVzf2u6` is backed up at `~/eac-backups/next/elktours-20261106-2108.tgz`.
  - Through the edge:
    - `/`, `/tours`, `/about` and `/places` return 200;
    - `/hub`, `/manage/tours`, `/manage/builder` and `/studio/walking-notes` send signed-out visitors to sign in (307);
    - a page name with no stored page returns 404;
    - the home page is unchanged for visitors;
    - the Studio chooser is in the client chunks, and the Manage server output has no Getting paid.
  - Not yet used signed in.
  - In source after the rebuild: a signed-out Stripe return now asks to sign in toward `/hub`, not `/manage`.
- **Getting paid:** removed from `/manage/tours`. Stripe's return (`app/api/payouts/return/route.ts`) now lands on `/hub#payouts`, where the same card is.

## Run

```bash
W=<scratch with h/elk.css, h/node_modules/playwright-core>; cp featured.cjs $W/h/
ALIAS='{"@/lib/featured-person-actions":"/app/packages/direct-edit/harness/featured/actions-stub.ts"}' W=$W bash ../frankenstein/run.sh featured/entry.tsx:fp.js -- featured.cjs
docker compose exec -T -w /app/packages/services elktours /app/packages/services/node_modules/.bin/tsx /app/packages/direct-edit/harness/featured/probe.mts elktours
docker compose exec -T -w /app/apps/elktours -e NODE_PATH=/app/node_modules/.pnpm/node_modules elktours sh -c 'node /app/packages/direct-edit/harness/featured/bundle-node.cjs && node /tmp/fp-published.cjs; rm -f /tmp/fp-published.cjs'
```

esbuild resolves `export * from "./blocks"` in `packages/blocks/src/index.ts` to `blocks.css` unless `resolveExtensions` leaves `.css` out (`bundle-node.cjs`). Next and tsc resolve the folder.

## Live (2026-11-06)

elktours rebuilt in `eac-elktours`: build `-alyIh6W0u-x6jKVzf2u6`, backup of the previous build (`VTe7dg0k8YhHSzaZgqfFH`) at `~/eac-backups/next/elktours-20261106-1828.tgz`; restarted. Checked through the edge:

- `/`, `/tours`, `/about`, `/places` return 200; `/login` returns 307.
- The visitor home page draws the stored tree with no editor markup.
- `.blk-fperson` rules are in the stylesheet the home page links; the chooser ("From what?", `.de-rec-*`) is in the editor's chunks.
- The container log has no errors.

## Not verified

- Not opened signed in on elkdonisexperiences.com.
- Picture loading (the fixture photos are offline), touch, Safari, Firefox.
- Puck Studio's own right panel still shows `person` as a text box: page-builder has no chooser for `binds: "person"` yet.
