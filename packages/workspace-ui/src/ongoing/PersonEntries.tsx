"use client";

import { canSee, useWorkspace } from "../store";
import type { Module, Ongoing } from "../types";
import { EntryCard } from "../journal/EntryCard";
import { mayComment } from "../journal/exportJournal";
import { fmtKey, fmtTime } from "./util";
import { Frame } from "../Frame";
import { GuideMark } from "../audience";
import "./ongoing.css";

/** All of one person's entries through this ongoing session, newest interval first. */
export function PersonEntries({ m, ongoing, personId, onBack }: { m: Module; ongoing: Ongoing; personId: string; onBack: () => void }) {
  const { course, viewer, people, entries } = useWorkspace();
  const person = people.find((p) => p.id === personId);
  if (!course || !person) return null;
  if (!canSee(viewer, person, course)) {
    return (
      <section className="ws-ong-card">
        <button type="button" className="ws-ong-back" onClick={onBack}>Back</button>
        <p className="ws-ong-muted">This journal is private.</p>
      </section>
    );
  }
  const mine = entries.filter((e) => e.moduleId === m.id && e.personId === personId);
  const keyOf = (e: { intervalKey?: string; at: string }) => e.intervalKey ?? e.at.slice(0, 10);
  const keys = [...new Set(mine.map(keyOf))].sort().reverse();
  const comment = mayComment(course, viewer.id);
  return (
    <Frame title={<>{person.name}{person.role === "guide" ? <> <GuideMark /></> : null}</>} label={`Entries by ${person.name}`}>
      <div className="ws-ong-persontop">
        <button type="button" className="ws-ong-back" onClick={onBack}>Back to the interval</button>
        <h3 className="ws-ong-h">All entries in {m.title}</h3>
        <span className="ws-ong-muted">{keys.length} {keys.length === 1 ? "interval" : "intervals"}, newest first</span>
      </div>
      {keys.length === 0 ? <p className="ws-ong-muted">No entries yet.</p> : (
        <ul className="ws-ong-feed">
          {keys.map((k) => {
            const e = mine.filter((x) => keyOf(x) === k).sort((a, b) => b.at.localeCompare(a.at))[0];
            return (
              <li key={k} className="ws-ong-feeditem">
                <div className="ws-ong-who"><strong>{fmtKey(k, ongoing.every)}</strong><span className="ws-ong-muted">{fmtTime(e.at)}</span></div>
                <EntryCard entry={e} course={course} people={people} canComment={comment} commentLabel={personId === viewer.id ? "Reply" : "Your comment"} />
              </li>
            );
          })}
        </ul>
      )}
    </Frame>
  );
}
