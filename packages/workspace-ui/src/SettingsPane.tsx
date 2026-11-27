"use client";

import { useEffect, useState } from "react";
import { useWorkspace, currentIntervalKey, intervalLabel } from "./store";
import { readable } from "./Field";
import { PALETTE } from "./sample";
import { PeopleServer } from "./readonly/PeopleServer";
import { ExperimentSettings, ResultsSettings } from "./readonly/ExperimentPanels";
import { KINDS, KIND_ORDER } from "./sheet/kinds";
import type { Course, IntervalPlan, JournalVisibility, Module, Ongoing, Pacing, StepKind } from "./types";

const SECTIONS = [
  { id: "workshop", label: "Workshop" },
  { id: "sessions", label: "Sessions" },
  { id: "steps", label: "Steps" },
  { id: "journal", label: "Shared journal" },
  { id: "emails", label: "Emails" },
  { id: "call", label: "Call link" },
  { id: "people", label: "People" },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

const VIS: { id: JournalVisibility; label: string; line: string }[] = [
  { id: "private", label: "Private", line: "Each person and the guide can read an entry." },
  { id: "shared", label: "Shared", line: "People in the workshop see each other's entries. Never anyone outside it." },
];

const PACING: { id: Pacing; label: string; line: string }[] = [
  { id: "open", label: "Open", line: "Everything is available from the start." },
  { id: "in-order", label: "In order", line: "A session opens when the one before it is done." },
  { id: "by-date", label: "By date", line: "A session opens on its date." },
];

function Later() {
  return <span className="ws-badge">later</span>;
}

const addDays = (iso: string, n: number) => new Date(Date.parse(iso.slice(0, 10) + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);

export function SettingsPane() {
  const w = useWorkspace();
  const c = w.course;
  if (!c) return null;
  return (
    <main className="ws-pane ws-settings">
      <h1 className="ws-title">Settings</h1>
      {w.readOnly ? <p className="ws-muted">You are looking at these read only. Only the guides of this workspace, and the owners and guides of the organisation, can change them.</p> : null}
      {w.mode === "participant" ? <Mine /> : <Owner c={c} />}
    </main>
  );
}

function Owner({ c }: { c: Course }) {
  const w = useWorkspace();
  const f = w.settingsFocus;
  const [section, setSection] = useState<string>((f?.section as SectionId) ?? "workshop");
  const sections: { id: string; label: string }[] = [...SECTIONS, ...(w.server?.experiment ? [{ id: "experiment", label: "Experiment" }, { id: "results", label: "Results" }] : [])];
  const [moduleId, setModuleId] = useState<string>(f?.section === "sessions" && f.id ? f.id : c.modules[0]?.id ?? "");
  const [stepKey, setStepKey] = useState<string>(f?.section === "steps" && f.id ? f.id : "");

  useEffect(() => {
    if (!f) return;
    setSection(f.section);
    if (f.section === "sessions" && f.id) setModuleId(f.id);
    if (f.section === "steps" && f.id) setStepKey(f.id);
  }, [f]);

  return (
    <div className="ws-set">
      <nav className="ws-set-nav" aria-label="Settings sections">
        {sections.map((s) => (
          <button key={s.id} type="button" className="ws-item" aria-current={section === s.id ? "page" : undefined} onClick={() => setSection(s.id)}>
            <span className="ws-item-t">{s.label}</span>
          </button>
        ))}
      </nav>
      <div className="ws-set-body">
        {section === "workshop" ? <WorkshopSettings c={c} /> : null}
        {section === "sessions" ? <SessionSettings c={c} moduleId={moduleId} setModuleId={setModuleId} /> : null}
        {section === "steps" ? <StepSettings c={c} stepKey={stepKey} setStepKey={setStepKey} /> : null}
        {section === "journal" ? <JournalSettings c={c} /> : null}
        {section === "emails" ? <EmailSettings c={c} /> : null}
        {section === "call" ? <CallSettings c={c} /> : null}
        {section === "people" ? (w.server ? <PeopleServer /> : <PeopleSettings />) : null}
        {section === "experiment" ? <ExperimentSettings /> : null}
        {section === "results" ? <ResultsSettings orgName={c.orgName ?? "the organisation"} /> : null}
      </div>
    </div>
  );
}

function WorkshopSettings({ c }: { c: Course }) {
  const w = useWorkspace();
  const noEnd = !c.endDate && c.endDate !== "";
  return (
    <section aria-label="Workshop">
      <h2 className="ws-h2">Workshop</h2>
      <label className="ws-q"><span>Title</span><input type="text" value={c.title} onChange={(e) => w.updateCourse({ title: e.target.value })} /></label>
      <label className="ws-q">
        <span>Status</span>
        <select className="ws-select" value={c.status} onChange={(e) => w.updateCourse({ status: e.target.value as Course["status"] })}>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>
      </label>
      <fieldset className="ws-q">
        <legend>Who can join</legend>
        <label className="ws-check ws-set-opt">
          <input type="radio" name="ws-join" checked={c.join === "open"} onChange={() => w.updateCourse({ join: "open" })} />
          <span><strong>Free and open</strong><br /><span className="ws-muted">People sign in and click in. That counts as an RSVP.</span></span>
        </label>
        <label className="ws-check ws-set-opt">
          <input type="radio" name="ws-join" checked={c.join === "invite"} onChange={() => w.updateCourse({ join: "invite" })} />
          <span><strong>By invitation</strong><br /><span className="ws-muted">Only people you invite can enter.</span></span>
        </label>
      </fieldset>
      <div className="ws-q">
        <span>End date</span>
        <div className="ws-row">
          <input type="date" aria-label="End date" value={c.endDate ?? ""} disabled={noEnd} onChange={(e) => w.updateCourse({ endDate: e.target.value })} />
          <label className="ws-check">
            <input type="checkbox" checked={noEnd} onChange={(e) => w.updateCourse({ endDate: e.target.checked ? null : "" })} />
            No end date
          </label>
        </div>
      </div>
      <fieldset className="ws-q">
        <legend>Pacing</legend>
        {PACING.map((p) => (
          <label key={p.id} className="ws-check ws-set-opt">
            <input type="radio" name="ws-pacing" checked={c.pacing === p.id} disabled={Boolean(w.server) && p.id === "by-date"} onChange={() => w.updateCourse({ pacing: p.id })} />
            <span><strong>{p.label}</strong><br /><span className="ws-muted">{p.line}</span></span>
          </label>
        ))}
      </fieldset>
      {w.server ? null : <label className="ws-q"><span>Price</span><input type="text" value={c.price} onChange={(e) => w.updateCourse({ price: e.target.value })} /></label>}
      {w.server ? null : <label className="ws-q">
        <span>Where</span>
        <select className="ws-select" value={c.where} onChange={(e) => w.updateCourse({ where: e.target.value as Course["where"] })}>
          <option>In person</option><option>Online</option><option>Both</option>
        </select>
      </label>}
      <ul className="ws-set-later">
        <li>Waiting list <Later /></li>
        <li>Refund terms <Later /></li>
        <li>Certificate on completion <Later /></li>
      </ul>
    </section>
  );
}

function SessionSettings({ c, moduleId, setModuleId }: { c: Course; moduleId: string; setModuleId: (id: string) => void }) {
  const m = c.modules.find((x) => x.id === moduleId) ?? c.modules[0];
  return (
    <section aria-label="Sessions">
      <h2 className="ws-h2">Sessions</h2>
      {c.modules.length === 0 || !m ? <p className="ws-muted">No sessions yet. Add one from the list on the left.</p> : (
        <>
          <label className="ws-q">
            <span>Session</span>
            <select className="ws-select" value={m.id} onChange={(e) => setModuleId(e.target.value)}>
              {c.modules.map((x, i) => <option key={x.id} value={x.id}>{i + 1} · {x.title}{x.kind === "ongoing" ? " (ongoing)" : ""}</option>)}
            </select>
          </label>
          <SessionBody m={m} index={c.modules.indexOf(m)} />
        </>
      )}
    </section>
  );
}

function SessionBody({ m, index }: { m: Module; index: number }) {
  const w = useWorkspace();
  const ongoing = m.kind === "ongoing";
  const upd = (patch: Partial<Module>) => w.updateModule(m.id, patch);
  const { ratio } = readable(m.colour);
  return (
    <>
      <div className="ws-q">
        <span>Type</span>
        <div className="ws-seg" role="group" aria-label="Session type">
          <button type="button" className="ws-mode" aria-pressed={!ongoing} onClick={() => w.setModuleKind(m.id, "standard")}>Standard</button>
          <button type="button" className="ws-mode" aria-pressed={ongoing} onClick={() => w.setModuleKind(m.id, "ongoing")}>Ongoing</button>
        </div>
        <small className="ws-muted">{ongoing ? "One step that repeats every interval. Each interval closes when it ends." : "A dated session with its own steps."}</small>
      </div>
      <label className="ws-q"><span>Title</span><input type="text" value={m.title} onChange={(e) => upd({ title: e.target.value })} /></label>
      {!ongoing ? <label className="ws-q"><span>Date</span><input type="text" value={m.date ?? ""} placeholder="Thu 14 Jan, 7:00 pm" onChange={(e) => upd({ date: e.target.value })} /></label> : null}
      <div className="ws-q">
        <span>Cover</span>
        <div className="ws-row">
          <span className="ws-muted">[{m.coverLabel || "session picture"}]</span>
          <button type="button" className="ws-btn ws-btn-small" onClick={() => { if (w.server) { const u = window.prompt("Address of a picture (a web link starting with https://). Leave empty to remove it.", m.coverUrl ?? ""); if (u !== null) upd({ coverUrl: u.trim() }); } else upd({ coverLabel: "session picture: chosen from the library" }); }}>Choose picture</button>
        </div>
      </div>
      <div className="ws-q">
        <span>Colour</span>
        <div className="ws-swatches">
          {PALETTE.map((p) => (
            <button key={p} type="button" className="ws-swatch" style={{ background: p }} aria-label={`Colour ${p}`} aria-pressed={m.colour === p} onClick={() => upd({ colour: p })} />
          ))}
          <input type="color" className="ws-colorpick" aria-label="Any colour" value={m.colour} onChange={(e) => upd({ colour: e.target.value })} />
        </div>
        <small className="ws-muted">Text on it: {ratio.toFixed(1)}:1{ratio < 4.5 ? " (low: pick a deeper colour)" : ""}</small>
      </div>

      {ongoing && m.ongoing ? <OngoingSettings m={m} o={m.ongoing} /> : null}

      <h3 className="ws-h3">Steps in this session</h3>
      {m.steps.length === 0 ? <p className="ws-muted">No steps yet.</p> : (
        <ol className="ws-ms-list">
          {m.steps.map((s, i) => (
            <li key={s.id} className="ws-ms-row">
              <div className="ws-ms-head">
                <span className="ws-ms-move">
                  <button type="button" className="ws-linkbtn" aria-label="Move up" disabled={i === 0} onClick={() => w.moveStep(m.id, s.id, -1)}>↑</button>
                  <button type="button" className="ws-linkbtn" aria-label="Move down" disabled={i === m.steps.length - 1} onClick={() => w.moveStep(m.id, s.id, 1)}>↓</button>
                </span>
                <span className="ws-badge">{KINDS[s.kind].label}</span>
                <span className="ws-ms-title">{s.title}</span>
                <button type="button" className="ws-linkbtn" onClick={() => w.openSettings("steps", s.id)}>Step settings</button>
              </div>
            </li>
          ))}
        </ol>
      )}
      <p className="ws-muted">Session {index + 1}. <button type="button" className="ws-linkbtn" onClick={() => w.select(m.id)}>Open it in the main area</button></p>
    </>
  );
}

function OngoingSettings({ m, o }: { m: Module; o: Ongoing }) {
  const w = useWorkspace();
  const up = (patch: Partial<Ongoing>) => w.updateOngoing(m.id, patch);
  const cur = currentIntervalKey(o, w.now);
  const span = o.every === "week" ? 7 : 1;
  const rows = Array.from({ length: 7 }, (_, i) => addDays(cur, i * span));
  return (
    <div className="ws-set-ongoing">
      <h3 className="ws-h3">Ongoing session</h3>
      <label className="ws-q">
        <span>Repeating step</span>
        <select className="ws-select" value={o.stepId} onChange={(e) => up({ stepId: e.target.value })}>
          {m.steps.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
        </select>
      </label>
      <label className="ws-q">
        <span>Interval</span>
        <select className="ws-select" value={o.every} onChange={(e) => up({ every: e.target.value as Ongoing["every"] })}>
          <option value="day">Every day</option>
          <option value="week">Every week</option>
        </select>
      </label>
      <label className="ws-q"><span>Start date</span><input type="date" value={o.start} onChange={(e) => { if (e.target.value) up({ start: e.target.value }); }} /></label>
      <label className="ws-check">
        <input type="checkbox" checked={o.closes} onChange={(e) => up({ closes: e.target.checked })} />
        Entries close when the interval ends
      </label>
      <label className="ws-check">
        <input type="checkbox" role="switch" checked={!!o.readFirst} onChange={(e) => up({ readFirst: e.target.checked })} />
        People can read others&apos; entries before entering their own
      </label>
      <p className="ws-muted">Off: a participant enters first, and that opens everyone else&apos;s entries for the interval. On: they can read first.</p>
      <div className="ws-q">
        <span>Intervals shown in the strip</span>
        <div className="ws-seg" role="group" aria-label="Strip length">
          {([5, 7] as const).map((n) => (
            <button key={n} type="button" className="ws-mode" aria-pressed={o.show === n} onClick={() => up({ show: n })}>{n}</button>
          ))}
        </div>
      </div>
      <h4 className="ws-h3">Coming up</h4>
      <p className="ws-muted">Set the material for any coming {o.every === "week" ? "week" : "day"} ahead of time.</p>
      <table className="ws-set-table">
        <thead><tr><th>{o.every === "week" ? "Week" : "Day"}</th><th>Note</th><th>Material</th></tr></thead>
        <tbody>
          {rows.map((key) => <PlanRow key={key} m={m} k={key} label={intervalLabel(key, o.every)} current={key === cur} plan={o.plans.find((p) => p.key === key)} />)}
        </tbody>
      </table>
    </div>
  );
}

function PlanRow({ m, k, label, current, plan }: { m: Module; k: string; label: string; current: boolean; plan?: IntervalPlan }) {
  const w = useWorkspace();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [access, setAccess] = useState<"open" | "participants">("participants");
  const mats = plan?.materials ?? [];
  const add = () => {
    const n = name.trim();
    if (!n) return;
    w.planInterval(m.id, k, { materials: [...mats, { id: `mt-${Math.random().toString(36).slice(2, 7)}`, name: n, access }] });
    setName(""); setAdding(false);
  };
  return (
    <tr>
      <th scope="row">{label}{current ? <span className="ws-badge ws-set-now">today</span> : null}</th>
      <td>
        <input type="text" aria-label={`Note for ${label}`} value={plan?.note ?? ""} placeholder="A line for this interval" onChange={(e) => w.planInterval(m.id, k, { note: e.target.value })} />
      </td>
      <td>
        <ul className="ws-set-mats">
          {mats.map((x) => (
            <li key={x.id}>
              <span>{x.name}</span>
              <select
                className="ws-select" aria-label={`Access for ${x.name}`} value={x.access}
                onChange={(e) => w.planInterval(m.id, k, { materials: mats.map((y) => (y.id === x.id ? { ...y, access: e.target.value as "open" | "participants" } : y)) })}
              >
                <option value="open">Open</option>
                <option value="participants">Participants</option>
              </select>
              <button type="button" className="ws-linkbtn" onClick={() => w.planInterval(m.id, k, { materials: mats.filter((y) => y.id !== x.id) })}>Remove</button>
            </li>
          ))}
        </ul>
        {adding ? (
          <div className="ws-set-add">
            <input type="text" aria-label="Material name" autoFocus value={name} placeholder="Name, e.g. Prompt.pdf" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
            <div className="ws-seg" role="group" aria-label="Who can open it">
              <button type="button" className="ws-mode" aria-pressed={access === "open"} onClick={() => setAccess("open")}>Open</button>
              <button type="button" className="ws-mode" aria-pressed={access === "participants"} onClick={() => setAccess("participants")}>Participants</button>
            </div>
            <button type="button" className="ws-btn ws-btn-small" onClick={add}>Add</button>
            <button type="button" className="ws-linkbtn" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        ) : (
          <button type="button" className="ws-btn ws-btn-small" onClick={() => setAdding(true)}>Add material</button>
        )}
      </td>
    </tr>
  );
}

const isoParts = (due?: string) => (due && !Number.isNaN(Date.parse(due)) ? { d: due.slice(0, 10), t: new Date(due).toISOString().slice(11, 16) } : { d: "", t: "" });

function StepSettings({ c, stepKey, setStepKey }: { c: Course; stepKey: string; setStepKey: (k: string) => void }) {
  const w = useWorkspace();
  const all = c.modules.flatMap((m) => m.steps.map((s) => ({ m, s })));
  const hit = all.find((x) => x.s.id === stepKey) ?? all[0];
  if (!hit) return <section aria-label="Steps"><h2 className="ws-h2">Steps</h2><p className="ws-muted">No steps yet.</p></section>;
  const { m, s } = hit;
  const p = isoParts(s.due);
  const patch = (x: Partial<typeof s>) => w.updateStep(m.id, s.id, x);
  const setDue = (d: string, t: string) => patch({ due: d ? new Date(`${d}T${t || "23:00"}:00Z`).toISOString() : undefined });
  return (
    <section aria-label="Steps">
      <h2 className="ws-h2">Steps</h2>
      <label className="ws-q">
        <span>Step</span>
        <select className="ws-select" value={s.id} onChange={(e) => setStepKey(e.target.value)}>
          {c.modules.map((x, i) => (
            <optgroup key={x.id} label={`${i + 1} · ${x.title}`}>
              {x.steps.map((y) => <option key={y.id} value={y.id}>{y.title}</option>)}
            </optgroup>
          ))}
        </select>
      </label>
      <p className="ws-muted">In session {c.modules.indexOf(m) + 1}, {m.title}. <button type="button" className="ws-linkbtn" onClick={() => w.openSettings("sessions", m.id)}>Session settings</button></p>
      <label className="ws-q"><span>Title</span><input type="text" value={s.title} onChange={(e) => patch({ title: e.target.value })} /></label>
      <label className="ws-q">
        <span>Kind</span>
        <select className="ws-select" value={s.kind} onChange={(e) => patch({ kind: e.target.value as StepKind })}>
          {KIND_ORDER.map((k) => <option key={k} value={k}>{KINDS[k].label}</option>)}
        </select>
      </label>
      <label className="ws-check">
        <input type="checkbox" checked={!!s.required} onChange={(e) => patch({ required: e.target.checked })} />
        Required
      </label>
      <div className="ws-q">
        <span>Deadline</span>
        <div className="ws-row">
          <input type="date" aria-label="Deadline date" value={p.d} onChange={(e) => setDue(e.target.value, p.t)} />
          <input type="time" aria-label="Deadline time" value={p.t} disabled={!p.d} onChange={(e) => setDue(p.d, e.target.value)} />
          {p.d ? <button type="button" className="ws-linkbtn" onClick={() => patch({ due: undefined })}>No deadline</button> : null}
        </div>
        <small className="ws-muted">A step can still be handed in after its deadline. It is shown as late.</small>
      </div>
      <label className="ws-q">
        <span>Timer, in minutes</span>
        <input type="number" min={0} value={s.timeLimit ?? ""} placeholder="No timer" onChange={(e) => patch({ timeLimit: e.target.value ? Number(e.target.value) : undefined })} />
      </label>
      <div className="ws-q">
        <span>Answered in</span>
        <p className="ws-set-fixed">The sheet and the page.</p>
        <small className="ws-muted">The same answer shows in both.</small>
      </div>
    </section>
  );
}

function JournalSettings({ c }: { c: Course }) {
  const w = useWorkspace();
  return (
    <section aria-label="Shared journal">
      <h2 className="ws-h2">Shared journal</h2>
      <fieldset className="ws-q">
        <legend>Who can read journal entries</legend>
        {VIS.map((v) => (
          <label key={v.id} className="ws-check ws-set-opt">
            <input type="radio" name="ws-vis" checked={c.journals === v.id} onChange={() => w.updateCourse({ journals: v.id })} />
            <span><strong>{v.label}</strong><br /><span className="ws-muted">{v.line}</span></span>
          </label>
        ))}
      </fieldset>
      <label className="ws-q">
        <span>Who may comment</span>
        <select className="ws-select" value={c.journalComments} onChange={(e) => w.updateCourse({ journalComments: e.target.value as Course["journalComments"] })}>
          <option value="guide">The guide</option>
          <option value="everyone">Everyone</option>
        </select>
      </label>
      <p className="ws-muted">Applies to entries made from now on. Earlier entries stay as they were unless each person opts in.</p>
    </section>
  );
}

function EmailSettings({ c }: { c: Course }) {
  const w = useWorkspace();
  const set = (patch: Partial<Course["emails"]>) => w.updateCourse({ emails: { ...c.emails, ...patch } });
  return (
    <section aria-label="Emails">
      <h2 className="ws-h2">Emails {w.server ? null : <Later />}</h2>
      <p className="ws-muted">{w.server ? "Your choices are kept for later. Nothing is sent yet, and the digest stays off." : "Nothing is sent from this prototype."}</p>
      <label className="ws-q">
        <span>Who gets them</span>
        <select className="ws-select" value={c.emails.to} onChange={(e) => set({ to: e.target.value as Course["emails"]["to"] })}>
          <option value="everyone">Everyone</option>
          <option value="guide">Only the guide</option>
          <option value="nobody">Nobody</option>
        </select>
      </label>
      <label className="ws-q">
        <span>When</span>
        <select className="ws-select" value={c.emails.when} onChange={(e) => set({ when: e.target.value as Course["emails"]["when"] })}>
          <option value="each">Each post</option>
          <option value="digest">A weekly digest of who responded and with what</option>
        </select>
      </label>
      <label className="ws-check">
        <input type="checkbox" checked={c.emails.remind} onChange={(e) => set({ remind: e.target.checked })} />
        A reminder before an interval closes
      </label>
    </section>
  );
}

function CallSettings({ c }: { c: Course }) {
  const w = useWorkspace();
  return (
    <section aria-label="Call link">
      <h2 className="ws-h2">Call link</h2>
      <label className="ws-q">
        <span>Paste a link (Zoom or other)</span>
        <input type="url" value={c.callLink ?? ""} placeholder="https://" onChange={(e) => w.updateCourse({ callLink: e.target.value })} />
      </label>
      <p className="ws-muted">The video call button uses this link.</p>
      <button type="button" className="ws-btn ws-btn-small" disabled>Create a Talk room</button> <Later />
    </section>
  );
}

function PeopleSettings() {
  const w = useWorkspace();
  return (
    <section aria-label="People">
      <h2 className="ws-h2">People</h2>
      <ul className="ws-materials">
        {w.people.map((p) => (
          <li key={p.id} className="ws-material">
            <span className="ws-avatar">{p.initials}</span>
            <span className="ws-material-name">{p.name}</span>
            <span className="ws-badge">{p.role === "guide" ? "Guide" : "Participant"}</span>
          </li>
        ))}
      </ul>
      <button type="button" className="ws-btn ws-btn-small" disabled>Invite</button> <Later />
    </section>
  );
}

function Mine() {
  const w = useWorkspace();
  const c = w.course!;
  const me = w.viewer;
  const shared = c.journals === "shared";
  return (
    <>
      <section aria-label="My entries">
        <h2 className="ws-h2">My entries</h2>
        <label className="ws-check">
          <input type="checkbox" checked={me.shareJournal !== false} disabled={!shared} onChange={(e) => w.updatePerson(me.id, { shareJournal: e.target.checked })} />
          Share my entries with the group
        </label>
        <p className="ws-muted">
          {shared ? "Your entries show in the shared journal while this is on." : "This only matters when the journal is Shared. Right now it is Private."}
        </p>
      </section>
      <section aria-label="Notifications">
        <h2 className="ws-h2">Notifications</h2>
        <label className="ws-check"><input type="checkbox" disabled /> Tell me when someone posts <Later /></label>
        <label className="ws-check"><input type="checkbox" disabled /> Remind me before a step is due <Later /></label>
      </section>
      <section aria-label="Profile">
        <h2 className="ws-h2">Profile</h2>
        <button type="button" className="ws-btn" onClick={() => w.setSheet("profile")}>Open my profile in the sheet</button>
      </section>
    </>
  );
}
