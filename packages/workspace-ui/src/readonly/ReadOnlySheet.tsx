"use client";
import { useWorkspace } from "../store";
import { KINDS } from "../sheet/kinds";
import { StepView } from "./StepView";
import { OngoingSheetTop } from "../ongoing/OngoingSheet";
import { ExperimentSheet } from "./ExperimentPanels";
import { FreeTimer, TimerView } from "../sheet/timer";
import { Frame, useStored } from "../Frame";
import { moduleVars } from "../colour";
import type { Module } from "../types";
import "../sheet/sheet.css";

const Icon = ({ d }: { d: string }) => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const CHECK = "M3 8.5l3.2 3L13 4.5";
const LOCK = "M5 7V5.5a3 3 0 016 0V7M4 7h8v6H4z";

/** The steps of the open module as a plain list; the chosen step shows below it. */
function StepList() {
  const w = useWorkspace();
  const { course, selected, openStep, setOpenStep } = w;
  const mod = course?.modules.find((m) => m.id === selected) ?? null;
  if (!course) return <p className="ws-sh-meta">No workspace here.</p>;
  if (!mod) return <p className="ws-sh-meta">Pick a section on the left to see its steps.</p>;
  if (mod.steps.length === 0) return <p className="ws-sh-meta">This section has no steps yet.</p>;
  const current = mod.steps.find((s) => s.id === openStep) ?? null;
  return (
    <div>
      <ol className="ws-sh-list">
        {mod.steps.map((s) => {
          const on = current?.id === s.id;
          const isDone = w.canDo && (w.done[w.viewer.id] ?? []).includes(s.id);
          const acc = w.doing?.access[s.id];
          const locked = w.canDo && !isDone && acc !== undefined && !acc.allowed;
          return (
            <li key={s.id}>
              <button type="button" disabled={locked} className={`ws-sh-step${on ? " is-current" : ""}${isDone ? " is-done" : ""}${locked ? " is-locked" : ""}`} aria-current={on ? "step" : undefined} onClick={() => setOpenStep(s.id)}>
                {w.canDo ? <span className="ws-sh-dot" aria-hidden="true">{isDone ? <Icon d={CHECK} /> : locked ? <Icon d={LOCK} /> : null}</span> : null}
                <span className="ws-sh-chip">{KINDS[s.kind].label}</span>
                <span className="ws-sh-steptitle">{s.title}</span>
                {w.canDo ? <span className="ws-sh-sr">{isDone ? "done" : locked ? "locked" : ""}</span> : null}
              </button>
            </li>
          );
        })}
      </ol>
      {current ? (
        <section className="ws-sh-card" aria-label={`Step: ${current.title}`}>
          <div className="ws-hm-cardhead">
            <h3 className="ws-sh-cardtitle">{current.title}</h3>
            <button type="button" className="ws-sh-btn ws-sh-btn-quiet" onClick={() => { w.setOpenStep(current.id); w.setFrame("step"); }}>Open large</button>
          </div>
          <StepView step={current} />
        </section>
      ) : null}
    </div>
  );
}

type Tab = "general" | "session";
const TABS = ["general", "session"] as const;

/** The sheet, in two views: the workspace in General, and the selected session in This session. The choice is remembered for this viewer. */
export function ReadOnlyHome() {
  const w = useWorkspace();
  const [tab, setTab] = useStored<Tab>("ws-sheet-tab", "general", TABS);
  if (!w.course) return null;
  return (
    <aside className="ws-sh ws-hm ws-sheet2" aria-label={tab === "general" ? "Workspace sheet, general" : "Workspace sheet, this session"}>
      <div className="ws-sheet-tabs" role="group" aria-label="What the sheet shows">
        <button type="button" className="ws-sheet-tab-btn" aria-pressed={tab === "general"} onClick={() => setTab("general")}>General</button>
        <button type="button" className="ws-sheet-tab-btn" aria-pressed={tab === "session"} onClick={() => setTab("session")}>This session</button>
      </div>
      <div className="ws-sh-scroll">{tab === "general" ? <GeneralView /> : <SessionView />}</div>
    </aside>
  );
}

/** General: the workspace itself. Welcome, the card, the host, the call, people, and consent for an experiment. */
function GeneralView() {
  const w = useWorkspace();
  const { course, people, mode, setSheet } = w;
  if (!course) return null;
  const host = people.find((p) => p.id === course.guideId);
  const mine = w.done[w.viewer.id] ?? [];
  const nextMod = w.canDo ? course.modules.find((m) => m.steps.some((s) => !mine.includes(s.id) && w.doing?.access[s.id]?.allowed !== false)) : undefined;
  const next = nextMod?.steps.find((s) => !mine.includes(s.id) && w.doing?.access[s.id]?.allowed !== false);
  const guides = people.filter((p) => p.role === "guide" && p.id !== "viewer");
  return (
    <>
      <Frame title="Workspace" collapsible storeKey="general-card" label="Workspace card">
        <h2 className="ws-hm-name">{course.title}</h2>
        {course.line ? <p className="ws-hm-line">{course.line}</p> : null}
        {host ? (
          <div className="ws-hm-hostcard">
            <span className="ws-hm-avatar" aria-hidden="true">{host.initials}</span>
            <div>
              <div className="ws-hm-personname">{host.name}</div>
              <div className="ws-hm-bio">{host.bio || "Host of this workspace."}</div>
            </div>
          </div>
        ) : null}
        <p className="ws-sh-meta">
          {mode === "edit" ? "You are editing." : `You are looking at this as ${mode === "guide" ? "a guide" : "a participant"}.`}
          {mode === "edit" ? "" : w.canDo ? (mode === "guide" ? " You take part too: your entries show a guide mark." : "") : " It is read only for now."}
        </p>
      </Frame>
      <Frame title="Welcome" collapsible storeKey="general-welcome" label="Orientation">
        <h3 className="ws-hm-h">{mode === "edit" ? `You are editing ${course.title}` : mode === "guide" ? `You guide ${course.title}` : `Welcome to ${course.title}`}</h3>
        <p className="ws-hm-p">
          {mode === "edit" ? "Click any text on a page to change it. Changes save as you go; participants see them when you publish." : mode === "guide"
            ? "Pick a session on the left, then a step, to read it as your group does. Open People to see who is in the group."
            : "Pick a session on the left, then a step, to read it."}
        </p>
        {w.canDo ? (next && nextMod ? (
          <>
            <p className="ws-hm-p">Next: <strong>{next.title}</strong> in {nextMod.title}.</p>
            <button type="button" className="ws-sh-btn ws-sh-primary" onClick={() => { w.select(nextMod.id); w.setOpenStep(next.id); }}>Go to it</button>
          </>
        ) : <p className="ws-hm-p">You have finished every step that is open.</p>) : null}
      </Frame>
      {course.callLink ? (
        <Frame title="The call" collapsible storeKey="general-call" label="Call">
          <a className="ws-sh-btn ws-sh-primary" href={course.callLink} target="_blank" rel="noreferrer noopener">Join the call{hostOf(course.callLink) ? ` · ${hostOf(course.callLink)}` : ""}</a>
        </Frame>
      ) : null}
      <Frame title="People" collapsible storeKey="general-people" label="People">
        <p className="ws-hm-p">
          {guides.length > 0 ? `Guides: ${guides.map((g) => g.name).join(", ")}.` : "No guide is named yet."}
          {course.peopleCount !== undefined ? ` ${course.peopleCount} ${course.peopleCount === 1 ? "person" : "people"} in the group.` : ""}
        </p>
        {mode === "guide" ? <button type="button" className="ws-sh-btn" onClick={() => setSheet("people")}>See everyone</button> : null}
      </Frame>
      <ExperimentSheet />
    </>
  );
}

/** This session: the selected module's steps, material, timer, and for an ongoing session the day's material. */
function SessionView() {
  const w = useWorkspace();
  const { course, selected } = w;
  const mod: Module | null = course?.modules.find((m) => m.id === selected) ?? null;
  if (!course) return null;
  if (!mod) {
    return (
      <Frame title="This session" label="This session">
        <p className="ws-sh-meta">Pick a session on the left. Its steps, material and timer show here.</p>
      </Frame>
    );
  }
  const style = moduleVars(mod.colour) as React.CSSProperties;
  if (mod.kind === "ongoing" && mod.ongoing) return <div className="ws-sheet-session" style={style}><OngoingSheetTop m={mod} /></div>;
  const step = mod.steps.find((s) => s.id === w.openStep) ?? mod.steps.find((s) => s.kind === "practice") ?? null;
  return (
    <div className="ws-sheet-session" style={style}>
      <Frame title={mod.title} collapsible storeKey={`session-${mod.id}-head`} label="Session">
        {mod.date || mod.length ? <p className="ws-sh-meta">{[mod.date, mod.length].filter(Boolean).join(" · ")}</p> : null}
        {mod.description ? <p className="ws-hm-p">{mod.description}</p> : null}
      </Frame>
      <Frame title="Steps" collapsible storeKey={`session-${mod.id}-steps`} label="Steps">
        <StepList />
      </Frame>
      {mod.materials.length > 0 ? (
        <Frame title="Material" collapsible storeKey={`session-${mod.id}-material`} label="Material">
          <ul className="ws-sh-list">
            {mod.materials.map((mt) => (
              <li key={mt.id} className="ws-ong-mat">
                <span>{mt.url ? <a href={mt.url} target="_blank" rel="noreferrer">{mt.name}</a> : mt.name}</span>
                <span className="ws-chip-3">{mt.access === "open" ? "Open to everyone" : "Participants only"}</span>
              </li>
            ))}
          </ul>
        </Frame>
      ) : null}
      <Frame title="Timer" collapsible storeKey={`session-${mod.id}-timer`} label="Timer">
        {step?.kind === "practice" ? <TimerView id={`sheet-${step.id}`} minutes={step.timeLimit && step.timeLimit > 0 ? step.timeLimit : step.minutes && step.minutes > 0 ? step.minutes : 10} label="Practice timer" /> : <FreeTimer />}
      </Frame>
    </div>
  );
}

/** The steps view on its own (sheet === "steps"). */
export function ReadOnlySteps() {
  const { course, selected, setSheet, setOpenStep } = useWorkspace();
  const mod = course?.modules.find((m) => m.id === selected) ?? null;
  return (
    <aside className="ws-sh" aria-label="Steps">
      <header className="ws-sh-head">
        <div className="ws-sh-headrow">
          <h2 className="ws-sh-title">{mod ? mod.title : "Steps"}</h2>
          <div className="ws-sh-headbtns">
            <button type="button" className="ws-sh-btn" onClick={() => { setOpenStep(null); setSheet("home"); }}>Overview</button>
          </div>
        </div>
      </header>
      <div className="ws-sh-scroll"><StepList /></div>
    </aside>
  );
}

/** Who is in the group. Guides only; the server sends a roster to staff and nobody else. */
export function ReadOnlyPeople() {
  const { people, course, setSheet, setOpenStep, mode } = useWorkspace();
  const hostId = course?.guideId;
  const ordered = [...people].filter((p) => p.id !== "viewer").sort((a, b) => (a.id === hostId ? -1 : b.id === hostId ? 1 : a.role === b.role ? 0 : a.role === "guide" ? -1 : 1));
  return (
    <aside className="ws-sh" aria-label="People">
      <header className="ws-sh-head">
        <div className="ws-sh-headrow">
          <h2 className="ws-sh-title">People</h2>
          <button type="button" className="ws-sh-btn" onClick={() => { setOpenStep(null); setSheet("home"); }}>Overview</button>
        </div>
      </header>
      <div className="ws-sh-scroll">
        {mode !== "guide" ? <p className="ws-sh-meta">Only guides see who is in the group.</p> : null}
        <ul className="ws-sh-list">
          {ordered.map((p) => (
            <li key={p.id} className="ws-hm-person">
              <span className="ws-hm-avatar" aria-hidden="true">{p.initials}</span>
              <div className="ws-hm-personmain">
                <div className="ws-hm-personname">{p.name}</div>
                <div className="ws-sh-meta">{p.id === hostId ? "Host" : p.role === "guide" ? "Guide" : "Participant"}{p.bio ? ` · ${p.bio}` : ""}</div>
              </div>
            </li>
          ))}
        </ul>
        {people.length === 0 ? <p className="ws-sh-meta">Nobody is in this group yet.</p> : null}
      </div>
    </aside>
  );
}

/** The host of a pasted link, for the button ("meet.example.org"). */
function hostOf(url: string): string {
  try { return new URL(url).host; } catch { return ""; }
}
