"use client";

import { useEffect, useState } from "react";
import "./workspace.css";
import { useWorkspace } from "./store";
import type { Mode } from "./types";
import { DraftBar } from "./DraftBar";
import { ServerDraftBar } from "./readonly/ServerDraftBar";
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
import { ReadOnlyHome, ReadOnlyPeople, ReadOnlySteps } from "./readonly/ReadOnlySheet";

const MODES: { id: Mode; label: string }[] = [
  { id: "edit", label: "Editing" },
  { id: "participant", label: "As a participant" },
  { id: "guide", label: "As the guide" },
];

const SHEET_LABEL = { home: "Workspace", steps: "Steps", journal: "Journal", profile: "Profile", people: "People" } as const;

export function Shell() {
  const w = useWorkspace();
  const [creating, setCreating] = useState(false);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1100px)");
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  if (!w.course && w.readOnly) {
    return (
      <div className="ws-root ws-start">
        <div className="ws-start-card">
          <h1>Nothing to show yet</h1>
          <p>This workspace has no published outline.</p>
        </div>
      </div>
    );
  }
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

  // The sheet stays open beside the theater so steps can be finished next to the video, unless the screen is narrow.
  const strip = w.theater && w.sheet !== null && narrow;
  const open = w.sheet !== null && !strip;
  return (
    <div className="ws-root">
      <div className="ws-chrome">
        {w.server ? (
          <>
            {w.server.canEdit ? (
              <div className="ws-modes" role="group" aria-label="View as">
                <button type="button" className="ws-mode" aria-pressed={w.mode === "edit"} onClick={() => w.setMode("edit")}>Editing</button>
                <button type="button" className="ws-mode" aria-pressed={w.mode !== "edit"} onClick={() => w.setMode("guide")}>As a participant sees it</button>
              </div>
            ) : null}
            <span className="ws-viewer">{w.mode === "edit" ? "Editing as" : "Viewing as"} {w.viewer.name}{w.canDo || w.mode === "edit" ? "" : " · read only"}</span>
          </>
        ) : w.readOnly ? (
          <span className="ws-viewer">Viewing as {w.viewer.name}{w.canDo ? "" : " · read only"}</span>
        ) : (
          <>
            <div className="ws-modes" role="group" aria-label="View as">
              {MODES.map((m) => (
                <button key={m.id} type="button" className="ws-mode" aria-pressed={w.mode === m.id} onClick={() => w.setMode(m.id)}>{m.label}</button>
              ))}
            </div>
            <span className="ws-viewer">Viewing as {w.viewer.name}</span>
            <button type="button" className="ws-btn ws-btn-quiet" onClick={() => { if (window.confirm("Reset the workspace and clear everything in this browser?")) w.reset(); }}>Reset sample</button>
          </>
        )}
        <button type="button" role="switch" aria-checked={w.sheet !== null} aria-label="The sheet" className="ws-sheet-switch" onClick={() => { w.setSheet(w.sheet === null ? "home" : null); }}>
          <span className="ws-sheet-switch-l">Sheet</span>
          <span className="ws-sheet-switch-s">{w.sheet !== null ? "open" : "closed"}</span>
        </button>
      </div>
      {w.mode === "edit" && !w.readOnly ? (w.server ? <ServerDraftBar /> : <DraftBar />) : null}
      <div className={`ws-body${open ? " ws-has-sheet" : ""}${strip ? " ws-has-strip" : ""}`}>
        <ModuleList />
        {w.selected === "settings" ? (w.readOnly ? <fieldset disabled style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}><SettingsPane /></fieldset> : <SettingsPane />) : <ModulePane />}
        {open && w.sheet ? (
          <aside className="ws-sheetwrap" aria-label={SHEET_LABEL[w.sheet]}>
            {w.readOnly || w.server ? (
              <>
                {w.sheet === "home" ? <ReadOnlyHome /> : null}
                {w.sheet === "steps" ? <ReadOnlySteps /> : null}
                {w.sheet === "people" ? <ReadOnlyPeople /> : null}
              </>
            ) : (
              <>
                {w.sheet === "home" ? <SheetHome /> : null}
                {w.sheet === "steps" ? <StepsSheet /> : null}
                {w.sheet === "journal" ? <JournalSheet /> : null}
                {w.sheet === "profile" ? <ProfilePanel /> : null}
                {w.sheet === "people" ? <PeoplePanel /> : null}
              </>
            )}
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
