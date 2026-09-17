# @elkdonis/blocks

Page blocks for public org sites. One catalogue of presentational React
components, declared as data.

## Why this exists

The same components had already been written several times. Between
`apps/amrit-canada` and `apps/innergathering` alone, **42 component files are
byte-identical — 4,697 lines** — and seven more shadcn primitives are
triplicated into `apps/ifac`. `section-banner` here is the third home for
markup whose own comment records that it replaced three hand-written copies
inside a single app. So it has now been written five times.

Duplication is only half the problem. The other half is that content was welded
to markup: `hero-banner.tsx` in amrit-canada had its title, subtitle and image
URL as module-level constants, so the owner of that site could not change a word
of their own hero without a developer and a deploy. The image was hotlinked from
a news site, with a comment noting it would break when that site changed it.

## The one idea

**A block's props are declared as data, not only as a TypeScript interface.**

A TS interface disappears at runtime, so anything offering "edit this block's
settings" has to re-describe the same props by hand. That is exactly how the
Silex catalogue and the Silex editor drifted apart once already — the catalogue
declared 12 components while the editor offered 8. One `PropDef[]`, read by
every consumer, is the fix.

The types are still generated *from* the data, so an author writes the props
once and gets both:

```ts
const props = [
  { name: "limit", kind: "number", label: "How many", default: 10 },
  { name: "layout", kind: "select", label: "Layout", default: "list",
    options: [{ value: "list", label: "List" }, { value: "grid", label: "Grid" }] },
] as const;

export type MyBlockProps = PropsOf<typeof props>;   // { limit?: number; layout?: string }
```

One declaration then drives:

| Consumer | Function |
|---|---|
| A hand-written React page | import the component, pass props |
| Silex trait panel | `toSilexTraits(def)` |
| Published Silex HTML → props | `propsFromAttributes(def, getAttr)` |
| Any string-ish prop bag | `coerceProps(def, raw)` |
| A drag-and-drop editor | `toPuckFields(def)` + `toDefaultProps(def)` |

`toPuckFields` types Puck's field shape locally and imports nothing.
**`@measured/puck` is not a dependency and should not become one until
something actually uses it.** The adapter exists to show the catalogue can
drive an editor, and to make adopting one a short job rather than a
re-description of every block. It has not been verified against Puck's
published types — check them against the version you install.

## The split

Every block that needs a database read ships as a **pair**:

```
src/blocks/thread-feed.tsx          presentational. props in, markup out.
                                    no async, no db, nothing importing db.
src/server/thread-feed.server.tsx   fetching. reads rows, renders the above.
```

Exported from two entry points, so importing a block to *display* it never
pulls `@elkdonis/db` into the graph:

```ts
import { ThreadFeed } from "@elkdonis/blocks";          // presentational
import { ThreadFeedBlock } from "@elkdonis/blocks/server"; // fetches for itself
```

This pays for itself without any editor: the presentational half can be
rendered by a caller that already has the rows (a search result, a profile, a
digest preview) without a second query, and tested without a database. It also
happens to be exactly what an editor canvas needs, since an async server
component cannot render in one.

## Usage

```tsx
import "@elkdonis/blocks/blocks.css";
import { HeroBanner, SectionBanner } from "@elkdonis/blocks";
import { ThreadFeedBlock } from "@elkdonis/blocks/server";

<HeroBanner title="The Ambrosial Hours" subtitle="Rise with the sun" imageUrl={hero} />
<SectionBanner eyebrow="Daily practice" title="Amrit Vela" accent="#f4c430" />
<ThreadFeedBlock orgId="amrit_canada" feedSlug="sadhana" limit={6} upcomingOnly
                 timeZone="America/Toronto" />
```

Add `"@elkdonis/blocks"` to the app's `transpilePackages` — it is consumed as
source, like `cms-ui` and `forum-ui` — and, in a Tailwind app, add the matching
`@source` so Tailwind scans it.

### Per-org blocks

`sharedCatalogue` is what this package ships. An app can build its own:

```ts
createCatalogue([...SHARED_BLOCKS, ...myOrgBlocks]);
```

That is how a supported-tier site gets blocks written just for it without
forking the shared set. Availability is a host fact, the same posture
`hubCards(caps)` takes.

## Styling

Plain CSS with custom properties, never Tailwind utilities — `ifac` and
`artdirect` carry their own stylesheets and a utility class renders unstyled
there. Each block's look is driven by `--eac-block-*` tokens with a fallback
chain, the same pattern as `surface.css`:

```css
:root {
  --eac-block-bg:        hsl(var(--card));
  --eac-block-fg:        hsl(var(--foreground));
  --eac-block-accent:    hsl(var(--primary));
  --eac-block-on-accent: hsl(var(--primary-foreground));
}
```

Eight of nine apps checked already speak that shadcn vocabulary, so for most
apps that block is the whole integration. An app that sets nothing still
renders correctly — it just looks generic.

**Every accent needs its paired on-accent colour.** Text on a filled accent is
the recurring contrast bug in this repo — white on IFAC's gold is 2.58:1 — so
`--eac-block-on-accent` defaults to white only because most accents are dark.
An app with a light accent must set it.

`BlockDef.styling` records which of the two a block is. Everything here is
`tokens`; the field exists because the harvest will pull more components out of
Tailwind apps, and a library that silently renders unstyled on two apps is
worse than one that says which blocks are portable.

## Tests

```bash
pnpm --filter @elkdonis/blocks check-types
pnpm --filter @elkdonis/blocks test
```

`check-types` proves the declarations agree with the components. `test` proves
what types cannot: that `limit="3"` becomes `3`, that an unknown select option
falls back instead of rendering nothing, that undeclared props are dropped, and
that every block renders from its own `sample()`. 22 checks.

The tsconfig maps `@elkdonis/db` to the db package's **source**, not its
`dist` — a stale dist hides real errors.

## Current blocks

| id | styling | data-driven | harvested from |
|---|---|---|---|
| `hero-banner` | tokens | — | amrit-canada `hero-banner.tsx` (content was hardcoded) |
| `section-banner` | tokens | — | `feed-banner.tsx`, identical in 2 apps |
| `cycle-badge` | tokens | — | `cycle-badge.tsx`, identical in 2 apps |
| `thread-feed` | tokens | yes | the inline mapping in `[feed]/page.tsx` |

## Not yet done

- **No app consumes this yet.** Nothing has been deleted from
  amrit-canada or innergathering; the duplicates are still there. Porting one
  page is the next step and the real test.
- **`silexRoot` is declared but unused.** It is the seam for converting a
  published Silex page into stored block JSON — the thing that would make a
  free→supported upgrade a migration rather than a rebuild. Nothing walks it
  yet.
- **`node_modules/` here is hand-linked**, not installed: `pnpm install` fails
  on this checkout with `EACCES` on a root-owned `node_modules/.bin`, so
  `@types/react`, `@types/node`, `react` and `react-dom` are symlinks into the
  existing pnpm store. A real install (in the container) replaces them and is
  the correct fix.
- `ThreadCard` was deliberately left behind: it is coupled to the surface
  system (`useSurfaceOptional`) and belongs with `cms-ui`, not here.
