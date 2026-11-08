// design-sync entry: the EAC design system as one module (window.EAC).
//
// Scope (2026-11-07, Justin): the platform's current direction, not every package.
//   - @elkdonis/series-site components  - IFAC series/session building blocks (the dark .ifs look)
//   - @elkdonis/cms-ui/surface          - Surface UI: card -> popup -> detail page
//   - @elkdonis/blocks                  - Puck page blocks (secondary; new work follows their prop shapes)
// Left out on purpose: hub faces, compose, wizard, email, files, studio/forms (not settled yet),
// cms-ui/whiteboard (Excalidraw embed), the async server pages (SeriesPage etc. fetch from the DB).
import "./process-shim"; // must stay the first import

// Puck page blocks. blocks/src/index.ts does `export * from "./blocks"`, which esbuild resolves to
// blocks.css (extension before directory index; Next/webpack resolves the folder), so the folder is
// re-exported explicitly.
export * from "../../packages/blocks/src/index";
export * from "../../packages/blocks/src/blocks/index";

// Surface UI.
export * from "../../packages/cms-ui/src/surface/index";

// Series & sessions (presentational components; the pages themselves are async server components).
export * from "../../packages/series-site/src/components/series-top";
export * from "../../packages/series-site/src/components/series-carousel";
export * from "../../packages/series-site/src/components/series-sessions-view";
export * from "../../packages/series-site/src/components/session-rows";
export * from "../../packages/series-site/src/components/event-stage";
export * from "../../packages/series-site/src/components/cover-media";
export * from "../../packages/series-site/src/components/join-details";
export * from "../../packages/series-site/src/components/join-frame";
export * from "../../packages/series-site/src/components/series-rsvp";
export * from "../../packages/series-site/src/components/series-signin";
export * from "../../packages/series-site/src/components/week-comments";
export * from "../../packages/series-site/src/components/icons";

// Preview-only frame (not a platform component): paints the .ifs dark root behind each card.
export { PreviewFrame } from "./preview-frame";
