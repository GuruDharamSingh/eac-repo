import { DesignHandoffs } from "./design-handoffs/DesignHandoffs";
import type { Idea } from "./types";

// The design handoff bundles, kept in apps/development/designs/ and served behind the admin gate
// by src/app/designs/[...path]/route.ts, so their .dc.html prototypes play live in a frame.
// Data: ./design-handoffs/manifest.ts. Folder notes: apps/development/designs/README.md.

const idea: Idea = {
  slug: "design-handoffs",
  title: "Design handoffs, playing live",
  summary:
    "The handoff bundles (publication offer surfaces 2026-11-27, elktours on Surface UI 2026-11-20) running in a frame at phone, tablet or desktop width, each with what it is for, which apps it applies to, the matching code and what is built. The claude.ai canvases are linked below.",
  status: "exploring",
  added: "2026-11-27",
  refs: [
    "apps/development/designs/README.md",
    "apps/development/src/ideas/design-handoffs/manifest.ts",
    "docs/open/DESIGN_SYSTEM_SURVEY_2026-11-26/survey.html",
    "docs/open/ELKTOURS_SURFACE_HANDOFF_2026-11-20.md",
    "packages/cms-ui/src/surface",
  ],
  Component: () => <DesignHandoffs />,
};

export default idea;
