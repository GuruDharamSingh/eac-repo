# Event detail on its surface (2026-11-14)

Editing landscape, round 1, lane "fc" (`docs/open/EDITING_LANDSCAPE_2026-11-12/ROUND1.md`). Para Theater's event detail, services and writing blocks gained `parts`. These are selectors over today's markup (`apps/sunjay/src/blocks/detail-parts.ts`). "From what?" can now choose a service (`components/landing/person-records.ts`, `lib/puck/service-actions.ts`). In Puck Studio, Numbered steps' "Words under it" is a rich-text field (`lib/puck/config.client.ts` `fields.richtext`).

## Files

- **`entry.tsx`:** the canvas editor wired as sunjay's `CanvasEditor.tsx` wires it: `canvasConfig`, `canvasContract`, `records`. It uses one document in the event-detail template's shape, plus the offering card, both services layouts, one service, booking, journal, article, series list and notice. Query options:
  - `doc=a`: rich rows;
  - `doc=b`: empty and fallback states;
  - `looks=1`: a `size` look on every declared part, 10px + its index;
  - `view=published`: `<Render>` with the published shape instead of the editor.
- **`drive.cjs`** (104 checks), in five parts:
  - **A. Contract:** the 13 blocks declare parts with a root. No part name equals a prop name. Each selector is one complex selector. Word parts name text props. Record words carry no `prop`.
  - **B.** On the canvas and published, for docs a and b: every element a part's compiled rule matches draws that part's look. Every declared part is drawn by one of the documents (121/122). The exception is the offering card's open call, which appears only after a click on a live room.
  - **C.** A visitor's page with no looks gets no morph marker, style or editor attribute.
  - **D.** Ten own-word parts (headings, note, eyebrow, intro, notice title) are typed in place in the block popup and handed back. A repeated button's label typed through one card shows on every card. The notice body is stored as a paragraph. The record's own words stay locked: event title, service name, piece title, offering title.
  - **E. From what? for a service:**
    - an empty choice draws the page's own row, not the example;
    - the chooser lists the site's services, and a choice draws that service with its price;
    - only the slug is stored, with one fetch;
    - undo and redo work without a refetch;
    - clearing explains what an empty choice means and restores the page's row;
    - booking works the same way, and the popup chooser hands back in one step;
    - the saved document holds slugs only.
  - **F.** Studio's row field for the steps text is a custom field.
- **`drive-steps.cjs`** (9 checks): runs on frankenstein's `entry-popup.tsx` bundle, which is Para Theater's real `puckConfig`. When you open a step in Puck's right column, its words are in Puck's rich-text editor, drawn as a paragraph. No textarea shows `<p>`. Typing stores HTML in that row only.
- **`probe.mts`** + **`bundle-probe.cjs`** (6 checks): read only, against the live database, run inside the sunjay container.
  - Lists the stored pages, which of the 13 blocks they hold, and any stored looks.
  - Renders each stored page as a visitor gets it, with the new definitions and again with parts removed. The output must be byte-identical.
  - Checks the service loaders behind the chooser.
- **Other files:**
  - `service-actions-stub.ts`: fixtures for the chooser (aliased in);
  - `shim-nav.ts`: `next/navigation` for the probe.

## Run

W is a scratch folder whose `h/` holds frankenstein's shims, `site.css`, `editor.css` and `node_modules/playwright-core` (copy them from another harness scratch). Copy `drive.cjs` to `$W/h/drive-ed.cjs` and `drive-steps.cjs` to `$W/h/`. run.sh overwrites `$W/h/drive.cjs` with frankenstein's own driver. Docker needs sudo here, so define `docker() { sudo -n /usr/bin/docker "$@"; }; export -f docker` first.

    cd packages/direct-edit/harness
    ALIAS='{"@/lib/puck/service-actions":"/app/packages/direct-edit/harness/event-detail/service-actions-stub.ts"}' \
      W=$W bash frankenstein/run.sh event-detail/entry.tsx:ed.js -- drive-ed.cjs
    W=$W bash frankenstein/run.sh frankenstein/entry-popup.tsx:fkp.js -- drive-steps.cjs
    docker compose exec -T -w /app/apps/sunjay -e NODE_PATH=/app/apps/sunjay/node_modules:/app/node_modules/.pnpm/node_modules sunjay \
      sh -c 'node /app/packages/direct-edit/harness/event-detail/bundle-probe.cjs && node /tmp/ed-probe.cjs; rm -f /tmp/ed-probe.cjs'

## Results, 2026-11-14 (final source)

- **This folder:**
  - `drive.cjs` 104/104;
  - `drive-steps.cjs` 9/9;
  - `probe.mts` 6/6. Stored pages: `event-detail` (6 of the 13 blocks, no looks) and `try`. Both are byte-identical to a visitor. The org has no services yet.
- **Regressions on the same tree** (frankenstein, Para Theater's config): `drive-popup.cjs` 56/56, `drive-pkg.cjs` 58/58, `drive-look.cjs` 30/30.
- **Type checks** (throwaway `eac-dev`, read-only mount): sunjay 0, direct-edit 0.

## Found on the way (fixed by the direct-edit owner, system32-a2, same day)

- **`puck/mount.ts` `syncBound`:** an empty bound value counted as "draws nothing", so the page's own rows were dropped. With `service` handled, pt-service and pt-booking set to "the visitor's choice" drew the example service. Now "" is cached like any other value (E proves it).
- **`canvas/interact.ts`:** plain-text commits read `innerText`, which applies CSS `text-transform`. An uppercase eyebrow typed as "Free and online" was stored as "FREE AND ONLINE". The commit now reads with `text-transform: none !important` set for the moment (D proves it). It affected any uppercase word part on any site, including sunjay's existing card label part.
- **Puck's public `AutoField` for `richtext`:** it reads its value back by `name` from a store keyed by its own id. Forwarding the outer field's `name` drew an empty editor. `config.client.ts` now forwards neither `id` nor `name`.
