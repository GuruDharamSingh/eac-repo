"use client";
import { useEffect, useId, useState } from "react";
import { canSee, useWorkspace } from "../store";
import type { Module, Step } from "../types";
import { StepsDoing, isLocked } from "./StepsSheet";
import { Messages } from "./Messages";
import { FreeTimer } from "./timer";
import { describeDue, fmtDue } from "./deadline";
import { fmtDate, hasGuideComment, kindLabel } from "../journal/exportJournal";
import { KINDS } from "./kinds";
import "./sheet.css";

const KIND_NAMES: Record<string, string> = { reflection: "reflections", practice: "practice logs", photo: "photos", recording: "recordings", note: "notes", quiz: "quiz answers" };

function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 60000); return () => window.clearInterval(id); }, []);
  return now;
}

export function SheetHome() {
  const w = useWorkspace();
  const { course, mode, viewer, people, selected, done, openStep, setOpenStep, setSheet, select, entries } = w;
  const now = useNow();
  if (!course) return null;
  const mod = course.modules.find((m) => m.id === selected) ?? null;
  const mine = done[viewer.id] ?? [];
  const host = people.find((p) => p.id === course.guideId);

  // A step was chosen on the main page: collapse the header card to an Overview button.
  if (openStep && mod) {
    return (
      <aside className="ws-sh" aria-label="Steps">
        <header className="ws-sh-head">
          <div className="ws-sh-headrow">
            <button type="button" className="ws-sh-btn" onClick={() => setOpenStep(null)}>Overview</button>
            <h2 className="ws-sh-title">{mod.title}</h2>
          </div>
        </header>
        <div className="ws-sh-scroll"><StepsDoing /></div>
      </aside>
    );
  }

  // Next undone step for a participant: the selected module first, then the first unfinished one.
  const nextFor = (m: Module): Step | undefined => m.steps.find((s, i) => !mine.includes(s.id) && !isLocked(m.steps, i, mine));
  const nextMod = mod && nextFor(mod) ? mod : course.modules.find((m) => nextFor(m));
  const next = nextMod ? nextFor(nextMod) : undefined;
  const goTo = (m: Module, s: Step) => { select(m.id); setOpenStep(s.id); setSheet("steps"); };

  const unanswered = entries.filter((e) => !hasGuideComment(course, e)).length;

  return (
    <aside className="ws-sh ws-hm" aria-label="Workspace overview">
      <div className="ws-sh-scroll">
        <HeaderCard />

        <section className="ws-hm-block ws-hm-orient" aria-label="Orientation">
          {mode === "edit" ? (
            <>
              <h3 className="ws-hm-h">Welcome to the editor</h3>
              <ul className="ws-hm-lines">
                <li>Click any text on the page to change it.</li>
                <li>Steps are edited on the page, under each module&apos;s text.</li>
                <li>Each module has its own colour.</li>
                <li>Switch the view at the top to see the workshop as a participant.</li>
              </ul>
            </>
          ) : mode === "participant" ? (
            <>
              <h3 className="ws-hm-h">Welcome to {course.title}</h3>
              {next && nextMod ? (
                <>
                  <p className="ws-hm-p">Next: <strong>{next.title}</strong> in {nextMod.title}.</p>
                  <button type="button" className="ws-sh-btn ws-sh-primary" onClick={() => goTo(nextMod, next)}>Go to it</button>
                </>
              ) : (
                <p className="ws-hm-p">You have finished every step that is open. Look at the journal, or write to the group.</p>
              )}
            </>
          ) : (
            <>
              <h3 className="ws-hm-h">What needs attention</h3>
              <p className="ws-hm-p">
                {unanswered === 0 ? "Every journal entry has a comment from you." : `${unanswered} journal ${unanswered === 1 ? "entry has" : "entries have"} no comment from you yet.`}
              </p>
              <button type="button" className="ws-sh-btn ws-sh-primary" onClick={() => w.setFrame("journal")}>Open concurrent journals</button>
            </>
          )}
        </section>

        <Deadlines now={now} goTo={goTo} />

        <section className="ws-hm-block" aria-label="Steps">
          <h3 className="ws-sh-sub">{mod ? `Steps in ${mod.title}` : "Steps"}</h3>
          <StepsDoing />
        </section>

        <JournalOverview />

        <section className="ws-hm-block" aria-label="People in the group">
          <h3 className="ws-sh-sub">People in the group</h3>
          <ul className="ws-hm-plist">
            {people.map((p) => (
              <li key={p.id} className="ws-hm-pl">
                <span className={`ws-hm-online${p.online ? " is-on" : ""}`} aria-hidden="true" />
                <span>{p.name}{p.id === host?.id ? " (host)" : ""}</span>
                <span className="ws-sh-sr">{p.online ? "online" : "offline"}</span>
              </li>
            ))}
          </ul>
          <button type="button" className="ws-sh-btn ws-sh-btn-quiet" onClick={() => setSheet("people")}>All people</button>
        </section>

        <Messages />

        {mode === "participant" ? (
          <section className="ws-hm-block" aria-label="Timer">
            <h3 className="ws-sh-sub">Timer</h3>
            <p className="ws-sh-meta">A timer for any step, if you want one.</p>
            <FreeTimer />
          </section>
        ) : null}
      </div>
    </aside>
  );
}

function HeaderCard() {
  const { course, people, viewer, setSheet, setFrame, select, sendMessage } = useWorkspace();
  const [profileOpen, setProfileOpen] = useState(false);
  const [contacting, setContacting] = useState(false);
  const [msg, setMsg] = useState("");
  const [sent, setSent] = useState(false);
  const id = useId();
  if (!course) return null;
  const host = people.find((p) => p.id === course.guideId);
  const isHost = host?.id === viewer.id;
  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const t = msg.trim();
    if (!t || !host) return;
    sendMessage(`@${host.name} ${t}`);
    setMsg(""); setContacting(false); setSent(true);
  };
  return (
    <section className="ws-hm-card" aria-label="Workshop">
      <div className="ws-hm-cardtop">
        <div>
          <h2 className="ws-hm-name">{course.title}</h2>
          {course.line ? <p className="ws-hm-line">{course.line}</p> : null}
        </div>
        <button type="button" className="ws-sh-btn ws-sh-btn-quiet" aria-label="Close the sheet" onClick={() => setSheet(null)}>Close</button>
      </div>
      {host ? (
        <div className="ws-hm-host">
          <span>Hosted by <strong>{host.name}</strong></span>
          <button type="button" className="ws-hm-link" aria-expanded={profileOpen} onClick={() => setProfileOpen(!profileOpen)}>profile</button>
          {!isHost && <button type="button" className="ws-sh-btn" aria-expanded={contacting} onClick={() => { setContacting(!contacting); setSent(false); }}>Contact the host</button>}
        </div>
      ) : null}
      {profileOpen && host ? (
        <div className="ws-hm-hostcard">
          <span className="ws-hm-avatar" aria-hidden="true">{host.initials}</span>
          <div>
            <div className="ws-hm-personname">{host.name}<span className={`ws-hm-online${host.online ? " is-on" : ""}`} aria-hidden="true" /></div>
            <div className="ws-hm-bio">{host.bio || "No bio yet."}</div>
          </div>
        </div>
      ) : null}
      {contacting && host ? (
        <form className="ws-hm-contact" onSubmit={send}>
          <label htmlFor={`${id}-c`} className="ws-sh-label">Message to {host.name}</label>
          <textarea id={`${id}-c`} className="ws-sh-input" rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Write a few lines" />
          <div className="ws-sh-row">
            <button type="submit" className="ws-sh-btn ws-sh-primary" disabled={!msg.trim()}>Send to the host</button>
            <button type="button" className="ws-sh-btn ws-sh-btn-quiet" onClick={() => setContacting(false)}>Cancel</button>
          </div>
          <p className="ws-sh-meta">Prototype: it is posted in the group messages, addressed to the host.</p>
        </form>
      ) : null}
      {sent ? <p className="ws-sh-saved" role="status">Sent to the host in the group messages.</p> : null}
      <button type="button" className="ws-hm-me" onClick={() => setSheet("profile")}>
        <span className="ws-hm-avatar" aria-hidden="true">{viewer.initials}</span>
        <span><span className="ws-sh-meta">Your profile</span><br />{viewer.name}</span>
      </button>
      <div className="ws-hm-menu" role="group" aria-label="Workspace menu">
        <button type="button" className="ws-sh-btn" onClick={() => setFrame("journal")}>Open journal</button>
        <button type="button" className="ws-sh-btn" onClick={() => setSheet("people")}>People</button>
        <button type="button" className="ws-sh-btn" onClick={() => select("settings")}>Settings</button>
      </div>
    </section>
  );
}

function Deadlines({ now, goTo }: { now: number; goTo: (m: Module, s: Step) => void }) {
  const { course, mode, viewer, people, done } = useWorkspace();
  if (!course) return null;
  const mine = done[viewer.id] ?? [];
  const group = people.filter((p) => p.role === "participant");
  const all = course.modules.flatMap((m) => m.steps.filter((s) => s.due).map((s) => ({ m, s })));
  const rows = (mode === "participant" ? all.filter((r) => !mine.includes(r.s.id)) : all)
    .sort((a, b) => new Date(a.s.due as string).getTime() - new Date(b.s.due as string).getTime());
  if (rows.length === 0) return null;
  const title = mode === "participant" ? "Coming up" : "Deadlines";
  return (
    <section className="ws-hm-block" aria-label={title}>
      <h3 className="ws-sh-sub">{title}</h3>
      <ul className="ws-sh-list">
        {rows.map(({ m, s }) => {
          const d = describeDue(s.due as string, now);
          const n = group.filter((p) => (done[p.id] ?? []).includes(s.id)).length;
          return (
            <li key={s.id} className="ws-hm-due">
              <div className="ws-hm-duemain">
                <div className="ws-sh-steptitle">{s.title}</div>
                <div className="ws-sh-meta">{m.title} · {fmtDue(s.due as string)}</div>
                <div className={`ws-hm-count${d.overdue ? " is-over" : ""}`}>
                  {d.text}{mode !== "participant" ? ` · ${n} of ${group.length} done` : ""}
                </div>
              </div>
              <button type="button" className="ws-sh-btn" onClick={() => goTo(m, s)}>{mode === "participant" ? "Go to it" : "Open"}</button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function JournalOverview() {
  const { course, viewer, people, entries, setFrame } = useWorkspace();
  if (!course) return null;
  const seen = entries.filter((e) => {
    const p = people.find((x) => x.id === e.personId);
    return p ? canSee(viewer, p, course) : false;
  });
  const counts: Record<string, number> = {};
  seen.forEach((e) => { counts[e.kind] = (counts[e.kind] ?? 0) + 1; });
  const recent = [...seen].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 3);
  return (
    <section className="ws-hm-block" aria-label="Journal overview">
      <h3 className="ws-sh-sub">Journal</h3>
      {seen.length === 0 ? (
        <p className="ws-sh-meta">Nothing yet. Reflections, logs, photos, recordings, notes and quiz answers all gather in the journal.</p>
      ) : (
        <>
          <p className="ws-hm-p">{seen.length} {seen.length === 1 ? "entry" : "entries"}: {Object.entries(counts).map(([k, n]) => `${n} ${KIND_NAMES[k] ?? k}`).join(", ")}.</p>
          <ul className="ws-sh-list">
            {recent.map((e) => {
              const p = people.find((x) => x.id === e.personId);
              return (
                <li key={e.id} className="ws-hm-entry">
                  <div className="ws-sh-meta">{kindLabel(e)} · {p?.name ?? "Someone"} · {fmtDate(e.at)}</div>
                  <div className="ws-hm-clip">{e.text || e.mediaLabel || ""}</div>
                </li>
              );
            })}
          </ul>
        </>
      )}
      <button type="button" className="ws-sh-btn" onClick={() => setFrame("journal")}>Open the journal</button>
    </section>
  );
}
export default SheetHome;
