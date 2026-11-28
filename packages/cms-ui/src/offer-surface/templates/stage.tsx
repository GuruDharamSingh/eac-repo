"use client";

import { TemplateShell } from "./shell";
import { WritingStage } from "../layers-read";
import type { TemplateProps } from "./types";

// Sandbox view of the docked writing stage (packet frames 3b desktop, 4c phone).
// Not a catalogue template: it only shows WritingStage inside the page shell so it
// can be compared with the frames. "essay" is the shell's closest template id.
export function StageView({ data }: TemplateProps) {
  return (
    <TemplateShell data={data} template="essay">
      <WritingStage startKey={data.pieces[0]?.key} />
    </TemplateShell>
  );
}
