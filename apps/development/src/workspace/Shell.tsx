"use client";

import { useState } from "react";
import "./workspace.css";
import { useWorkspace } from "./store";
import type { Mode } from "./types";
import { DraftBar } from "./DraftBar";
import { ModuleList } from "./ModuleList";
import { ModulePane } from "./ModulePane";
import { SettingsPane } from "./SettingsPane";
import { NewWorkshopSheet } from "./NewWorkshopSheet";
import { SheetHome } from "./sheet/SheetHome";
import { StepsSheet } from "./sheet/StepsSheet";
import { ProfilePanel } from "./sheet/ProfilePanel";
import { PeoplePanel } from "./sheet/PeoplePanel";
import { StepFrame } from "./sheet/StepFrame";
import { JournalSheet } from "./journal/JournalSheet";
import { JournalFrame } from "./journal/JournalFrame";

const MODES: { id: Mode; label: string }[] = [
  { id: "edit", label: "Editing" },
  { id: "participant", label: "As a participant" },
  { id: "guide", label: "As the guide" },
];

const SHEET_LABEL = { home: "Workspace", steps: "Steps", journal: "Journal", profile: "Profile", people: "People" } as const;

export function Shell() {
  const w = useWorkspace();
  const [creating, setCreating] = useState(false);

  if (!w.course) {
    return (
      <div className="ws-root ws-start">
        <div className="ws-start-card">
          <h1>Workshop workspace</h1>
          <p>A click-through prototype. Nothing here is saved to a site: it stays in this browser.</p>
          <div className="ws-row">
            <button type="button" className="ws-btn ws-btn-primary" onClick={() => setCreating(true)}>New workshop</button>
            <button type="button" className="ws-btn" onClick={() => w.useSample()}>Use the sample</button>
          </div>
        </div>
        {creating ? <NewWorkshopSheet onClose={() => setCreating(false)} /> : null}
      </div>
    );
  }

  const strip = w.theater && w.sheet !== null;
  const open = w.sheet !== null && !strip;
  return (
    <div className="ws-root">
      <div className="ws-chrome">
        <div className="ws-modes" role="group" aria-label="View as">
          {MODES.map((m) => (
            <button key={m.id} type="button" className="ws-mode" aria-pressed={w.mode === m.id} onClick={() => w.setMode(m.id)}>{m.label}</button>
          ))}
        </div>
        <span className="ws-viewer">Viewing as {w.viewer.name}</span>
        <button type="button" className="ws-btn ws-btn-quiet" onClick={() => { if (window.confirm("Reset the workspace and clear everything in this browser?")) w.reset(); }}>Reset sample</button>
      </div>
      {w.mode === "edit" ? <DraftBar /> : null}
      <div className={`ws-body${open ? " ws-has-sheet" : ""}${strip ? " ws-has-strip" : ""}`}>
        <ModuleList />
        {w.selected === "settings" ? <SettingsPane /> : <ModulePane />}
        {open && w.sheet ? (
          <aside className="ws-sheetwrap" aria-label={SHEET_LABEL[w.sheet]}>
            {w.sheet === "home" ? <SheetHome /> : null}
            {w.sheet === "steps" ? <StepsSheet /> : null}
            {w.sheet === "journal" ? <JournalSheet /> : null}
            {w.sheet === "profile" ? <ProfilePanel /> : null}
            {w.sheet === "people" ? <PeoplePanel /> : null}
          </aside>
        ) : null}
        {strip ? (
          <button type="button" className="ws-strip" onClick={() => w.setTheater(false)} aria-label="Sheet, tap to leave the theater and open">
            <span>Sheet</span>
          </button>
        ) : null}
        {w.sheet === null ? (
          <button type="button" className="ws-sheet-tab" onClick={() => w.setSheet("home")}>
            <span>Open the sheet</span>
          </button>
        ) : null}
      </div>
      {w.frame === "journal" ? <JournalFrame /> : null}
      {w.frame === "step" ? <StepFrame /> : null}
    </div>
  );
}
