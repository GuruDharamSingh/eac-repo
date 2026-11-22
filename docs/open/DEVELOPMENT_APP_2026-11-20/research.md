# Research: similar projects (worker R, 2026-11-20)

Method: generic web searches (no project or owner names) plus fetches of the Puck docs. Vendor pages are self-reported; items marked UNVERIFIED were not confirmed on a primary page.

## 1. Component workbenches and galleries

1. **Storybook** is the reference: one "story" per variant of a component, a sidebar tree to browse, a Controls panel (auto-built from props) that edits a story live, and a global toolbar for theme/viewport. Its strength is the ecosystem (a11y, visual diff, Figma, many addons). https://storybook.js.org/docs/essentials/controls , comparison: https://www.pkgpulse.com/guides/storybook-8-vs-ladle-vs-histoire-2026
2. **Ladle** is a fast, React-only, Vite-based Storybook look-alike that reads the same story files; minimal features, quick startup. Lesson: a small tool that does browse + controls + theme is enough. https://blog.logrocket.com/ladle-storybook-performance-project-sizes
3. **Histoire** targets Vue/Svelte; React is secondary. https://dev.to/saswatapal/storybook-10-why-i-chose-it-over-ladle-and-histoire-for-component-documentation-2omn
4. **React Cosmos** uses "fixtures" (a component plus fixed props) in a tree with a props panel. No verified detail beyond that. https://stackshare.io/stackups/react-cosmos-vs-react-storybook
5. **Playroom** (usable as a Storybook addon) lets designers type JSX with snippets and see it live across themes and viewports at once: the "same thing in every theme" view. https://storybook.js.org/addons/storybook-addon-playroom
6. **Sandpack** gives live editable code examples in docs (react.dev uses it). Good for developer docs, wrong for a non-technical owner. https://codesandbox.io/blog/using-sandpack-for-react-libraries-documentation

## 2. Puck specifics

1. `<Render config data>` renders saved content outside the editor. Optional `metadata` reaches every block's `render` and `resolveData` as `puck.metadata`. A single block is just a `data` with one `content` entry. https://puckeditor.com/docs/api-reference/components/render
2. `fieldTransforms` apply only inside `<Puck>`, not in `<Render>` unless passed to it (Render accepts a `fieldTransforms` prop). A preview card must go through the same path as the real site, or blocks using transforms will look different. https://puckeditor.com/docs/api-reference/components/render
3. Composition API: inside `<Puck>` you can supply your own layout with `Puck.Preview`, `Puck.Components`, `Puck.Fields`, `Puck.Outline`, plus `Drawer`, `Drawer.Item`, `FieldLabel`. A "block inspector" is `<Puck>` with only Fields + Preview. https://puckeditor.com/docs/extending-puck/composition
4. Overrides (experimental API): `drawerItem`, `fieldTypes`, `header`, `headerActions`, and more in the API reference. `fieldTypes` restyles every field of a kind (e.g. all colour fields) in one place. https://puckeditor.com/docs/extending-puck/ui-overrides
5. `createUsePuck()` with a selector reads editor state (e.g. `appState.data`) from overrides or composed children; selectors arrived in 0.19 to limit re-renders. Needs the `<Puck>` context. https://dev.to/puckeditor/puck-019-slots-api-performance-gains-1eik
6. Package name is `@puckeditor/core` in current docs (older: `@measured/puck`); check the installed version before copying examples. I found no community block-library showcase worth citing.

Consequence: card in the canvas = `<Render>` with a one-block Data; clicking a card opens ONE shared `<Puck>` (Fields + Preview composition) for that block, not one editor per card.

## 3. Design-system docs and token tools

1. **Supernova** "Brands": tokens, components and docs separated per brand inside one system; maps Figma modes or Tokens Studio themes to brands. https://www.supernova.io/guides/scaling-your-product-development-with-supernova/2-understanding-multi-brand-setup-options/overview-of-multi-brand-design-system-approaches
2. **Tokens Studio** keeps tokens as JSON sets, combines sets into "themes", exports via Style Dictionary. https://www.supernova.io/supernova-tokens-studio
3. **W3C Design Tokens format** reached its first stable version (2025.10) on 28 Oct 2025, with Format, Color and Resolver modules; the Resolver covers multiple contexts (light/dark, brands). Using this JSON shape keeps us tool-compatible. https://www.w3.org/community/reports/design-tokens/CG-FINAL-format-20251028/ (alias syntax not confirmed by me)
4. **Radix Themes ThemePanel**: a floating panel with accent colour, gray, radius, scaling, light/dark that re-skins the page live. Brand colours: override step 9 of a 12-step scale. https://www.radix-ui.com/themes/playground
5. **tweakcn**: shadcn theme editor with sliders, colour pickers, live preview, exported CSS variables. https://github.com/jnsahaj/tweakcn
6. **Brad Frost** on multi-theme systems: core layer plus one folder per brand. https://bradfrost.com/blog/post/the-many-faces-of-themeable-design-systems/ . zeroheight and Open Props: nothing found (UNVERIFIED). Open Props is a plain CSS-variable set, useful as naming inspiration only.

Showing brands side by side: Supernova and Tokens Studio mostly show one theme at a time with a switcher. A side-by-side matrix (rows = semantic token, columns = brand) is recommended in practitioner write-ups (area 5), but I found no product screenshot of it. Chance to do it better.

## 4. Infinite canvas

1. **tldraw**: every shape is a React component; the editor skips rendering shapes outside the viewport (culling). Custom shapes via `shapeUtils`. https://tldraw.dev/sdk-features/shapes
2. tldraw is heavy for a gallery (selection, undo, tools we do not need) and has production licence terms (check before adopting; UNVERIFIED).
3. **Onlook** puts a project's real React components on an infinite canvas for visual editing. https://www.onlook.com/for/react
4. **Subframe** says its canvas uses real flexbox layout, so frames show true breakpoints. https://docs.subframe.com/learn/concepts
5. **Plasmic** lets you register your own React components as blocks, which matches Puck's config model. https://github.com/plasmicapp/plasmic . **Paper** is an HTML/CSS free-form canvas in alpha.
6. A library-free option: one wide div with CSS-transform pan/zoom, cards at grid positions, each mounted only when an IntersectionObserver says it is near the viewport, light placeholder otherwise. (My engineering suggestion, not a sourced finding.)

## 5. Multi-brand unification

1. Layers: primitives (raw values) -> semantic (named by purpose, not look) -> brand overrides only at the semantic level; sub-brands add one more layer. https://infinum.com/blog/multibrand-design-system-tokens/ , https://www.pathtoproject.com/blog/20240220-design-token-governance-for-multi-brand-platforms
2. Migrate in phases: build layers for the first brand, ship, check visual regressions, then add other brands as small override files. One case study reports codemods replacing 1,247 hardcoded values with 34 semantic tokens (self-reported). https://portfolio-f1q1epwju-ben-eunsoo-hos-projects.vercel.app/work/token-migration-dusk
3. Audit first with a tracker: Wix's guide includes an audit template and warns that component CSS reaching into internals bypasses tokens. https://dev.wix.com/docs/wix-design-system/contributing/token-migration-guidelines
4. Common failure modes: local overrides, semantic drift, duplicate tokens. https://www.pathtoproject.com/blog/20240220-design-token-governance-for-multi-brand-platforms
5. Preview themes should include a baseline brand, a heavily customised brand and edge cases; renaming a token or alias can silently break overrides. https://www.pathtoproject.com/blog/20260807-design-token-promotion-pipelines-for-multi-brand-platforms
6. Alias layer: keep old variable names as aliases to new semantic tokens so sites move over one at a time (Backbase migration docs describe this). https://designsystem.backbase.com/latest/design-tokens/migration-in-code/web-sfYVroB7

## What to borrow (what Justin would see and do)

- **A wide canvas of block cards.** Each card shows one block live, with a name tag and the app it comes from. Pan and zoom; cards not yet reached are grey placeholders that fill in as he approaches.
- **Click a card, edit it.** A side panel opens with that block's fields (same as the page editor) and the card updates as he types. Presets ("variants") appear as small tabs on the card, like Storybook stories.
- **One theme switch at the top** that re-skins every card, plus a "compare" mode showing the same card in each site's theme in a row.
- **A floating style panel** (Radix ThemePanel / tweakcn style): colour pickers, radius, type scale, light/dark; he drags, the whole canvas changes.
- **A token matrix page**: rows = meaning ("page background", "button", "heading font"), columns = each site. Colours as swatches, type as a sample word. Cells that differ from the shared default are highlighted; cells using a hardcoded colour instead of a token are flagged. That is the audit and the first step to unifying.
- **Old names kept as aliases** so a site can move to the shared set without breaking.
- Store tokens in the W3C JSON shape so outside tools can read them later.

## What to avoid

- Installing Storybook itself: it needs its own build and story files per block; Puck config already knows each block's fields.
- One full `<Puck>` editor per card (slow, state clashes). Use `<Render>` for cards and one shared inspector.
- tldraw as the canvas unless needed: licence and editing weight; a CSS-transform canvas is enough for browsing.
- Assuming `<Render>` matches the editor: field transforms and `usePuck` need extra wiring there; verify against the real site's render path.
- Showing raw token names to the owner. Show swatches, sample text and "used on N sites".
- Brand overrides on primitives, and renaming tokens without aliases.
- Copying Puck examples blindly: package name and the overrides API are in flux.
