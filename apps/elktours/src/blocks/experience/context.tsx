"use client";

import * as React from "react";
import type { ExperienceView } from "@/components/experiences/types";

/**
 * What every experience block reads: the experience (public fields only),
 * who may edit, and the other experiences for "More experiences". Supplied
 * once by the page (or, in the layout editor, by a sample) so a block's own
 * props hold only its settings — the shape a Puck document stores.
 */
export interface ExperiencePageData {
  experience: ExperienceView;
  canEdit: boolean;
  signedInEmail: string | null;
  others: ExperienceView[];
}

const Ctx = React.createContext<ExperiencePageData | null>(null);

export function ExperiencePageProvider({ data, children }: { data: ExperiencePageData; children: React.ReactNode }) {
  return <Ctx.Provider value={data}>{children}</Ctx.Provider>;
}

export function useExperiencePage(): ExperiencePageData | null {
  return React.useContext(Ctx);
}
