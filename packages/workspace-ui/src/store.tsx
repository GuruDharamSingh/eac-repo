"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Comment, Course, DoingData, Entry, EntryVisibility, JournalInfo, ServerTools, IntervalPlan, Message, Mode, Module, Ongoing, Person, Step, StepKind } from "./types";
import { PEOPLE, SAMPLE_COURSE, SAMPLE_DONE, SAMPLE_ENTRIES, SAMPLE_MESSAGES, SAMPLE_NOW, blankModule, buildCourse } from "./sample";

export interface WorkspaceApi {
  course: Course | null;
  people: Person[]; viewer: Person;
  /** True on the server-data mount (Sophia, slice 1): nothing can be changed, so no editing controls are drawn. */
  readOnly: boolean;
  /** Set by the server-backed provider (Sophia); null in the local prototype. */
  server: ServerTools | null;
  /** A seated participant may do steps (slice 3a): tick, reflect, log practice. Staff and visitors cannot. */
  canDo: boolean;
  /** Unlock state and the visibility choices, when canDo. */
  doing: Pick<DoingData, "access" | "visChoices" | "defaultVisibility"> | null;
  mode: Mode; setMode(m: Mode): void;
  selected: string; // "overview" | "settings" | module id
  select(id: string): void;
  createCourse(a: { title: string; line: string; when: string; where: Course["where"]; sessions: number; ongoing?: boolean }): void;
  useSample(): void; reset(): void;
  updateCourse(patch: Partial<Course>): void;
  addModule(): void; updateModule(id: string, patch: Partial<Module>): void; removeModule(id: string): void;
  addStep(moduleId: string, kind: StepKind): string;
  updateStep(moduleId: string, stepId: string, patch: Partial<Step>): void;
  removeStep(moduleId: string, stepId: string): void;
  moveStep(moduleId: string, stepId: string, dir: -1 | 1): void;
  done: Record<string, string[]>;
  completeStep(stepId: string): void | Promise<string | null>;
  entries: Entry[];
  addEntry(e: Omit<Entry, "id" | "at" | "comments" | "personId">): void | Promise<string | null>;
  addComment(entryId: string, text: string): void | Promise<string | null>;
  /** Server journal (slice 5): present when the viewer may read the group journal. */
  canJournal: boolean;
  journalInfo: JournalInfo | null;
  setEntryVisibility(entryId: string, v: EntryVisibility): Promise<string | null>;
  makeMinePrivate(): Promise<string | null>;
  sheet: "home" | "steps" | "journal" | "profile" | "people" | null; setSheet(s: WorkspaceApi["sheet"]): void;
  openStep: string | null; setOpenStep(id: string | null): void;
  updatePerson(id: string, patch: Partial<Person>): void;
  messages: Message[]; sendMessage(text: string): void;
  frame: "journal" | "step" | null; setFrame(f: WorkspaceApi["frame"]): void;
  theater: boolean; setTheater(on: boolean): void;
  now: string;                                   // the prototype's fixed "today"
  interval: string | null; setInterval(key: string | null): void;   // interval open in an ongoing session (null = current)
  setModuleKind(id: string, kind: "standard" | "ongoing"): void;
  updateOngoing(moduleId: string, patch: Partial<Ongoing>): void;
  planInterval(moduleId: string, key: string, patch: Partial<IntervalPlan>): void;
  /** Settings deep link: which section (and session or step) the Settings pane shows. */
  settingsFocus: { section: string; id?: string } | null;
  openSettings(section: string, id?: string): void;
}

const DAY = 86400000;
const dayNum = (iso: string) => Math.floor(Date.parse(iso.slice(0, 10) + "T00:00:00Z") / DAY);
const dayIso = (n: number) => new Date(n * DAY).toISOString().slice(0, 10);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export function intervalLabel(key: string, every: "day" | "week"): string {
  const d = new Date(Date.parse(key.slice(0, 10) + "T00:00:00Z"));
  const md = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  return every === "week" ? `Week of ${md}` : `${WEEKDAYS[d.getUTCDay()]} ${md}`;
}
const span = (o: Ongoing) => o.everyDays ?? (o.every === "week" ? 7 : 1);
/** Key of the interval that contains `now`. */
export function currentIntervalKey(o: Ongoing, now: string): string {
  const s = span(o);
  const i = Math.floor((dayNum(now) - dayNum(o.start)) / s);
  return dayIso(dayNum(o.start) + i * s);
}
/** The strip: `show` intervals with the current one in the middle. */
export function intervalsAround(o: Ongoing, now: string): { key: string; label: string; state: "past" | "current" | "future" }[] {
  const s = span(o);
  const cur = dayNum(currentIntervalKey(o, now));
  const half = Math.floor(o.show / 2);
  const out: { key: string; label: string; state: "past" | "current" | "future" }[] = [];
  for (let k = -half; k <= half; k++) {
    const n = cur + k * s;
    out.push({ key: dayIso(n), label: intervalLabel(dayIso(n), o.every), state: k < 0 ? "past" : k === 0 ? "current" : "future" });
  }
  return out;
}
/** Can entries still be made for this interval? Only the current one when entries close; past ones too when they do not. Never a future one. */
export function intervalOpen(o: Ongoing, key: string, now: string): boolean {
  const cur = dayNum(currentIntervalKey(o, now));
  const k = dayNum(key);
  if (k > cur) return false;
  return o.closes ? k === cur : true;
}

const normCourse = (c: Course): Course => {
  const j = c.journals as string;
  return {
    ...c,
    journals: j === "private" || j === undefined ? "private" : "shared",
    journalComments: c.journalComments ?? "guide",
    pacing: c.pacing ?? "open", endDate: c.endDate ?? null, join: c.join ?? "invite", callLink: c.callLink ?? "",
    emails: c.emails ?? { to: "guide", when: "each", remind: false },
  };
};

interface Persisted {
  course: Course | null; people: Person[]; mode: Mode; selected: string;
  done: Record<string, string[]>; entries: Entry[]; messages: Message[];
}

const KEY = "dev-workspace:v3";
const OLD_KEY = "dev-workspace:v2";
const EMPTY: Persisted = { course: null, people: PEOPLE, mode: "edit", selected: "overview", done: {}, entries: [], messages: [] };
const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 9)}`;

/** True if the viewer may see this person's journal entries. Pass the course so its visibility counts. */
export function canSee(viewer: Person, person: Person, course?: Course | null): boolean {
  if (viewer.id === person.id || viewer.role === "guide") return true;
  const j = course?.journals ?? "private";
  return j === "shared" && person.shareJournal !== false;
}

export const WorkspaceCtx = createContext<WorkspaceApi | null>(null);

export function LocalWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [s, setS] = useState<Persisted>(EMPTY);
  const [sheet, setSheetS] = useState<WorkspaceApi["sheet"]>("home");
  const [openStep, setOpenStepS] = useState<string | null>(null);
  const [frame, setFrameS] = useState<WorkspaceApi["frame"]>(null);
  const [theater, setTheaterS] = useState(false);
  const [interval, setIntervalS] = useState<string | null>(null);
  const [settingsFocus, setSettingsFocus] = useState<{ section: string; id?: string } | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY) ?? window.localStorage.getItem(OLD_KEY);
      if (raw) {
        const p = { ...EMPTY, ...(JSON.parse(raw) as Persisted) };
        setS(p.course ? { ...p, course: normCourse(p.course) } : p);
      }
    } catch { /* storage unavailable: render without it */ }
    loaded.current = true;
  }, []);
  useEffect(() => {
    if (!loaded.current) return;
    try { window.localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
  }, [s]);

  const guide = s.people.find((p) => p.role === "guide") ?? s.people[0];
  const participant = s.people.find((p) => p.role === "participant") ?? guide;
  const viewer = s.mode === "participant" ? participant : guide;

  const patchCourse = useCallback((fn: (c: Course) => Course) => {
    setS((p) => (p.course ? { ...p, course: fn(p.course) } : p));
  }, []);
  const mapModule = useCallback((id: string, fn: (m: Module) => Module) => {
    patchCourse((c) => ({ ...c, modules: c.modules.map((m) => (m.id === id ? fn(m) : m)) }));
  }, [patchCourse]);

  const api = useMemo<WorkspaceApi>(() => ({
    course: s.course, people: s.people, viewer,
    readOnly: false, server: null, canDo: false, doing: null,
    canJournal: false, journalInfo: null, setEntryVisibility: async () => null, makeMinePrivate: async () => null,
    mode: s.mode, setMode: (mode) => { setSheetS("home"); setOpenStepS(null); setFrameS(null); setTheaterS(false); setS((p) => ({ ...p, mode })); },
    selected: s.selected, select: (selected) => { setTheaterS(false); setOpenStepS(null); setIntervalS(null); if (selected !== "settings") setSettingsFocus(null); setS((p) => ({ ...p, selected })); },
    createCourse: (a) => setS((p) => ({ ...p, course: buildCourse(a, p.people), selected: "overview", mode: "edit", done: {}, entries: [], messages: [] })),
    useSample: () => setS((p) => ({ ...p, course: SAMPLE_COURSE(), people: PEOPLE, selected: "overview", done: SAMPLE_DONE(), entries: SAMPLE_ENTRIES(), messages: SAMPLE_MESSAGES() })),
    reset: () => { setIntervalS(null); setSettingsFocus(null); setSheetS("home"); setOpenStepS(null); setFrameS(null); setTheaterS(false); setS({ ...EMPTY }); },
    updateCourse: (patch) => patchCourse((c) => ({ ...c, ...patch })),
    addModule: () => setS((p) => {
      if (!p.course) return p;
      const m = blankModule(p.course.modules.length);
      return { ...p, course: { ...p.course, modules: [...p.course.modules, m] }, selected: m.id };
    }),
    updateModule: (id, patch) => mapModule(id, (m) => ({ ...m, ...patch })),
    removeModule: (id) => setS((p) => p.course
      ? { ...p, course: { ...p.course, modules: p.course.modules.filter((m) => m.id !== id) }, selected: p.selected === id ? "overview" : p.selected }
      : p),
    addStep: (moduleId, kind) => {
      const id = uid("st");
      mapModule(moduleId, (m) => ({ ...m, steps: [...m.steps, { id, kind, title: "New " + kind + " step" }] }));
      return id;
    },
    updateStep: (moduleId, stepId, patch) => mapModule(moduleId, (m) => ({ ...m, steps: m.steps.map((st) => (st.id === stepId ? { ...st, ...patch } : st)) })),
    removeStep: (moduleId, stepId) => mapModule(moduleId, (m) => ({ ...m, steps: m.steps.filter((st) => st.id !== stepId) })),
    moveStep: (moduleId, stepId, dir) => mapModule(moduleId, (m) => {
      const i = m.steps.findIndex((st) => st.id === stepId); const j = i + dir;
      if (i < 0 || j < 0 || j >= m.steps.length) return m;
      const steps = m.steps.slice(); [steps[i], steps[j]] = [steps[j], steps[i]];
      return { ...m, steps };
    }),
    done: s.done,
    completeStep: (stepId) => setS((p) => {
      const cur = p.done[viewer.id] ?? [];
      return cur.includes(stepId) ? p : { ...p, done: { ...p.done, [viewer.id]: [...cur, stepId] } };
    }),
    entries: s.entries,
    addEntry: (e) => setS((p) => {
      const now = SAMPLE_NOW.slice(0, 10) + new Date().toISOString().slice(10); // the prototype day, the real time of day
      // One entry per person per interval: a second save changes the first one in place.
      const old = e.intervalKey ? p.entries.find((x) => x.personId === viewer.id && x.moduleId === e.moduleId && x.intervalKey === e.intervalKey) : undefined;
      if (old) return { ...p, entries: p.entries.map((x) => (x.id === old.id ? { ...x, ...e, editedAt: now } : x)) };
      return { ...p, entries: [...p.entries, { ...e, id: uid("en"), personId: viewer.id, at: now, comments: [] }] };
    }),
    addComment: (entryId, text) => setS((p) => ({
      ...p,
      entries: p.entries.map((en) => en.id === entryId
        ? { ...en, comments: [...en.comments, { id: uid("cm"), by: viewer.id, at: new Date().toISOString(), text } as Comment] }
        : en),
    })),
    updatePerson: (id, patch) => setS((p) => ({ ...p, people: p.people.map((q) => (q.id === id ? { ...q, ...patch } : q)) })),
    messages: s.messages,
    sendMessage: (text) => { const t = text.trim(); if (!t) return; setS((p) => ({ ...p, messages: [...p.messages, { id: uid("msg"), by: viewer.id, at: new Date().toISOString(), text: t }] })); },
    openStep, setOpenStep: setOpenStepS,
    sheet, setSheet: setSheetS, frame, setFrame: setFrameS, theater, setTheater: setTheaterS,
    now: SAMPLE_NOW, interval, setInterval: setIntervalS,
    setModuleKind: (id, kind) => mapModule(id, (m) => {
      if (kind === "standard") return { ...m, kind: "standard" };
      if (m.ongoing) return { ...m, kind: "ongoing" };
      const first = m.steps[0];
      const step: Step = first ?? { id: uid("st"), kind: "reflection", title: "Daily entry", prompt: "What did you do today, and what did you notice?" };
      return {
        ...m, kind: "ongoing", steps: first ? m.steps : [step],
        ongoing: { stepId: step.id, every: "day", start: SAMPLE_NOW.slice(0, 10), closes: true, show: 5, plans: [] },
      };
    }),
    updateOngoing: (moduleId, patch) => mapModule(moduleId, (m) => (m.ongoing ? { ...m, ongoing: { ...m.ongoing, ...patch } } : m)),
    planInterval: (moduleId, key, patch) => mapModule(moduleId, (m) => {
      if (!m.ongoing) return m;
      const plans = m.ongoing.plans.some((p) => p.key === key)
        ? m.ongoing.plans.map((p) => (p.key === key ? { ...p, ...patch, key } : p))
        : [...m.ongoing.plans, { materials: [], ...patch, key } as IntervalPlan];
      return { ...m, ongoing: { ...m.ongoing, plans } };
    }),
    settingsFocus,
    openSettings: (section, id) => { setSettingsFocus({ section, id }); setTheaterS(false); setOpenStepS(null); setS((p) => ({ ...p, selected: "settings" })); },
  }), [s, viewer, sheet, openStep, frame, theater, interval, settingsFocus, patchCourse, mapModule]);

  return <WorkspaceCtx.Provider value={api}>{children}</WorkspaceCtx.Provider>;
}

export function useWorkspace(): WorkspaceApi {
  const v = useContext(WorkspaceCtx);
  if (!v) throw new Error("useWorkspace outside WorkspaceProvider");
  return v;
}

/** The name the development mount has always used. */
export const WorkspaceProvider = LocalWorkspaceProvider;
