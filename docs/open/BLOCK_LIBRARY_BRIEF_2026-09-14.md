# React block library — direction, and where Puck fits

**Date:** 2026-09-14
**Status:** direction. Steps 1-3 built (`packages/blocks`); steps 4-7 open.
**Updated:** 2026-09-14 — groundwork laid, see "What was built" at the end.

---

## The question

Is Puck (`@measured/puck`) an easy add-on for giving supported-tier orgs a
drag-and-drop editor over custom React components, alongside Silex for the
free tier?

## The answer, short

Puck itself is easy — one dependency, a client editor route, a JSON blob in
`site_config` (no migration needed), and `<Render config data />` on the page.
Roughly a day for a working spike.

**But it is early.** The value of a page builder is the blocks, not the
builder. Today there are 14 embed components (Silex-shaped, string-typed
attributes) and 4 pens. A drag-and-drop editor over six usable blocks is a toy,
not a sense of ownership.

**Recommendation: build the React block library first.** It is needed anyway —
supported sites are hand-assembled React either way, and every block written
serves them immediately whether or not anything ever drag-and-drops. If the
library is built with Puck in mind (see "The one step that matters" below),
adding Puck later is a weekend. If the blocks never accumulate, nothing was
lost by not installing it.

---

## What exists today

Five authoring systems, overlapping:

| System | Edits | Location | Real usage |
|---|---|---|---|
| Silex/GrapesJS | whole pages, visually | `packages/silex-nextcloud-connector/` (11.3k), `silex-render/` (2.8k), `cms-bindings/` (3.6k) | **1 org** |
| live-editor | `[data-trait]` text, `[data-theme-vars]` CSS vars, in place | `packages/live-editor/` (1.4k) | ifac, hidden-enneagram |
| cms-ui compose/wizard/surface | structured thread fields | `packages/cms-ui/` (19.2k) | everywhere |
| `org_site_sections` | labelled copy fields | `apps/*/src/app/manage/pages/` | 4 orgs, 18 rows |
| `site_themes` | `{"--name":"value"}` per org/page/user | migration 090 | 1 row |

### Numbers worth knowing

```
hidden-enneagram | supported | silex     ← the only published Silex site
13 orgs          | free      | default   ← zero free orgs on Silex
amrit_canada     | supported | default
ifac/inner_group | partner   | default
```

- ~17,700 lines of Silex pipeline currently serve **one site**.
- 7 Silex templates exist (`article`, `brochure`, `portfolio`, `workshop`,
  `hub`, plus org-specific `enneagram` / `dossier-classified`). Only
  `enneagram` has ever been published. The five generic ones have never been
  exercised end-to-end by a real member.
- **`template_id` does not exist** — not as a column, not anywhere in
  `apps/arts-collective/src` or `packages/services/src`. A signing-up member
  has no way to pick a template. This is the free tier's blocker and it is
  still open from the July audit.
- `organizations.layout_mode` (`'default' | 'silex'`, migration 035) is
  already the right hinge for a third mode. `apps/arts-collective/src/app/sites/[slug]/page.tsx`
  branches on it.

---

## The tier split

The intent: free tier = subdomain + a few templates + Silex; supported tier =
custom React components with Puck for a sense of ownership.

Two notes on that:

**1. Hang the editor off `layout_mode`, not `tier`.** Tier changes when money
changes; `layout_mode` changes when someone migrates their site. Deriving the
editor from the tier means a failed card swaps a live site's renderer. Gate the
*upgrade action* on `tier='supported'`; store the result in `layout_mode`.
Adding `'puck'` to the CHECK constraint is a one-line migration.

**2. Both tiers are a build, and the tiers currently run opposite to the plan.**
The only Silex site is a *supported* org. All 13 free orgs are `default` —
they land on `OfferingPage`, the three templated React pages
(offering / profile / community). So the free tier is not on Silex today, and
the free-tier Silex path is the *less*-proven of the two.

### The upgrade path is the thing to protect

A member builds on free/Silex, likes it, pays for supported. If the Silex block
library and the React block library are unrelated, upgrading means **their site
is deleted and rebuilt** — at the exact moment they hand over money.

The pens already show the seam that avoids this. Each pen is a Silex block
(`pen.html` + `pen.css` + manifest) *and* a React twin, and the manifest names
the twin explicitly:

```json
"react": "@elkdonis/cms-ui/pens SpotlightGrid"
```

That line says a block has **one identity and two renderers** — not that there
are two libraries. Keep that. It makes the upgrade mechanical: walk the
published HTML, match each section root to a block id, emit Puck JSON. The
binding engine already parses that HTML with `node-html-parser`.

**Two genuinely independent libraries is the version that strands people
mid-upgrade.** Prefer one catalogue, two renderers.

---

## Logical steps to the library

### 1. Decide what a block *is* — one shape

Today there are two half-registries:

- `packages/silex-render/src/components.data.json` — 14 entries
  (`Rsvp`, `OrgFeed`, `WorkshopCards`, `Poll`, `Countdown`, `Directory`,
  `BlogCards`, `Inquiry`, `Resources`, `Live`, `Login`, `MediaUpload`,
  `CommunityFeed`, `BlogCardsOverlay`), each with `tag`, `label`, `props`,
  `memberSafe`. All props are strings (`data-limit`), because they arrive as
  HTML attributes.
- `packages/silex-nextcloud-connector/src/pens/*/manifest.json` — 4 pens with
  `traits` and a `react:` pointer.

Merge into one `BlockDef`:

```
id, label, description
props: [{ name, kind: 'string'|'number'|'boolean'|'select'|'list', default, options }]
memberSafe: boolean
react:  the presentational component
silex?: { html, css, root }   // only for blocks that have a Silex twin
```

Props declared as *data* is what makes this Puck-ready without mentioning Puck:
the same array feeds the Silex editor's traits, prop coercion from string
attributes, and — later — a Puck `fields` map.

### 2. Pick a home: a new `@elkdonis/blocks` package

Not inside `cms-ui`. Two reasons:

- `cms-ui` is the **members' area** furniture (surface / face / hub / compose).
  Blocks are **public page** furniture. Different consumers.
- `cms-ui` carries Tiptap and react-grid-layout. A Silex registry consumer or a
  Puck config should not pull those in.

### 3. Split every data-driven block in two — *the one step that matters*

This is the highest-value step and the one that makes Puck nearly free later.

Every block that reads the database becomes a pair:

- **a pure presentational component** — props in, markup out, no `async`, no DB
- **a server wrapper** — fetches, then renders the presentational one

Why this is worth doing regardless of Puck: presentational halves are
testable, reusable across pages, and renderable in any preview context.

Why it matters *for* Puck: Puck's editor renders components live, on the
client, in an iframe. `OrgFeed`, `WorkshopCards` and `Directory` are server-side
and do database reads — they cannot render there as-is. With the split, the
editor renders the presentational half fed by sample data or an API route
(Puck's `resolveData`). Without the split, every block needs a bespoke
edit-mode variant, and that is the cost that makes Puck stop being an easy
add-on.

### 4. Convert what already exists

The 14 embeds and 4 pens *are* the catalogue. This is a migration, not new
invention. The main real work is typing the props: they are all strings today,
so `BlockDef` needs a coercion step so both renderers agree on what `limit=3`
means.

### 5. Make the registry the single source

`silex-render/src/components.ts` already states this as its design —
"three consumers, all reading the same table" — and notes the drift it was
written to fix (catalogue declared 12 components, editor offered 8). The Silex
editor already fetches the JSON over HTTP at `/eac-components.json`. Realize
the intent: renderer, editor, and later the Puck config all map over one list.

### 6. Prove it on one real page

Pick `amrit-canada` (8 `org_site_sections` rows, already has a `/manage` shell)
or `danamccool` (27 near-static hand-written pages, owner can edit nothing).
Render one genuine public page out of blocks. If it looks right and the org can
still theme it, the library works.

### 7. Only then, Puck

Scope it to one app behind `layout_mode='puck'`. Don't touch shared packages,
so backing out is `git revert` rather than an extraction. Config generated from
the registry; data in `site_config`; no new table.

Practical note: decline the modules-purge prompt on the install
(`printf 'n'`) or it wipes `node_modules` for all workspace projects.

---

## Styling — short version

The mechanism is already designed and mostly built. The gap is **wiring**, not
design.

**Three vocabularies exist:**

1. **App layer** — 8 of 9 checked apps speak the shadcn set
   (`--background`, `--card`, `--border`, `--primary`, `--accent`, plus the
   Tailwind v4 `--color-*` mirrors). Only `danamccool` is idiosyncratic
   (7 bespoke vars); `ifac` has the shadcn set plus ~40 extras.
   **This is the de-facto shared vocabulary — target it.**
2. **React component layer** — per-module private vars with a fallback chain:
   `--sf-*` (surface), `--fld-*` (fields), `--ed-*` (editor), `--cmp-*`
   (compose), `--eac-files-*`, `--eac-profile-*`. The pattern is
   `private ← public hook ← app var ← hardcoded fallback`, e.g.
   `--sf-bg: var(--eac-surface-bg, var(--paper, var(--surface, #ffffff)))`.
   This is the right pattern. Copy it for blocks.
3. **Silex block layer** — `eac-tokens.css` (`--eac-color-*`, `--eac-space-*`,
   `--eac-text-*`). React components don't consume this at all.

**Wiring status** — how many `--eac-*` hooks each app actually sets:

```
innergathering 30   amrit-canada 22   ifac 17   hidden-enneagram 17
elastrocal 7
arts-collective 0   art-auction 0   pigeonshoot 0   danamccool 0
```

An unwired app falls back and still renders correctly — it just looks generic.
That is the whole of the "styling hasn't been hit strongly" problem: five apps
were never wired up.

**Three rules for new blocks:**

1. **Plain CSS + custom properties, never Tailwind utilities.** `ifac` and
   `artdirect` carry their own stylesheets; utility classes render unstyled
   there. Already documented at the top of `surface.css`.
2. **Expose one public hook per visual role**, named `--eac-block-*`, with a
   fallback to the shadcn var and then a hardcoded default. An org that sets
   nothing gets something correct.
3. **Every accent needs a paired on-accent token.** This is a recurring
   real bug, not a theoretical one: white on IFAC's gold is 2.58:1. Raw org
   accents fail 4.5:1 — use derived deep/kicker mixes.

---

## Open questions

1. **Does `OfferingPage` survive?** It is the free tier today — three templated
   React pages, 13 orgs, no editor. Under the tier plan free members get Silex,
   which is strictly more editing power. Is `OfferingPage` (a) what a member
   gets before publishing a Silex site, (b) retired once Silex provisioning
   works, or (c) actually the real free tier, with Silex as a middle rung?

2. **Does the free tier ship before any of this?** `template_id` is still
   missing, so no member can choose among the 7 templates. That is the volume
   path and the known gap.

3. **Do Silex blocks stay twins of React blocks**, or diverge? This decides
   whether free→supported is a migration or a rebuild.


---

## What was built (2026-09-14)

`packages/blocks` — `@elkdonis/blocks`. 1,264 lines. Type-checks clean;
22 runtime checks pass. **No app consumes it yet**, and nothing has been
deleted from the apps it was harvested from.

### The number that changed the plan

The brief above proposed sourcing the library from the 14 Silex embeds. That
was wrong — those are the Silex-shaped leftovers. The real library is what is
already built in the apps:

```
amrit-canada vs innergathering: 42 byte-identical component files, 4,697 lines
only 3 files genuinely differ (site-header, site-footer, HubSurfaces — the chrome)
plus 7 shadcn primitives triplicated into ifac
```

`section-banner` has now been written five times: three copies inside
amrit-canada (per its own comment), then once in each of two apps.

### Steps 1-2 — done

`BlockDef` / `PropDef` in `src/types.ts`, catalogue in `src/registry.ts`.
Props are declared as **data**, and `PropsOf<typeof props>` derives the
component's TypeScript props from that same array — so one declaration drives
the component's types, a Silex trait panel (`toSilexTraits`), attribute parsing
(`propsFromAttributes`), and a Puck field map (`toPuckFields`).

`@measured/puck` is **not** a dependency. `src/editor.ts` types its field shape
locally and imports nothing — enough to show the catalogue can drive an editor,
without the repo taking one on. Unverified against Puck's real types.

`createCatalogue([...SHARED_BLOCKS, ...orgBlocks])` composes, so a
supported-tier org gets bespoke blocks beside the shared set without a fork.

### Step 3 — done, for one block

`thread-feed` ships as a pair:

- `src/blocks/thread-feed.tsx` — presentational. No `async`, no db.
- `src/server/thread-feed.server.tsx` — fetches, renders the above.

Two entry points (`.` and `./server`), so importing a block to display it never
pulls `@elkdonis/db` into the graph.

The server half writes `org_id`, `status` and `visibility` into the query
itself rather than letting a caller compose them, because `threads` is a shared
namespace and `kind` is open-ended — a feed that forgets one of those clauses
puts another org's rows, or an unpublished draft, on a public page.

### Step 4 — started (4 of many)

| id | harvested from |
|---|---|
| `hero-banner` | amrit-canada — **content was hardcoded**, incl. a hotlinked image |
| `section-banner` | `feed-banner.tsx`, identical in 2 apps |
| `cycle-badge` | `cycle-badge.tsx`, identical in 2 apps; lucide → inline SVG |
| `thread-feed` | the inline mapping in `[feed]/page.tsx` |

All four converted from Tailwind utilities to `--eac-block-*` tokens, so they
work on ifac and artdirect too.

Two behaviours worth keeping in view, both verified by the smoke test:
an unknown cycle status renders **nothing** rather than guessing (claiming a
4am gathering is "on" when the row says something unrecognised is the
locked-door failure the original comment warns about), and an empty feed states
it is empty rather than vanishing.

### Still open

1. **Port one page.** Nothing consumes the package. Until an app renders from
   it and its duplicate is deleted, this is a library of four components
   nobody uses.
2. **`silexRoot` is declared but unused** — the free→supported migration seam.
3. **`node_modules/` is hand-linked.** `pnpm install` fails on this checkout
   with `EACCES` on a root-owned `node_modules/.bin`, so `@types/react`,
   `@types/node`, `react` and `react-dom` are symlinks into the pnpm store.
   A real install in the container replaces them.
4. The 19 shadcn `ui/` primitives are a **separate** extraction from blocks —
   different concern, and they are duplicated 3-4×.
