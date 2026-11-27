"use client";

import * as React from "react";
import { useWorkspace } from "../store";
import { EntryCard } from "./EntryCard";
import { downloadJournal, groupByModule, mayComment, printJournal, visibilityLine } from "./exportJournal";
import "./journal.css";

/** "My journal": the viewer's own entries, in the sheet. */
export function JournalSheet() {
  const ws = useWorkspace();
  const { course, viewer, people, entries, selected } = ws;
  const [note, setNote] = React.useState("");
  const noteId = React.useId();

  if (!course) return null;

  const mine = entries.filter((e) => e.personId === viewer.id);
  const groups = groupByModule(course, mine);
  const noteModule = selected !== "overview" ? course.modules.find((m) => m.id === selected) : course.modules[0];

  const addNote = (ev: React.FormEvent) => {
    ev.preventDefault();
    const t = note.trim();
    if (!t || !noteModule) return;
    ws.addEntry({ kind: "note", moduleId: noteModule.id, text: t });
    setNote("");
  };

  return (
    <aside className="ws-j-sheet" aria-label="My journal">
      <div className="ws-j-sheet__head">
        <div className="ws-j-row">
          <button type="button" className="ws-j-icon" aria-label="Back to the overview" onClick={() => ws.setSheet("home")}>
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M7.5 2L3.5 6l4 4" /></svg>
          </button>
          <div className="ws-j-title">My journal</div>
          <div className="ws-j-count">{mine.length} {mine.length === 1 ? "entry" : "entries"}</div>
          <div className="ws-j-grow" />
          <button type="button" className="ws-j-btn" onClick={() => ws.setFrame("journal")}>Open in a frame</button>
          <button type="button" className="ws-j-icon" aria-label="Close journal" onClick={() => ws.setSheet(null)}>
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 2l8 8M10 2l-8 8" /></svg>
          </button>
        </div>
        <p className="ws-j-hint">Everything you write or log in a step is here.</p>
        <div className="ws-j-row ws-j-row--wrap">
          <button type="button" className="ws-j-btn is-accent" onClick={() => downloadJournal(course, people, entries, [viewer.id], viewer.name)} disabled={mine.length === 0}>Export</button>
          <button type="button" className="ws-j-btn" onClick={() => printJournal(course, people, entries, [viewer.id])} disabled={mine.length === 0}>Print</button>
          <span className="ws-j-hint">Export as a Markdown document, or print. {visibilityLine(course)}</span>
        </div>
      </div>

      <div className="ws-j-sheet__body">
        <form className="ws-j-addnote" onSubmit={addNote}>
          <label htmlFor={noteId}>Add a note{noteModule ? ` in ${noteModule.title}` : ""}</label>
          <textarea id={noteId} rows={2} value={note} placeholder="Anything worth keeping" onChange={(e) => setNote(e.target.value)} disabled={!noteModule} />
          <div className="ws-j-row">
            <button type="submit" className="ws-j-btn" disabled={!note.trim() || !noteModule}>Add note</button>
          </div>
        </form>

        {mine.length === 0 ? (
          <div className="ws-j-empty">
            Nothing here yet. The journal holds everything: reflections, practice logs, photos, recordings, notes and quiz answers.
            What you do in a step lands here, and so does any note you add above.
          </div>
        ) : (
          groups.map((g) => (
            <section key={g.id} className="ws-j-group" aria-label={g.title}>
              <h3 className="ws-j-group__title">{g.title}</h3>
              {g.entries.map((e) => (
                <EntryCard key={e.id} entry={e} course={course} people={people} commentLabel="Reply" canComment={mayComment(course, viewer.id)} />
              ))}
            </section>
          ))
        )}
      </div>
    </aside>
  );
}

export default JournalSheet;
