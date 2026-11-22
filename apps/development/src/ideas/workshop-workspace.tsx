import Link from "next/link";
import type { Idea } from "./types";

// A pointer to the click-through prototype. The prototype keeps its state in the browser only.
const idea: Idea = {
  slug: "workshop-workspace",
  title: "Workshop workspace: click-through",
  summary: "The workshop wireframes as a page you can click: new workshop, modules with their own colour, steps sheet, theater, Journal and the guide's frame. Browser-only state.",
  status: "building",
  added: "2026-11-22",
  refs: ["docs/open/DEVELOPMENT_APP_2026-11-20/WORKSPACE_CONTRACT.md"],
  Component: () => (
    <p>
      <Link href="/workspace">Open the workspace prototype</Link>. Nothing is saved to a site or the database; it lives in this browser until you press Reset sample.
    </p>
  ),
};
export default idea;
