import lmsPrimer from "./lms-primer";
import workshopWorkspace from "./workshop-workspace";
import manjushri from "./manjushri";
import fieldsLens from "./fields-lens";
import designSystemProposal from "./design-system-proposal";
import versionsAndBranches from "./versions-and-branches";
import themeEditor from "./theme-editor";
import freePlacement from "./free-placement";
import patternBlocks from "./pattern-blocks";
import pickersInPuck from "./pickers-in-puck";
import type { Idea } from "./types";

// The registry: one file per idea, listed here. Newest first.
export const IDEAS: Idea[] = [lmsPrimer, workshopWorkspace, pickersInPuck, patternBlocks, freePlacement, themeEditor, versionsAndBranches, manjushri, designSystemProposal, fieldsLens];

export const ideaBySlug = (slug: string) => IDEAS.find((i) => i.slug === slug);
