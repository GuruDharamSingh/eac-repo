"use client";

import * as React from "react";
import type { EntryVisibility } from "./types";

/** Who may read the entry being written, when the form around it offers the choice (ongoing entries). Null: use the default. */
export const AudienceCtx = React.createContext<{ vis: EntryVisibility } | null>(null);

/** The small mark beside a guide's name or entry. */
export function GuideMark() {
  return <span className="ws-guide-mark">guide</span>;
}
