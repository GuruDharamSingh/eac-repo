# @elkdonis/page-builder

The visual page editor: one Puck adapter over `@elkdonis/blocks`, plus the
editor shell, the field controls, and the page store.

A site that wants editing supplies three things and nothing else — its org id,
where its pictures live, and a server action that may write:

```ts
// lib/puck/config.client.ts   "use client"
export const puckConfig = buildEditorConfig({
  media: { uploadEndpoint: "/api/media/upload", libraries: [...] },
  resolvers,            // only for data-driven blocks
});

// lib/puck/store.ts — binds the shared store to this site
export const loadPage = (slug, known) => loadPageFor(siteConfig.orgId, slug, known);
```

Two routes finish it: `/studio/[slug]` (gated, renders `<PuckEditor>`) and
`/p/[slug]` (public, `<Render>` from `@measured/puck/rsc` after
`resolveAllData`). See `apps/danamccool` for the smallest complete example and
`apps/innergathering` for one with a data-driven feed.

## Things that will bite you

- **Import `@elkdonis/blocks/blocks.css` in the ROOT layout, not the route.**
  Puck's canvas is an iframe and mirrors the parent document's stylesheets at
  mount; Next scopes a route's CSS import to that route. A sheet imported only
  by `/p/[slug]` is absent in `/studio`, blocks draw unstyled, and Puck picks
  its drag axis from the wrong computed layout.
- **`@measured/puck/rsc` explicitly** on the published route. The bare
  specifier only resolves to the server renderer because Next honours the
  package's `react-server` condition.
- **A block `id` is a persisted identifier.** Renaming one orphans every stored
  page that used it, silently — `<Render>` returns null for an unknown type.
- **Puck has no component resize**, in any form. Size is a declared prop. A
  `kind: "number"` prop that declares `min` and `max` becomes a slider here.

## What is deliberately NOT here

The block components. Nothing in `@elkdonis/blocks` imports an editor, which is
what makes the blocks usable from a hand-written page, from Silex, and from
whatever replaces Puck. This package is the only layer allowed to hold both.
