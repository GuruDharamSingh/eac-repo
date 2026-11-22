import { FieldsLensDemo } from "./FieldsLensDemo";
import type { Idea } from "./types";

// Metadata lives here, not in the "use client" file: a server page reads these fields, and a
// client module exports references, not values.
const idea: Idea = {
  slug: "fields-lens",
  title: "The Fields lens: link and describe",
  summary: "Edit one value at a time on the page itself. Every field declares its kind, says in words what it is, and links are checked before they save.",
  status: "building",
  added: "2026-11-20",
  refs: ["docs/open/HOUSE_EDITOR_ONE_2026-11-20/PLAN.md (H3)", "packages/house-editor/src/fields"],
  Component: FieldsLensDemo,
};

export default idea;
