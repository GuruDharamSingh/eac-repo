"use client";

import * as React from "react";
import { canSee, useWorkspace } from "../store";
import type { Entry } from "../types";
import { EntryCard } from "./EntryCard";
import { downloadJournal, fmtDate, groupByModule, hasGuideComment, kindLabel, mayComment, printJournal, stepTitle } from "./exportJournal";
import "./journal.css";

// A local look-alike of the shared surface frame (head / rail / body / foot): the real
// SurfaceFrame needs SurfaceProvider, connectors, the URL stack and the eac-surface css.

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function JournalFrame() {
  const ws = useWorkspace();
  const { course, viewer, people, entries, mode } = ws;
  const frameRef = React.useRef<HTMLDivElement>(null);
  const popRef = React.useRef<HTMLDivElement>(null);
  const [personId, setPersonId] = React.useState<string | null>(null);
  const [read, setRead] = React.useState<Set<string>>(() => new Set());
  const [view, setView] = React.useState<"feed" | "person">("feed");
  const [media, setMedia] = React.useState<Entry | null>(null);
  const mediaRef = React.useRef<Entry | null>(null);
  mediaRef.current = media;
  const close = ws.setFrame;
  const titleId = React.useId();

  // Focus in, restore on close.
  React.useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    frameRef.current?.querySelector<HTMLElement>(".ws-j-close")?.focus();
    return () => {
      prev?.focus?.();
    };
  }, []);

  // Esc and a Tab trap. The pop-up closes first.
  React.useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        ev.preventDefault();
        ev.stopPropagation();
        if (mediaRef.current) setMedia(null);
        else close(null);
        return;
      }
      if (ev.key !== "Tab") return;
      const scope = mediaRef.current ? popRef.current : frameRef.current;
      if (!scope) return;
      const items = Array.from(scope.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null);
      if (items.length === 0) return;
      const a = document.activeElement as HTMLElement | null;
      if (!a || !scope.contains(a)) {
        ev.preventDefault();
        items[0].focus();
      } else if (ev.shiftKey && a === items[0]) {
        ev.preventDefault();
        items[items.length - 1].focus();
      } else if (!ev.shiftKey && a === items[items.length - 1]) {
        ev.preventDefault();
        items[0].focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [close]);

  // Pop-up: focus its close button, hand focus back to what opened it.
  React.useEffect(() => {
    if (!media) return;
    const trigger = document.activeElement as HTMLElement | null;
    popRef.current?.querySelector<HTMLElement>("button")?.focus();
    return () => {
      if (trigger && document.contains(trigger)) trigger.focus();
    };
  }, [media]);

  if (!course) return null;

  const guideSide = mode === "guide" || mode === "edit";
  const shared = course.journals === "shared";
  const visible = people.filter((p) => p.role === "participant" && canSee(viewer, p, course));
  const ro = ws.readOnly;
  const showUnread = guideSide && !ro;
  const mayBrowse = guideSide || shared; // may see others: Feed and By person
  const feedMode = mayBrowse && view === "feed";
  const current = visible.find((p) => p.id === personId) ?? visible.find((p) => p.id === viewer.id) ?? visible[0];

  const entriesOf = (id: string) => entries.filter((e) => e.personId === id);
  const isUnread = (e: Entry) => showUnread && !hasGuideComment(course, e) && !read.has(e.id);
  const unreadOf = (id: string) => entriesOf(id).filter(isUnread).length;
  const totalUnread = visible.reduce((n, p) => n + unreadOf(p.id), 0);

  const currentEntries = current ? entriesOf(current.id) : [];
  const groups = groupByModule(course, currentEntries);
  const feedEntries = entries
    .filter((e) => visible.some((p) => p.id === e.personId))
    .sort((a, b) => b.at.localeCompare(a.at));
  const canComment = ro ? Boolean(ws.journalInfo?.mayComment) : mayComment(course, viewer.id);
  const currentUnread = current ? unreadOf(current.id) : 0;
  const ownJournal = current?.id === viewer.id;

  const markRead = () => {
    setRead((s) => {
      const n = new Set(s);
      (feedMode ? feedEntries : currentEntries).forEach((e) => n.add(e.id));
      return n;
    });
  };

  const feedUnread = feedEntries.filter(isUnread).length;
  const status = feedMode && showUnread
    ? feedUnread > 0 ? `${feedUnread} new ${feedUnread === 1 ? "entry" : "entries"} across the group` : "Nothing new"
    : feedMode ? `${feedEntries.length} ${feedEntries.length === 1 ? "entry" : "entries"} from ${visible.length} taking part`
    : showUnread
    ? currentUnread > 0
      ? `${currentUnread} new ${currentUnread === 1 ? "entry" : "entries"} from ${current?.name}`
      : `Nothing new from ${current?.name ?? "anyone"}`
    : visible.length > 1
      ? `${visible.length} taking part`
      : "Only you and the guide see this";

  const mediaModule = media ? course.modules.find((m) => m.id === media.moduleId)?.title : undefined;
  const mediaStep = media ? stepTitle(course, media) : undefined;

  return (
    <div className="ws-j-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close(null); }}>
      <div className="ws-j-frame" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={frameRef}>
        <header className="ws-frame__head ws-j-frame__head">
          <span className="ws-j-glyph" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 2h8v12H4zM6.5 5.5h3M6.5 8h3" /></svg>
          </span>
          <div className="ws-j-headings">
            <div className="ws-j-kicker">{shared ? "Shared journal" : "Private journals"}</div>
            <h2 className="ws-j-frame__title" id={titleId}>{course.title}</h2>
          </div>
          <div className="ws-j-grow" />
          {ro ? null : <button type="button" className="ws-j-btn" onClick={() => { ws.setFrame(null); ws.setSheet("journal"); }}>Open in the sheet</button>}
          <button type="button" className="ws-j-icon ws-j-close" aria-label="Close" onClick={() => close(null)}>
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 2l8 8M10 2l-8 8" /></svg>
          </button>
        </header>

        <div className="ws-j-frame__mid">
          {!feedMode ? <nav className="ws-frame__rail ws-j-rail" aria-label={visible.length > 1 ? "Participants" : "Journal"}>
            <ul className="ws-j-people">
              {visible.map((p) => {
                const n = entriesOf(p.id).length;
                const u = unreadOf(p.id);
                return (
                  <li key={p.id}>
                    <button type="button" className={`ws-j-person${current?.id === p.id ? " is-on" : ""}`} aria-current={current?.id === p.id ? "true" : undefined} onClick={() => setPersonId(p.id)}>
                      <span className="ws-j-person__name">{p.id === viewer.id && !guideSide ? `${p.name} (you)` : p.name}</span>
                      {u > 0 ? (
                        <span className="ws-j-badge is-accent" aria-label={`${u} unread of ${n}`}>{u}</span>
                      ) : n === 0 ? (
                        <span className="ws-j-person__note">nothing yet</span>
                      ) : showUnread ? (
                        <span className="ws-j-person__note">read</span>
                      ) : (
                        <span className="ws-j-badge" aria-label={`${n} entries`}>{n}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="ws-j-rail__foot">
              {visible.length} taking part{showUnread ? ` · ${totalUnread} unread ${totalUnread === 1 ? "entry" : "entries"}` : ""}
            </div>
          </nav> : null}

          <div className="ws-frame__body ws-j-frame__body">
            {ro && ws.journalInfo?.loading ? <div className="ws-j-empty" role="status">Opening the journal…</div> : null}
            {ro && ws.journalInfo?.error ? <div className="ws-j-empty" role="alert">{ws.journalInfo.error}</div> : null}
            {mayBrowse ? (
              <div className="ws-j-views" role="group" aria-label="View the journal">
                <button type="button" className={`ws-j-chip${view === "feed" ? " is-on" : ""}`} aria-pressed={view === "feed"} onClick={() => setView("feed")}>Feed</button>
                <button type="button" className={`ws-j-chip${view === "person" ? " is-on" : ""}`} aria-pressed={view === "person"} onClick={() => setView("person")}>By person</button>
              </div>
            ) : null}
            {feedMode ? (
              <>
                {ro ? <p className="ws-j-hint">Entries people chose to share with the group, newest first. Anything marked Only me stays with the person who wrote it.</p> : <p className="ws-j-hint">Everyone&apos;s entries together, newest first. The journal holds everything: reflections, practice logs, photos, recordings, notes and quiz answers.</p>}
                {feedEntries.length === 0 ? (
                  <div className="ws-j-empty">Nothing in the journal yet. Reflections, practice logs, photos, recordings, notes and quiz answers from the steps all gather here.</div>
                ) : feedEntries.map((e) => {
                  const who = people.find((p) => p.id === e.personId);
                  return (
                    <section key={e.id} className="ws-j-group" aria-label={`Entry by ${who?.name ?? "someone"}`}>
                      <h3 className="ws-j-group__title">
                        <button type="button" className="ws-j-namebtn" onClick={() => { setPersonId(e.personId); setView("person"); }}>{who?.name ?? "Someone"}</button>
                      </h3>
                      <EntryCard
                        entry={e}
                        course={course}
                        people={people}
                        isNew={isUnread(e)}
                        canComment={canComment}
                        commentLabel={e.personId === viewer.id ? "Reply" : "Your comment"}
                        placeholder={`Write to ${(who?.name ?? "them").split(" ")[0]}…`}
                        onOpenMedia={setMedia}
                      />
                    </section>
                  );
                })}
              </>
            ) : current ? (
              <>
                <div className="ws-j-who">
                  <div className="ws-j-who__name">{current.name}</div>
                  <div className="ws-j-count">
                    {currentEntries.length} {currentEntries.length === 1 ? "entry" : "entries"}
                    {showUnread && currentUnread > 0 ? ` · ${currentUnread} new` : ""}
                  </div>
                </div>
                {ro ? <p className="ws-j-hint">Entries people chose to share, newest first. Anything marked Only me stays with the person who wrote it.</p> : <p className="ws-j-hint">The journal holds everything: reflections, practice logs, photos, recordings, notes and quiz answers.</p>}
                {currentEntries.length === 0 ? (
                  <div className="ws-j-empty">Nothing in {ownJournal ? "your" : `${current.name}'s`} journal yet. Reflections, practice logs, photos, recordings, notes and quiz answers from the steps all gather here.</div>
                ) : (
                  groups.map((g) => (
                    <section key={g.id} className="ws-j-group" aria-label={g.title}>
                      <h3 className="ws-j-group__title">{g.title}</h3>
                      {g.entries.map((e) => (
                        <EntryCard
                          key={e.id}
                          entry={e}
                          course={course}
                          people={people}
                          isNew={isUnread(e)}
                          canComment={canComment}
                          commentLabel={ownJournal ? "Reply" : "Your comment"}
                          placeholder={ownJournal ? "Write back…" : `Write to ${current.name.split(" ")[0]}…`}
                          onOpenMedia={setMedia}
                        />
                      ))}
                    </section>
                  ))
                )}
              </>
            ) : (
              <div className="ws-j-empty">No journals to show.</div>
            )}
          </div>
        </div>

        <footer className="ws-frame__foot ws-j-frame__foot">
          <div className="ws-j-status" role="status">{status}</div>
          {guideSide && !ro ? (
            <fieldset className="ws-j-vis">
              <legend>Journals are</legend>
              {(["private", "shared"] as const).map((v) => (
                <label key={v} className={`ws-j-vis__opt${course.journals === v ? " is-on" : ""}`}>
                  <input type="radio" name="ws-j-vis" value={v} checked={course.journals === v} onChange={() => ws.updateCourse({ journals: v })} />
                  <span>{v === "private" ? "Private" : "Shared"}</span>
                </label>
              ))}
            </fieldset>
          ) : null}
          {guideSide && !ro ? <span className="ws-j-hint">Applies to entries made from now on.</span> : null}
          {guideSide && !ro ? <button type="button" className="ws-j-btn" onClick={() => { ws.setFrame(null); ws.select("settings"); }}>Journal settings</button> : null}
          <div className="ws-j-grow" />
          {showUnread ? <button type="button" className="ws-j-btn" onClick={markRead} disabled={currentUnread === 0}>Mark as read</button> : null}
          {ro ? (
            ws.canDo ? <button type="button" className="ws-j-btn" onClick={() => { if (window.confirm("Make everything you wrote in this workspace private? Others will no longer see it.")) void ws.makeMinePrivate(); }}>Make everything I wrote private</button> : null
          ) : <>
          <button type="button" className="ws-j-btn" onClick={() => (feedMode ? printJournal(course, people, entries, visible.map((p) => p.id)) : current && printJournal(course, people, entries, [current.id]))} disabled={!current && !feedMode}>Print</button>
          <button type="button" className={`ws-j-btn${visible.length > 1 ? "" : " is-accent"}`} onClick={() => current && downloadJournal(course, people, entries, [current.id], current.name)} disabled={!current}>Export this journal</button>
          {visible.length > 1 ? (
            <button type="button" className="ws-j-btn is-accent" onClick={() => downloadJournal(course, people, entries, visible.map((p) => p.id), "all-journals")}>Export all</button>
          ) : null}
          </>}
        </footer>
      </div>

      {media ? (
        <div className="ws-j-popwrap" onMouseDown={(e) => { if (e.target === e.currentTarget) setMedia(null); }}>
          <div className="ws-j-pop" role="dialog" aria-modal="true" aria-label={`${kindLabel(media)}, enlarged`} ref={popRef}>
            <div className="ws-j-row">
              <div className="ws-j-hint">{kindLabel(media)}</div>
              <div className="ws-j-grow" />
              <button type="button" className="ws-j-icon" aria-label="Close preview" onClick={() => setMedia(null)}>
                <svg aria-hidden="true" width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 2l8 8M10 2l-8 8" /></svg>
              </button>
            </div>
            <div className="ws-j-pop__media">[{media.mediaLabel ?? kindLabel(media)}, enlarged]</div>
            {media.text ? <div>{media.text}</div> : null}
            <div className="ws-j-hint">
              {people.find((p) => p.id === media.personId)?.name ?? "Someone"} · {fmtDate(media.at)}
              {mediaStep ? ` · ${mediaStep}` : ""}
              {mediaModule ? ` · ${mediaModule}` : ""}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default JournalFrame;
