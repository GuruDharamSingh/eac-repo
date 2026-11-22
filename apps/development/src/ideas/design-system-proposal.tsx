import { AppCards, Proposal } from "@/components/DesignSystemsView";
import type { Idea, IdeaContext } from "./types";

function DesignSystemProposal({ designSystem, themes }: IdeaContext) {
  return (
    <>
      <p className="dev-lede">
        One proposal that joins the cms-ui surface system (popups and faces driven by custom properties) with the flexible use of space in the elktours create-tour wizard. It is drawn from design-system.json,
        and the apps below are what each declares today, so the gap is visible.
      </p>
      <Proposal ds={designSystem} />
      <h2>What the apps declare today</h2>
      <AppCards themes={themes} />
    </>
  );
}

const idea: Idea = {
  slug: "design-system-proposal",
  title: "One design system for the network",
  summary: "The proposed vocabulary and alias map, beside what every app declares today.",
  status: "proposal",
  added: "2026-11-20",
  refs: ["packages/cms-ui/src/surface", "docs/open/ELKTOURS_SURFACE_HANDOFF_2026-11-20.md", "apps/elktours/src/components/office/create-tour"],
  Component: DesignSystemProposal,
};

export default idea;
