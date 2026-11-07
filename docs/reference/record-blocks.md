# Record blocks: `@elkdonis/blocks/record`

How to build a "smart" record block: ONE record (a piece, a tour, an event),
placed anywhere on a Puck page, that lays itself out by where it sits and how
wide it is, stays inert while being edited, and never stores the fetched
record in the page. Extracted on 2026-11-06 from katie-the-potter's
`ktp-piece` (`apps/katie-the-potter/src/blocks/piece-block.tsx`), which is the
reference implementation; see also `apps/katie-the-potter/docs/editor.md`.

Source: `packages/blocks/src/record/` (pure, client-safe: no Next, no DB) and
`record.css`. Not part of `SHARED_BLOCKS`: it is a kit for an app's own blocks.
Tests: `packages/blocks/scripts/record.mts` (`pnpm --filter @elkdonis/blocks test`).

```ts
import {
  placementRules, BASE_RULES, layoutChoice, effectiveLayout, describeLayout, layoutProp, editingOf,
  RecordFrame, RecordEmpty, stripResolvedKeys, defineLooks,
  type RecordLayout, type RecordLayoutChoice, type RecordWhere, type ResolvedPlacement, type PlacementLike, type PuckEditing,
} from "@elkdonis/blocks/record";
```

```css
/* globals.css, at the app ROOT (Puck's iframe mirrors the parent's styles), after blocks.css */
@import "@elkdonis/blocks/record.css" layer(components);
```

## The three mechanisms

| Mechanism | Input | Where it runs | API |
|---|---|---|---|
| Proximity | the parent block and slot | the resolver (editor and server alike) | `placementRules`, `effectiveLayout` |
| Width | the block's own inline size | the browser, CSS container queries | `RecordFrame` (`.blk-rec-frame` is a container) + the app's `@container` rules |
| Editing | Puck's `puck` prop | the component | `editingOf`, `RecordEmpty`, `describeLayout` |

### 1. Placement rules (proximity)

page-builder hands every resolver `metadata.placement = { parentType, slot, index, siblingTypes }`
from Puck's resolveData `parent` (top level = `parentType: null`). Map it once per app:

```ts
// the app's parents are ADDED to BASE_RULES
export const layoutFromPlacement = placementRules({
  feature: ["ktp-quick-landing"],   // BASE_RULES has none: no shared block has a feature slot
  compact: [],                      // + split-row, flow-column
  card: ["ktp-piece-row"],          // + grid, card-grid
  rowLabel: "in a row of pieces",   // the reason shown for a card parent
});
// in a resolver, no cast: anything that is not a placement counts as the page itself
placement: layoutFromPlacement(metadata.placement)
```

An entry is a block id, or a block id and ONE of its slots as `"type:slot"`.
A slot entry is checked before the plain id, so one slot of a parent can read
differently from the rest:

```ts
placementRules({ card: ["split-row:wall"] });
// in split-row's "wall" slot -> card (row); in its other slots -> compact (BASE_RULES)
```

It returns a `ResolvedPlacement`: `{ layout, reason, where, top? }`.

| Sits | layout | where (`data-in`) | top (`data-top`) | reason |
|---|---|---|---|---|
| on the page itself (also `"root"`, null, junk) | card | page | true | "on the page itself" |
| a feature parent | feature | hero | | "in a hero's slot" |
| a compact parent | compact | column | | "in a column" |
| a card parent | card | row | | `rowLabel` (default "in a row") |
| anything else | card | other | | "inside {parentType}" |

`layoutChoice(v)` reads a stored layout choice: `card`, `compact`, `row` or
`feature`, and `"auto"` for anything else (missing, empty, unknown).
`effectiveLayout(choice, placement)` and `describeLayout(choice, layout, placement)`
both go through it, and so does `RecordFrame`'s `data-choice`, so the drawn
layout, the editor line and the CSS hook always agree. Puck re-runs a resolver
when the block is MOVED to another parent, because the resolver reads
`placement`.

### 2. The width frame

```tsx
<RecordFrame name="ktp-piece" layout={layout} choice={p.layout} placement={p.placement} why={...}>
  ...the record...
</RecordFrame>
```

draws

```html
<div class="blk-rec ktp-piece" data-layout="card" data-choice="auto" data-in="row">
  <div class="blk-rec-frame ktp-piece-frame"> ...the record...
    <p class="blk-rec-why ktp-piece-why" aria-hidden="true">Auto: card, in a row of pieces</p>
  </div>
</div>
```

The shared classes are ADDED to the app's (`name`), so the app's CSS, its part
selectors (`> .ktp-piece`) and its container name keep working. Pass the raw
`layout` prop as `choice`: it is normalised. `record.css` supplies only the
generic half: `.blk-rec { box-sizing: border-box }`,
`.blk-rec-frame { container-type: inline-size }`, the page measure on
`[data-top]`, the page gutter in a column (`[data-in="column"]`),
`.blk-rec-empty` and `.blk-rec-why`. Breakpoints are the app's; name the
container if the queries need a name:

```css
.ktp-piece-frame { container: ktp-piece / inline-size; }
@container ktp-piece (min-width: 34rem) {
  .ktp-piece[data-choice="auto"][data-layout="card"] .ktp-card { /* picture beside words */ }
}
@container ktp-piece (max-width: 34rem) { /* feature and row stack */ }
```

**A record block needs a parent that gives it a definite inline size** (a
grid track, a flex item with a basis or `flex: 1`, an ordinary block box).
The frame is an `inline-size` container, so its width cannot come from its
content: in a shrink-to-fit parent (an inline-flex row with no basis, a
`width: max-content` box, a float) it collapses toward zero.

Because `record.css` is layered (`components`), any unlayered app rule wins,
whatever its specificity. `--blk-rec-radius` sets the placeholder's corners
(katie sets the corner with its own `.ktp-piece-empty` rule instead).

### 3. Parts and tokens

Declare parts against the app's classes, never the `blk-rec-*` ones, and keep
part names different from prop names (katie: `name` for the title, `eyebrow`
for `kicker`, `photo` for `image`). The root part is `> .{name}`. Tokens are
the app's (`--ktp-card-bg`...), each falling back to the site style
(`--blk-*`). Never rename a block id, prop or part: saved page JSON holds them.

`layoutProp()` declares the `layout` select. Its value types as `string` in
`PropsOf` (every select does; typing it as the union would need a change to
`PropsOf` in `registry.ts`), so always read it through `layoutChoice` /
`effectiveLayout`.

### 4. Looks

```ts
export const { LOOKS, lookOf, lookProp, SITE_LOOK_VAR } = defineLooks(
  [{ value: "house", label: "House" }, { value: "ember", label: "Ember (kiln glow)" }],
  { siteVar: "--ktp-look", inheritLabel: "As around it (row, then the site)" },
);
```

`lookProp(description)` is the `look` select (`""` = as around it);
`lookOf(v)` validates a stored value (or null). An entry with an empty value,
or a repeat of a value, is skipped (`""` is "as around it", never a look).
Nearest wins, all in CSS: the block's `data-look`, then a row's `data-look`,
then `data-site-look` that the root layout writes on `<body>` (and the editor
canvas root) from the Site style variable `siteVar`. The CSS for each look is
the app's (`looks.css` in katie).

### 5. Inert on edit

```ts
const { editing, drawn } = editingOf(p.puck);
```

- `editing`: Puck's canvas (`puck.isEditing`). Draw the "why" line:
  `why={editing ? describeLayout(p.layout, layout, p.placement) : null}`.
- `drawn`: any editing surface, direct-edit's "Edit look" popup
  (`puck.boxEditing`) included. Draw the record but let nothing act (no popup,
  an `inert` copy of a buy button), and for an empty binding draw
  `<RecordEmpty>` (a `<div>`, so its body may hold block content) instead of
  nothing. The block must be a SERVER component (not `interactive`) to
  receive `puck`; ship scripts as small islands.

### 6. Resolver keys

A resolver fills props the author never typed. They must not become page
content, and a key must never equal a prop name (the author's value would be
dropped on save): `placement` is resolved, `layout` is the author's choice.

```ts
export const RESOLVED_KEYS = { "ktp-piece": ["item", "placement", "sampled", "hrefBase"] };
// in the save action:
await savePage(slug, stripResolvedKeys(data, RESOLVED_KEYS));
```

`stripResolvedKeys` returns a copy (the input is not changed) and walks the
whole document: slots at any depth, zones, `content`. Only the table's own
keys are used (a block type named `toString` finds nothing). A stored key
named `__proto__` stays an own data property (built with `Object.fromEntries`;
fixed 2026-11-06 by the editor-house session, test
`packages/direct-edit/harness/featured/strip.mts`).

## Example skeleton

Type-checked verbatim against katie-the-potter's tsconfig on 2026-11-06.

```tsx
// src/blocks/tour-card.tsx (a server component: no "use client")
import { defineBlock, type PropsOf } from "@elkdonis/blocks";
import {
  describeLayout, editingOf, effectiveLayout, layoutProp, placementRules, RecordEmpty, RecordFrame,
  type PuckEditing, type ResolvedPlacement,
} from "@elkdonis/blocks/record";

interface Tour { id: string; title: string }

// This app's parents, added to BASE_RULES; "tour-split:aside" is one slot of a parent.
export const tourPlacement = placementRules({
  card: ["tour-row"],
  compact: ["tour-split:aside"],
  rowLabel: "in a row of tours",
});

const props = [
  { name: "tour", kind: "string", label: "Tour", binds: "tour", default: "" },
  layoutProp(),
  { name: "title", kind: "string", label: "Title (override)", default: "" },
] as const;

type Props = PropsOf<typeof props> & { item?: Tour | null; placement?: ResolvedPlacement | null; puck?: PuckEditing };

function TourCard(p: Props) {
  const { editing, drawn } = editingOf(p.puck);
  const layout = effectiveLayout(p.layout, p.placement);
  if (!p.item) {
    if (!drawn) return null;
    return (
      <RecordFrame name="et-tour" layout={layout} placement={p.placement} empty>
        <RecordEmpty title="Choose a tour" body="Pick one in the panel on the right." />
      </RecordFrame>
    );
  }
  return (
    <RecordFrame name="et-tour" layout={layout} choice={p.layout} placement={p.placement}
                 why={editing ? describeLayout(p.layout, layout, p.placement) : null}>
      <article className="et-tour-card">{p.title || p.item.title}</article>
    </RecordFrame>
  );
}

export const tourCard = defineBlock(
  {
    id: "et-tour",
    label: "Tour",
    category: "listings",
    description: "One tour as a smart card that lays itself out by where it sits.",
    memberSafe: true,
    dataDriven: true,
    styling: "tokens",
    props,
    parts: { root: { label: "Tour", sel: "> .et-tour" }, card: { label: "Card", sel: ".et-tour-card" } },
  },
  TourCard,
);

// resolver (server and client configs alike; metadata.placement needs no cast):
//   "et-tour": async (props, metadata) => ({ item: await loadTour(props.tour), placement: tourPlacement(metadata.placement) })
// save action: stripResolvedKeys(data, { "et-tour": ["item", "placement"] })
```

## Users

- katie-the-potter: `ktp-piece` (`src/blocks/piece-block.tsx`, `piece-layout.ts`,
  `looks.ts`, `resolved-keys.ts`, `lib/puck/actions.ts`).
- elktours: its page save actions (`apps/elktours/src/lib/puck/actions.ts`, table in `lib/puck/resolved.ts`), since 2026-11-06 (source).
- sunjay: `stripResolved` in `apps/sunjay/src/blocks/resolved-keys.ts` calls it with sunjay's table, since 2026-11-07 (live since the 00:55 EST rebuild).

## Known limits / next

- Root props are not stripped: `stripResolvedKeys` only looks at nodes with a
  `type`, so a resolver that fills `root.props` needs its own handling (or a
  `"root"` entry in the table, not implemented).
- Two sources of truth for resolver keys: each app's static `RESOLVED_KEYS`
  table and page-builder's runtime `resolverKeysFor`. Unifying them (derive the
  table from the resolvers, or let the save action ask page-builder) is open.
- Other walker copies not migrated: arts-collective and art-auction keep their own
  stripping walkers. Each can move to `stripResolvedKeys` with its own table.
- `layoutProp`'s value is `string` in `PropsOf` (see Parts and tokens).
- No shared block has a feature slot; `BASE_RULES.feature` is empty until one does.
