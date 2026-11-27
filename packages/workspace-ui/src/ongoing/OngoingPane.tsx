"use client";

import { useState } from "react";
import { intervalOpen, intervalsAround, useWorkspace } from "../store";
import { moduleVars } from "../colour";
import { Frame } from "../Frame";
import type { Module } from "../types";
import { IntervalStrip } from "./IntervalStrip";
import { IntervalEntry } from "./IntervalEntry";
import { IntervalFeed } from "./IntervalFeed";
import { PersonEntries } from "./PersonEntries";
import { dayLabel, fmtKey, nextKey } from "./util";
import "./ongoing.css";

/** The ongoing session: it takes over the module window as the shared-space view. */
export function OngoingPane({ m: mProp }: { m?: Module }) {
  const w = useWorkspace();
  const { course, mode, viewer, entries, now } = w;
  const [personId, setPersonId] = useState<string | null>(null);
  const m = mProp ?? course?.modules.find((x) => x.id === w.selected);
  if (!course || !m || !m.ongoing) return null;
  const ongoing = m.ongoing;
  const edit = mode === "edit";
  const participant = mode === "participant";
  // Someone who does steps here writes: a seated participant, and a guide named on the run. A guide still reads every entry (the server decides what).
  const writer = participant || w.canDo;
  const items = intervalsAround(ongoing, now);
  const current = items.find((i) => i.state === "current") ?? items[Math.floor(items.length / 2)];
  const key = w.interval ?? current.key;
  const here = items.find((i) => i.key === key);
  const state = here?.state ?? (key < current.key ? "past" : key > current.key ? "future" : "current");
  const step = m.steps.find((s) => s.id === ongoing.stepId);
  const unit = ongoing.every === "week" ? "week" : "day";
  const open = state !== "future" && intervalOpen(ongoing, key, now);
  const nextOpens = dayLabel(nextKey(current.key, ongoing.every, ongoing.everyDays));
  const mineHere = entries.some((e) => e.personId === viewer.id && e.moduleId === m.id && e.intervalKey === key);
  const people = new Set(entries.filter((e) => e.moduleId === m.id && e.intervalKey === key).map((e) => e.personId));
  const others = ongoing.entered?.[key] ?? [...people].filter((id) => id !== viewer.id).length;

  const style = moduleVars(m.colour) as React.CSSProperties;
  const cls = `ws-pane ws-session ws-ongoing${m.fill.pane ? " ws-fill-pane" : ""}${m.fill.title ? " ws-fill-title" : ""}${m.fill.buttons ? " ws-fill-buttons" : ""}`;

  const pick = (k: string | null) => { setPersonId(null); w.setInterval(k); };
  const closedMessage = state === "future"
    ? `This interval has not opened yet. It opens ${dayLabel(key)}.`
    : `This interval is closed. The next one opens ${nextOpens}.`;

  const showFeed = state !== "future" && (!participant || mineHere || state === "past" || !!ongoing.readFirst);
  const gate = participant && state !== "future" && !mineHere && state !== "past" && !ongoing.readFirst;

  return (
    <main className={cls} style={style}>
      <div className="ws-cover">
        <span className="ws-cover-label">[{m.coverLabel || "session picture"}]</span>
        {edit ? <button type="button" className="ws-chip" onClick={() => w.updateModule(m.id, { coverLabel: "session picture: chosen from the library" })}>Choose picture</button> : null}
      </div>

      <div className="ws-ong-frame ws-frame">
        <header className="ws-ong-head ws-frame-head">
          <div className="ws-ong-headrow">
            <div className="ws-ong-titlebox">
              <h1 className="ws-ong-title">{m.title}</h1>
              <span className="ws-ong-tag">Ongoing session &middot; every {unit}</span>
            </div>
            <div className="ws-ong-actions">
              <button type="button" className="ws-btn ws-btn-mod ws-btn-sm" onClick={() => w.setFrame("journal")}>Open journal</button>
              {edit ? <button type="button" className="ws-btn ws-btn-sm" onClick={() => w.openSettings("sessions", m.id)}>Session settings</button> : null}
            </div>
          </div>
          <IntervalStrip ongoing={ongoing} now={now} selectedKey={key} canOpenFuture={!participant} onPick={pick} />
          <span className="ws-ong-sr" aria-live="polite">
            Viewing {fmtKey(key, ongoing.every)}
            {state === "current" ? ` (this ${unit})` : state === "past" ? " (past, read only)" : participant ? " (locked)" : " (coming up: plan it)"}
          </span>
        </header>

        <div className="ws-ong-body ws-frame-body">
          {state === "future" && participant ? (
            <Frame title="This interval" label="This interval"><p className="ws-ong-closed" role="status">{closedMessage}</p></Frame>
          ) : personId ? (
            <PersonEntries m={m} ongoing={ongoing} personId={personId} onBack={() => setPersonId(null)} />
          ) : (
            <>
              {step ? (
                step.prompt ? <p className="ws-ong-stepline ws-prompt">{step.prompt}</p> : null
              ) : <p className="ws-ong-muted">No step is set for this session yet. Choose one in Settings.</p>}

              {writer && step && state !== "future" ? (
                <IntervalEntry m={m} step={step} intervalKey={key} open={open} closedMessage={closedMessage} />
              ) : null}
              {!participant && state === "future" ? <p className="ws-ong-muted">Entries open on {dayLabel(key)}. Plan it in the sheet: add a note and material there.</p> : null}
              {!writer && state !== "future" ? <p className="ws-ong-muted">Participants answer the step here{open ? "" : "; this interval has closed"}.</p> : null}

              {gate ? (
                <Frame title="Others" label="Others">
                  <p className="ws-ong-gate" role="status">{others} {others === 1 ? "person has" : "people have"} entered. Yours opens the others.</p>
                </Frame>
              ) : null}
              {showFeed ? <IntervalFeed m={m} intervalKey={key} onPerson={setPersonId} /> : null}
            </>
          )}
        </div>

        <footer className="ws-ong-foot">
          {ongoing.closes ? "Entries close when the interval ends. Miss one and you wait for the next." : "Entries stay open after the interval ends."}
        </footer>
      </div>
    </main>
  );
}

export default OngoingPane;
