# Pens — the Silex "CodePen" library

A **pen** is one self-contained piece of front-end craft (an animation, a
reveal, a hover effect) packaged so it can be dropped into any Silex site as
a block, and optionally mirrored as a React component for the custom apps.

Two systems of website share the network: Silex-built (org owners edit them
in the browser) and React-built (apps like IFAC). Some are hybrids. A pen
lives here, in the Silex side, because that is the side with no build step —
and the React twin imports **the same CSS file**, so the look cannot drift.

## Constraints every pen must respect

- **No JavaScript.** Published Silex HTML goes through DOMPurify
  (`packages/utils/src/sanitize-silex.ts`): `<script>` and `on*` handlers are
  removed. State must come from CSS — a checkbox, `:has()`, `<details>`,
  `:target`, hover — and the React twin adds the script-only parts (FLIP
  measurement, focus management).
- **Allowlisted markup only.** Custom elements must be `eac-*`; `data-*`
  attributes are fine; `class`, `style`, `id`, form-control attributes
  (`type`, `checked`, `for`, `name`) are kept.
- **Tokens, not colours.** Read `--eac-*` custom properties with fallbacks,
  so the pen takes the org palette in Silex and the person's palette on a
  profile page. Check contrast on every pair you introduce.
- **`prefers-reduced-motion`.** Every pen ends with a block that turns its
  motion off and leaves the content usable.
- **Class prefix `eac-pen-<id>`.** That is also how the editor knows a pen is
  in use on a page and seeds its CSS into the project stylesheet.

## Layout of a pen

```
pens/<id>/
  manifest.json   id, label, description, credit, root selector, traits
  pen.html        the block's markup (placeholders, real structure)
  pen.css         the whole look, tokenised
```

`pensRegistry.js` reads every folder with a `manifest.json`; the connector
serves the result at `/eac-pens.json` and the concatenated CSS at
`/eac-pens.css`. `client-config.js` turns each entry into a block in the
**EAC Pens** category, registers a component type whose traits come from the
manifest, and seeds that pen's CSS into the project the first time one is
dropped (so the published page carries it, and nothing is persisted for pens
the page does not use).

## React twins

`packages/cms-ui/src/pens/` — one component per pen that needs script. Its
stylesheet is a one-line `@import` of the pen's `pen.css` here, so there is
one source of truth. Apps import `@elkdonis/cms-ui/<id>.css` once.

## Credit

Each manifest names the original author and pen. Keep it: the library exists
because other people published their work openly.

| pen | source | React twin |
|---|---|---|
| `fold-card` | shshaw / keyframers, [QmZYMG](https://codepen.io/shshaw/pen/QmZYMG) | `FoldCard` (`@elkdonis/cms-ui/pens`) |
| `feed-list` | Cassie Evans, staggered-list expand with GSAP Flip | `FeedList` / `FeedItem` (`@elkdonis/cms-ui/pens`) |
| `moon-phase` | Mads Stoumann, [Phases of the Moon in CSS](https://dev.to/madsstoumann/phases-of-the-moon-in-css-2lbo) | `MoonPhase` (`@elkdonis/cms-ui/pens`) |

`feed-list` also has a third consumer: the live `org-feed` and
`community-feed` slots render it server-side (`data-layout="expand"`) so a
page can mix a hand-built feed with a real one and have them match. That path
uses the checkbox markup, not the React twin — a published org site should
not need JavaScript to open a row.

`moon-phase` is the one pen whose React twin exists for the DATA rather than
the motion: the block draws whatever phase its author dials in, while the twin
is handed `moonPhase(chart)` from `@elkdonis/astro` and so shows the real moon,
tilted the way the sky tilts it at that place and hour. The original reads its
numbers with the typed `attr()`, which only Chrome ships; both of ours take
custom properties instead, which every current browser understands.
