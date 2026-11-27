"use client";

import { canSee, useWorkspace } from "../store";
import type { Entry, Module } from "../types";
import { EntryCard } from "../journal/EntryCard";
import { mayComment } from "../journal/exportJournal";
import { fmtTime } from "./util";
import { Frame } from "../Frame";
import "./ongoing.css";

/** Latest entry per person for one interval. */
export function latestPerPerson(list: Entry[]): Entry[] {
  const by = new Map<string, Entry>();
  [...list].sort((a, b) => a.at.localeCompare(b.at)).forEach((e) => by.set(e.personId, e));
  return [...by.values()].sort((a, b) => b.at.localeCompare(a.at));
}

/** Everyone's entries for this interval whom the viewer may see. */
export function IntervalFeed({ m, intervalKey, onPerson }: { m: Module; intervalKey: string; onPerson: (id: string) => void }) {
  const { course, viewer, people, entries } = useWorkspace();
  if (!course) return null;
  const all = latestPerPerson(entries.filter((e) => e.moduleId === m.id && e.intervalKey === intervalKey));
  const shown = all.filter((e) => { const p = people.find((x) => x.id === e.personId); return p ? canSee(viewer, p, course) : false; });
  const hidden = all.length - shown.length;
  const mine = entries.some((e) => e.personId === viewer.id && e.moduleId === m.id && e.intervalKey === intervalKey);
  const readingFirst = viewer.role === "participant" && !mine && !!m.ongoing?.readFirst;
  const comment = mayComment(course, viewer.id);
  return (
    <Frame title="Everyone's entries" className="ws-ong-feedframe" label="Entries for this interval">
      {readingFirst ? <p className="ws-ong-muted">You can read these before entering your own.</p> : null}
      {shown.length === 0 ? <p className="ws-ong-muted">Nobody has entered this interval yet.</p> : (
        <ul className="ws-ong-feed">
          {shown.map((e) => {
            const p = people.find((x) => x.id === e.personId);
            const own = e.personId === viewer.id;
            return (
              <li key={e.id} className={`ws-ong-feeditem${own ? " is-mine" : ""}`}>
                <div className="ws-ong-who">
                  <button type="button" className="ws-ong-name" onClick={() => onPerson(e.personId)} aria-label={`All entries by ${p?.name ?? "this person"}`}>
                    {p?.name ?? "Someone"}{own ? " (you)" : ""}
                  </button>
                  <span className="ws-ong-muted">{fmtTime(e.at)}</span>
                </div>
                <EntryCard entry={e} course={course} people={people} canComment={comment} commentLabel={own ? "Reply" : "Your comment"} />
              </li>
            );
          })}
        </ul>
      )}
      {hidden > 0 ? <p className="ws-ong-muted">{hidden} {hidden === 1 ? "other entry is" : "other entries are"} private. In a Private journal you see your own and the guide&apos;s replies.</p> : null}
    </Frame>
  );
}
