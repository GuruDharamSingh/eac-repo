"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WorkspaceCtx, type WorkspaceApi } from "./store";
import type { Course, DoingData, EditorData, Entry, EntryVisibility, IntervalPlan, JournalInfo, JournalWire, Mode, OngoingWire, Person, ServerTools } from "./types";
import { useServerEditor } from "./editor";
import { useExperiment } from "./experiment";

/** Everything the server hands the screens, as plain data (it crosses from server to client). */
export interface ServerWorkspaceData {
  course: Course | null;
  /** Guides always; the roster too when the viewer is staff. */
  people: Person[];
  viewer: Person;
  /** "guide" for staff, "participant" for a seated viewer. Never "edit": this provider cannot edit the workspace. */
  mode: Exclude<Mode, "edit">;
  /** ISO time the page was drawn. */
  now: string;
  /** Module id to open first (from the address). */
  initialModule?: string;
}

const noop = () => {};
const PRACTICE = /^(\d+) minutes?\.?\s*([\s\S]*)$/;
const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).map((x) => x[0]).slice(0, 2).join("").toUpperCase() || "?";

interface Raw { id: string; stepId: string; kind: "reflection" | "practice_log"; body: string; visibility: EntryVisibility | "public"; createdAt: string; updatedAt: string }

/** A stored response -> the screens' entry. A practice log keeps its minutes in the first words of its text. */
function toEntry(course: Course, personId: string, r: Raw, comments: Entry["comments"] = []): Entry {
  const moduleId = course.modules.find((m) => m.steps.some((s) => s.id === r.stepId))?.id ?? "";
  const vis = r.visibility === "public" ? "circle" : r.visibility;
  const edited = r.updatedAt !== r.createdAt ? { editedAt: r.updatedAt } : {};
  if (r.kind === "practice_log") {
    const m = PRACTICE.exec(r.body);
    return { id: r.id, personId, moduleId, stepId: r.stepId, kind: "practice", at: r.createdAt, minutes: m ? Number(m[1]) : undefined, text: (m ? m[2] : r.body) || undefined, visibility: vis, comments, ...edited };
  }
  return { id: r.id, personId, moduleId, stepId: r.stepId, kind: "reflection", at: r.createdAt, text: r.body, visibility: vis, comments, ...edited };
}

/**
 * The server provider. `readOnly` is always true: no editing control is drawn.
 *  - With `doing` (a seated, non-staff participant) it can do steps: complete, keep a reflection, log practice.
 *  - With `canJournal` (seated, or named on the run) it can open the group journal, which the server filters by each
 *    entry's own visibility; a participant may change who reads their own entries; guides answer, members comment.
 * All writes go to /api/workspaces/<action>, which call the engine's own functions and answer with fresh state.
 * Otherwise every write is a no-op the screens never reach.
 */
export function ServerWorkspaceProvider({ data, doing: doingIn, slug, canJournal = false, editor, experiment = false, children }: {
  data: ServerWorkspaceData; doing?: DoingData | null; slug?: string; canJournal?: boolean; editor?: EditorData; experiment?: boolean; children: React.ReactNode;
}) {
  const [selected, setSelected] = useState<string>(
    data.initialModule && data.course?.modules.some((m) => m.id === data.initialModule) ? data.initialModule : "overview",
  );
  const [sheet, setSheetState] = useState<WorkspaceApi["sheet"]>("home");
  const [settingsFocus, setSettingsFocus] = useState<{ section: string; id?: string } | null>(null);
  const [openStep, setOpenStep] = useState<string | null>(null);
  const [frame, setFrameState] = useState<WorkspaceApi["frame"]>(null);
  const [interval, setIntervalKey] = useState<string | null>(null);
  const [doing, setDoing] = useState<DoingData | null>(doingIn ?? null);
  const [journal, setJournal] = useState<JournalWire | null>(null);
  const [jState, setJState] = useState<{ loading: boolean; error: string | null }>({ loading: false, error: null });

  const call = useCallback(async (action: string, body: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/workspaces/${action}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ course: slug, ...body }) });
      return (await res.json()) as { ok: boolean; error?: string; doing?: DoingData; journal?: JournalWire };
    } catch {
      return { ok: false, error: "That did not save. Check your connection and try again." };
    }
  }, [slug]);

  const post = useCallback(async (action: string, body: Record<string, unknown>): Promise<string | null> => {
    const j = await call(action, body);
    if (!j.ok || !j.doing) return j.error ?? "That did not save. Try again.";
    setDoing(j.doing);
    return null;
  }, [call]);

  /** Journal writes answer with the fresh journal. */
  const postJournal = useCallback(async (action: string, body: Record<string, unknown>): Promise<string | null> => {
    const j = await call(action, body);
    if (!j.ok || !j.journal) return j.error ?? "That did not save. Try again.";
    setJournal(j.journal);
    // A visibility change moves the entry in or out of reach: refresh the doing state too.
    if (action === "visibility" || action === "private-all") {
      const d = await call("state", {});
      if (d.ok && d.doing) setDoing(d.doing);
    }
    return null;
  }, [call]);

  const loadJournal = useCallback(async () => {
    setJState({ loading: true, error: null });
    const j = await call("journal", {});
    if (j.ok && j.journal) { setJournal(j.journal); setJState({ loading: false, error: null }); }
    else setJState({ loading: false, error: j.error ?? "The journal could not be opened." });
  }, [call]);

  const viewerId = data.viewer.id;

  // Ongoing sessions (slice 4a): the reader's own clock and zone, and each ongoing module's data, loaded when it is opened.
  const [tz, setTz] = useState<string | null>(null);
  const [clock, setClock] = useState<string>(data.now);
  const [ongoing, setOngoing] = useState<Record<string, OngoingWire>>({});
  const ongoingRef0 = useRef(ongoing);
  ongoingRef0.current = ongoing;
  useEffect(() => {
    const z = browserTz();
    setTz(z);
    const tick = () => setClock(localNowIso(z));
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);
  const selectedMod = data.course?.modules.find((m) => m.id === selected);
  const selectedOngoing = selectedMod?.kind === "ongoing" ? selectedMod.id : null;
  const loadOngoing = useCallback(async (moduleId: string) => {
    try {
      const res = await fetch("/api/workspaces/ongoing", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ course: slug, module: moduleId, tz }) });
      const j = (await res.json()) as { ok: boolean; ongoing?: OngoingWire };
      if (j.ok && j.ongoing) setOngoing((o) => ({ ...o, [moduleId]: j.ongoing! }));
    } catch { /* the screens still draw from what they have */ }
  }, [slug, tz]);
  const ed = useServerEditor({ slug, editor, ongoing, setOngoing, loadOngoing });
  const exp = useExperiment(slug, experiment);
  // Which ongoing modules to load: the open one; and, while editing, every ongoing module (the planner needs its days).
  const editingNow = ed.editing;
  const ongoingIds = (editingNow ? (ed.draft?.modules ?? []).filter((m) => m.kind === "ongoing").map((m) => m.id) : selectedOngoing ? [selectedOngoing] : []).join(",");
  useEffect(() => { if (tz === null) return; for (const id of ongoingIds.split(",").filter(Boolean)) if (editingNow || !ongoingRef0.current[id]) void loadOngoing(id); }, [ongoingIds, tz, loadOngoing, editingNow]); // eslint-disable-line react-hooks/exhaustive-deps

  // The course, with each ongoing module's plans and counts from the server.
  const course = useMemo<Course | null>(() => {
    const c = ed.editing || ed.viewSettings ? ed.draft : data.course;
    if (!c) return c;
    return {
      ...c,
      modules: c.modules.map((m) => {
        const w = ongoing[m.id];
        if (m.kind !== "ongoing" || !m.ongoing || !w) return m;
        const plans: IntervalPlan[] = Object.entries(w.plans).filter(([k]) => k !== "").map(([key, p]) => ({ key, note: p.note ?? undefined, materials: p.items.map((i) => ({ id: i.id, name: i.name, access: i.access, url: i.url })) }));
        const general = w.plans[""]?.items.map((i) => ({ id: i.id, name: i.name, access: i.access, url: i.url })) ?? [];
        return { ...m, materials: general.length ? general : m.materials, ongoing: { ...m.ongoing, plans, entered: w.entered } };
      }),
    };
  }, [data.course, ed.editing, ed.viewSettings, ed.draft, ongoing]);

  // Entries: the whole group journal once it is loaded, otherwise just your own responses from the doing state; plus ongoing entries.
  const { entries, authors } = useMemo(() => {
    if (!course) return { entries: [] as Entry[], authors: [] as Person[] };
    const seen = new Map<string, Person>();
    const note = (id: string, name: string, guide: boolean) => { if (id !== "viewer" && !seen.has(id)) seen.set(id, { id, name, initials: initialsOf(name), role: guide ? "guide" : "participant" }); };
    let es: Entry[];
    if (journal) {
      es = journal.entries.map((e) => {
        note(e.authorKey, e.authorName, e.authorIsGuide);
        const comments = e.comments.map((c) => { note(c.by, c.byName, c.byGuide); return { id: c.id, by: c.by === "viewer" ? viewerId : c.by, at: c.createdAt, text: c.body }; });
        return toEntry(course, e.mine ? viewerId : e.authorKey, e, comments);
      });
    } else {
      es = doing ? doing.responses.map((r) => toEntry(course, viewerId, r)) : [];
    }
    // Ongoing entries win over a journal copy of the same entry (they carry the interval).
    const ong: Entry[] = [];
    for (const [moduleId, w] of Object.entries(ongoing)) {
      const stepId = course.modules.find((m) => m.id === moduleId)?.ongoing?.stepId ?? "";
      for (const e of w.entries) {
        note(e.authorKey, e.authorName, e.authorIsGuide);
        e.comments.forEach((c) => note(c.by, c.byName, c.byGuide));
        ong.push(ongoingEntry(moduleId, stepId, viewerId, e));
      }
    }
    const ids = new Set(ong.map((e) => e.id));
    return { entries: [...es.filter((e) => !ids.has(e.id)), ...ong], authors: [...seen.values()] };
  }, [course, journal, doing, ongoing, viewerId]);

  const people = useMemo(() => {
    const base = ed.editing ? ed.people : data.people;
    const have = new Set(base.map((p) => p.id));
    const extra = authors.filter((a) => !have.has(a.id));
    // A participant reads the group journal as one of its people.
    // A participant, and a guide who takes part, read the group journal as one of its people (their own entries carry the "viewer" id).
    const me = (data.mode === "participant" || Boolean(doing)) && canJournal && !have.has(viewerId) ? [data.viewer] : [];
    return [...base, ...me, ...extra];
  }, [data.people, ed.editing, ed.people, data.mode, data.viewer, authors, canJournal, viewerId, doing]);

  const info: JournalInfo | null = canJournal
    ? { commentsMode: journal?.commentsMode ?? "guide", isGuide: journal?.isGuide ?? data.mode === "guide", loading: jState.loading, error: jState.error, loaded: Boolean(journal),
        mayComment: journal ? journal.commentsMode === "everyone" || journal.isGuide : false }
    : null;

  const api = useMemo<WorkspaceApi>(() => ({
    course, people, viewer: data.viewer,
    readOnly: !ed.editing, canDo: Boolean(doing) && !ed.editing,
    server: { canEdit: ed.canEdit, canViewSettings: ed.canEdit || ed.viewSettings, experiment: exp, save: ed.save, publish: ed.publish, adopt: ed.adopt, ...ed.tools },
    doing: doing && !ed.editing ? { access: doing.access, visChoices: doing.visChoices, defaultVisibility: doing.defaultVisibility } : null,
    canJournal, journalInfo: info,
    setEntryVisibility: (id, v) => postJournal("visibility", { step: id, visibility: v }),
    makeMinePrivate: () => postJournal("private-all", {}),
    mode: ed.editing ? "edit" : data.mode,
    setMode: (m) => { setSheetState("home"); setOpenStep(null); setFrameState(null); setSelected("overview"); setSettingsFocus(null); if (ed.canEdit) ed.setEditing(m === "edit"); },
    selected, select: (id) => { setOpenStep(null); setIntervalKey(null); if (id !== "settings") setSettingsFocus(null); setSelected(id === "settings" && !ed.editing && !ed.viewSettings ? "overview" : id); },
    createCourse: noop, useSample: noop, reset: noop,
    ...ed.ops,



    done: doing ? { [viewerId]: doing.done } : {},
    completeStep: (stepId) => (doing ? post("complete", { step: stepId }) : undefined),
    entries,
    addEntry: (e) => {
      if (e.intervalKey) {
        // An entry for an ongoing session's interval: the server files it under the writer's own day and refuses a closed one.
        const moduleId = e.moduleId;
        return (async () => {
          try {
            const res = await fetch("/api/workspaces/ongoing-save", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ course: slug, module: moduleId, body: e.text ?? "", minutes: e.kind === "practice" ? e.minutes : undefined, visibility: e.visibility, key: e.intervalKey, tz }) });
            const j = (await res.json()) as { ok: boolean; error?: string; ongoing?: OngoingWire };
            if (!j.ok || !j.ongoing) return j.error ?? "That did not save. Try again.";
            setOngoing((o) => ({ ...o, [moduleId]: j.ongoing! }));
            return null;
          } catch { return "That did not save. Check your connection and try again."; }
        })();
      }
      if (!doing || !e.stepId || (e.kind !== "reflection" && e.kind !== "practice")) return undefined;
      const body = e.kind === "practice" ? `${e.minutes ?? 0} minutes.${e.text ? ` ${e.text}` : ""}` : e.text ?? "";
      // One entry per step and kind: a second save changes the first in place.
      const kind = e.kind === "practice" ? "practice_log" : "reflection";
      const old = doing.responses.find((r) => r.stepId === e.stepId && r.kind === kind);
      return post("respond", { step: e.stepId, kind, body, visibility: e.visibility, response: old?.id }).then(async (err) => { if (!err && journal) await loadJournal(); return err; });
    },
    addComment: async (entryId, text) => {
      if (!canJournal) return null;
      const r = await postJournal("comment", { step: entryId, body: text });
      if (!r && selectedOngoing) await loadOngoing(selectedOngoing);
      return r;
    },
    sheet, setSheet: (s) => setSheetState(s === "journal" || s === "profile" ? "home" : s),
    openStep, setOpenStep,
    updatePerson: noop,
    messages: [], sendMessage: noop,
    frame, setFrame: (f) => {
      if (f === "journal" && (!canJournal || ed.editing)) return;
      setFrameState(f);
      if (f === "journal" && !journal && !jState.loading) void loadJournal();
    },
    theater: false, setTheater: noop,
    now: clock,
    interval, setInterval: setIntervalKey,

    settingsFocus, openSettings: (section, id) => { if (!ed.editing) return; setSettingsFocus({ section, id }); setOpenStep(null); setSelected("settings"); },
  }), [data, course, clock, tz, loadOngoing, exp, people, selected, sheet, openStep, frame, interval, doing, entries, post, postJournal, loadJournal, viewerId, canJournal, info, journal, jState.loading, ed, settingsFocus]);

  return <WorkspaceCtx.Provider value={api}>{children}</WorkspaceCtx.Provider>;
}

/** The browser's own zone, or null where it cannot say. */
const browserTz = (): string | null => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch { return null; } };

/** "Now" on the reader's own wall clock, written as a UTC-looking ISO string so the day arithmetic in the screens (which reads dates as UTC days) lands on the reader's local day. */
function localNowIso(tz: string | null): string {
  const d = new Date();
  try {
    const p = new Intl.DateTimeFormat("en-CA", { timeZone: tz ?? undefined, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(d);
    const g = (t: string) => p.find((x) => x.type === t)!.value;
    return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}:${g("second")}.000Z`;
  } catch {
    return d.toISOString();
  }
}
const PRACTICE_RE = /^(\d+) minutes?\.?\s*([\s\S]*)$/;

/** An ongoing entry in the screens' shape. */
function ongoingEntry(moduleId: string, stepId: string, viewerId: string, e: OngoingWire["entries"][number]): Entry {
  const vis = e.visibility === "public" ? "circle" : e.visibility;
  const edited = e.updatedAt !== e.createdAt ? { editedAt: e.updatedAt } : {};
  const comments = e.comments.map((c) => ({ id: c.id, by: c.by === "viewer" ? viewerId : c.by, at: c.createdAt, text: c.body }));
  const base = { id: e.id, personId: e.mine ? viewerId : e.authorKey, moduleId, stepId, at: e.createdAt, intervalKey: e.intervalKey, visibility: vis, comments, ...edited };
  if (e.kind === "practice_log") { const m = PRACTICE_RE.exec(e.body); return { ...base, kind: "practice", minutes: m ? Number(m[1]) : undefined, text: (m ? m[2] : e.body) || undefined }; }
  return { ...base, kind: "reflection", text: e.body };
}
