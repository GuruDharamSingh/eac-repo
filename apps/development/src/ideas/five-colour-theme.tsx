import { FiveColourTheme } from "./five-colour-theme/FiveColourTheme";
import type { Idea } from "./types";

// Metadata lives here, in a server file; the page itself is a client component (it keeps its state in the browser).
// Source: docs/open/THEME_SYSTEM_2026-11-22/ (STRUCTURE.md is the proposal, INVENTORY.md the counts, REVIEW.md the findings).

const idea: Idea = {
  slug: "five-colour-theme",
  title: "A theme from five colours",
  summary:
    "A proposed way to theme two sites from five colours: nine shades of each, eleven named roles, four section tones. Change a colour and see everything follow. Manjushri's notes are pinned to the parts they ask about. Nothing here changes a site.",
  status: "proposal",
  added: "2026-11-22",
  refs: [
    "docs/open/THEME_SYSTEM_2026-11-22/STRUCTURE.md",
    "docs/open/THEME_SYSTEM_2026-11-22/INVENTORY.md",
    "docs/open/THEME_SYSTEM_2026-11-22/REVIEW.md",
    "packages/gradients/src/ramps.ts",
  ],
  Component: () => <FiveColourTheme />,
};

export default idea;
