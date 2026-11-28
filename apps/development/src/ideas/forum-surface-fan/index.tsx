import { ForumSurfaceFan } from "./ForumSurfaceFan";
import type { Idea } from "../types";

// Metadata in a server file; the mock itself is a client component with sample data (./data.ts).

const idea: Idea = {
  slug: "forum-surface-fan",
  title: "Forum top bar and SurfaceFan",
  summary:
    "The Grand Forum without its left rail: a top bar of drop-down menus (Read, Categories, Happening, Wiki, Dictionary, account with the reading options), and a SurfaceFan on the right edge whose tabs fan out along rays toward a point past the edge, dim the page, and open their options to the left. Sample data; nothing here touches the forum.",
  status: "exploring",
  added: "2026-11-27",
  refs: ["packages/forum-ui/src/shell.tsx", "packages/forum-ui/src/parts.tsx", "packages/forum-ui/src/forum-theme.css", "packages/cms-ui/src/surface", "docs/reference/apps.md"],
  Component: () => <ForumSurfaceFan />,
};

export default idea;
