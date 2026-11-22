"use client";

import { useWorkspace } from "./store";
import { Field, readable } from "./Field";
import { Theater } from "./Theater";
import { MainSteps } from "./MainSteps";
import { PALETTE } from "./sample";
import type { Module } from "./types";

export function ModulePane() {
  const w = useWorkspace();
  const c = w.course;
  if (!c) return null;
  if (w.selected === "overview") return <OverviewPane />;
  const m = c.modules.find((x) => x.id === w.selected);
  if (!m) return <OverviewPane />;
  return <SessionPane m={m} index={c.modules.indexOf(m)} />;
}

function OverviewPane() {
  const w = useWorkspace();
  const c = w.course!;
  const edit = w.mode === "edit";
  const guide = w.people.find((p) => p.id === c.guideId);
  return (
    <main className="ws-pane">
      <div className="ws-cover ws-banner">
        <span className="ws-cover-label">[{c.bannerLabel || "banner picture"}]</span>
        {edit ? <button type="button" className="ws-chip" onClick={() => w.updateCourse({ bannerLabel: "banner picture: chosen from the library" })}>Choose picture</button> : null}
      </div>
      <Field as="h1" className="ws-title" value={c.title} editable={edit} label="title" onSave={(v) => w.updateCourse({ title: v })} />
      <Field as="p" className="ws-line" value={c.line} editable={edit} label="one line" placeholder="Say it in one line" onSave={(v) => w.updateCourse({ line: v })} />
      <div className="ws-meta">
        <span className="ws-muted">Price</span>
        <Field value={c.price} editable={edit} label="price" placeholder="Free / set a price" onSave={(v) => w.updateCourse({ price: v })} />
        <span className="ws-muted">{c.when}</span>
        <span className="ws-muted">{c.where}</span>
      </div>
      <h2 className="ws-h2">About this workshop</h2>
      <Field as="div" multiline className="ws-about" value={c.about} editable={edit} label="about" placeholder="Describe the workshop" onSave={(v) => w.updateCourse({ about: v })} />
      <div className="ws-guide">
        <span className="ws-avatar">{guide?.initials}</span>
        <span><strong>{guide?.name}</strong><br /><span className="ws-muted">Guide{edit ? " · edit on profile" : ""}</span></span>
      </div>
      {edit ? (
        <p className="ws-muted">Journal visibility is set in <button type="button" className="ws-linkbtn" onClick={() => w.select("settings")}>Settings</button>.</p>
      ) : null}
      <div className="ws-actions">
        <button type="button" className="ws-btn" onClick={() => w.setSheet("journal")}>Journal</button>
      </div>
    </main>
  );
}

function SessionPane({ m, index }: { m: Module; index: number }) {
  const w = useWorkspace();
  const edit = w.mode === "edit";
  const upd = (patch: Partial<Module>) => w.updateModule(m.id, patch);
  const { ink, ratio } = readable(m.colour);
  const style: Record<string, string> = { ["--ws-module" as string]: m.colour, ["--ws-module-ink" as string]: ink };
  const cls = `ws-pane ws-session${m.fill.pane ? " ws-fill-pane" : ""}${m.fill.title ? " ws-fill-title" : ""}${m.fill.buttons ? " ws-fill-buttons" : ""}`;

  if (w.theater && m.hasVideo) {
    return <main className={cls} style={style}><Theater m={m} /></main>;
  }
  const toggle = (k: keyof Module["fill"], label: string) => (
    <label className="ws-check" key={k}>
      <input type="checkbox" checked={m.fill[k]} onChange={(e) => upd({ fill: { ...m.fill, [k]: e.target.checked } })} />
      {label}
    </label>
  );
  return (
    <main className={cls} style={style}>
      <div className="ws-cover">
        <span className="ws-cover-label">[{m.coverLabel || "session picture"}]</span>
        {edit ? <button type="button" className="ws-chip" onClick={() => upd({ coverLabel: "session picture: chosen from the library" })}>Choose picture</button> : null}
        {m.hasVideo ? <button type="button" className="ws-theater-btn ws-btn-mod" onClick={() => w.setTheater(true)}>Open theater</button> : null}
      </div>
      <p className="ws-kicker">Module {index + 1}</p>
      <Field as="h1" className="ws-title ws-mod-title" value={m.title} editable={edit} label="module title" onSave={(v) => upd({ title: v })} />
      <div className="ws-meta">
        <Field value={m.date} editable={edit} label="date" placeholder="Date" onSave={(v) => upd({ date: v })} />
        <Field value={m.length} editable={edit} label="length" placeholder="Length" onSave={(v) => upd({ length: v })} />
      </div>
      <Field as="p" multiline className="ws-about" value={m.description} editable={edit} label="description" placeholder="What happens in this session" onSave={(v) => upd({ description: v })} />

      <h2 className="ws-h2">Materials</h2>
      {m.materials.length === 0 ? <p className="ws-muted">No materials yet.</p> : null}
      <ul className="ws-materials">
        {m.materials.map((mt) => (
          <li key={mt.id} className="ws-material">
            <span className="ws-material-name">{mt.name}</span>
            {edit ? (
              <>
                <select
                  className="ws-select" value={mt.access} aria-label={`Access for ${mt.name}`}
                  onChange={(e) => upd({ materials: m.materials.map((x) => (x.id === mt.id ? { ...x, access: e.target.value as "open" | "participants" } : x)) })}
                >
                  <option value="open">Open to everyone</option>
                  <option value="participants">Participants only</option>
                </select>
                <button type="button" className="ws-linkbtn" onClick={() => upd({ materials: m.materials.filter((x) => x.id !== mt.id) })}>Remove</button>
              </>
            ) : (
              <span className="ws-badge">{mt.access === "open" ? "Open to everyone" : "Participants only"}</span>
            )}
          </li>
        ))}
      </ul>
      {edit ? (
        <button
          type="button" className="ws-btn ws-btn-small"
          onClick={() => upd({ materials: [...m.materials, { id: `mt-${Math.random().toString(36).slice(2, 7)}`, name: `New material ${m.materials.length + 1}.pdf`, access: "participants" }] })}
        >
          + Add material
        </button>
      ) : null}

      <MainSteps m={m} />

      <div className="ws-actions">
        <button type="button" className="ws-btn" onClick={() => w.setSheet("journal")}>Journal</button>
      </div>

      {edit ? (
        <section className="ws-look" aria-label="Look">
          <h2 className="ws-h2">This module&apos;s colour</h2>
          <div className="ws-swatches">
            {PALETTE.map((p) => (
              <button key={p} type="button" className="ws-swatch" style={{ background: p }} aria-label={`Colour ${p}`} aria-pressed={m.colour === p} onClick={() => upd({ colour: p })} />
            ))}
            <input type="color" className="ws-colorpick" aria-label="Any colour" value={m.colour} onChange={(e) => upd({ colour: e.target.value })} />
          </div>
          <p className="ws-muted">Text on it: {ratio.toFixed(1)}:1{ratio < 4.5 ? " (low: pick a deeper colour)" : ""}</p>
          <h3 className="ws-h3">Use it for</h3>
          <div className="ws-toggles">
            {toggle("row", "Row")}{toggle("pane", "Pane")}{toggle("title", "Title")}{toggle("buttons", "Buttons")}
          </div>
          <label className="ws-check">
            <input type="checkbox" checked={!!m.hasVideo} onChange={(e) => upd({ hasVideo: e.target.checked })} />
            This session has a video (theater)
          </label>
          <button type="button" className="ws-linkbtn ws-danger" onClick={() => { if (window.confirm("Remove this session?")) w.removeModule(m.id); }}>Remove this session</button>
        </section>
      ) : null}
    </main>
  );
}
