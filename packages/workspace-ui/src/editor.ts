"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WorkspaceApi } from "./store";
import type { Course, EditorData, InviteWire, Module, Ongoing, OngoingWire, Person, SaveState, Step, StepKind } from "./types";

// The guide's side of the server-backed provider (slice 6 + 4b): the prototype's Editing mode and Settings menu, saved to the engine.
// Field edits update the screen at once and are sent a moment later (merged, so typing does not flood the server). Structural changes
// (add, remove, move, make ongoing) are sent in order and the server's fresh draft replaces the screen's copy.

const COURSE_KEYS = ["title", "line", "about", "journals", "journalComments", "callLink", "emails", "join", "status", "endDate", "pacing"] as const;
const MODULE_KEYS = ["title", "date", "length", "colour", "coverLabel", "coverUrl", "description", "materials"] as const;
const STEP_KEYS = ["title", "prompt", "body", "required", "due", "timeLimit", "when", "where", "href", "fileName"] as const;
const ADDABLE: StepKind[] = ["reading", "practice", "reflection", "gathering", "conversation", "resource"];

const pick = (o: object, keys: readonly string[]) => Object.fromEntries(Object.entries(o).filter(([k]) => keys.includes(k)));
type Op = Record<string, unknown> & { t: string; patch?: Record<string, unknown> };
interface EditReply { ok: boolean; error?: string; data?: { course: Course | null; people: Person[] }; unpublished?: boolean; hasPublished?: boolean; publish?: SaveState["publish"] }

export function useServerEditor(args: {
  slug?: string; editor?: EditorData; ongoing: Record<string, OngoingWire>;
  setOngoing: React.Dispatch<React.SetStateAction<Record<string, OngoingWire>>>; loadOngoing: (moduleId: string) => Promise<void>;
}) {
  const { slug, editor, ongoing, setOngoing, loadOngoing } = args;
  const canSave = Boolean(editor?.canSave);
  const [editing, setEditingState] = useState(canSave);
  const [draft, setDraft] = useState<Course | null>(editor?.course ?? null);
  const [people, setPeople] = useState<Person[]>(editor?.people ?? []);
  const [save, setSave] = useState<SaveState>({ saving: false, error: null, unpublished: editor?.unpublished ?? false, hasPublished: editor?.hasPublished ?? false, publish: null, published: false });
  const pending = useRef(new Map<string, Op>());
  const timer = useRef<number | null>(null);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const ongoingRef = useRef(ongoing);
  ongoingRef.current = ongoing;

  const send = useCallback(async (op: Op): Promise<EditReply> => {
    try {
      const res = await fetch("/api/workspaces/edit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ course: slug, op }) });
      return (await res.json()) as EditReply;
    } catch {
      return { ok: false, error: "That did not save. Check your connection and try again." };
    }
  }, [slug]);

  const note = (j: EditReply) => setSave((s) => ({ ...s, unpublished: j.unpublished ?? s.unpublished, hasPublished: j.hasPublished ?? s.hasPublished }));

  /** Send what is waiting, in order. */
  const flushNow = useCallback(async (): Promise<boolean> => {
    const ops = [...pending.current.values()];
    pending.current.clear();
    for (const op of ops) {
      const j = await send(op);
      if (!j.ok) { setSave((s) => ({ ...s, saving: false, error: j.error ?? "That did not save." })); return false; }
      note(j);
    }
    return true;
  }, [send]);

  const run = useCallback(<T,>(fn: () => Promise<T>): Promise<T> => {
    const p = chain.current.then(fn, fn) as Promise<T>;
    chain.current = p.catch(() => undefined);
    return p;
  }, []);

  const flush = useCallback(() => run(async () => {
    if (!pending.current.size) return;
    setSave((s) => ({ ...s, saving: true }));
    const ok = await flushNow();
    setSave((s) => ({ ...s, saving: false, error: ok ? null : s.error }));
  }), [run, flushNow]);

  const queue = useCallback((key: string, op: Op, merge = true) => {
    const old = pending.current.get(key);
    pending.current.set(key, merge && old && old.patch && op.patch ? { ...op, patch: { ...old.patch, ...op.patch } } : op);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { void flush(); }, 700);
  }, [flush]);

  const structural = useCallback((op: Op): Promise<string | null> => run(async () => {
    if (timer.current) { window.clearTimeout(timer.current); timer.current = null; }
    setSave((s) => ({ ...s, saving: true }));
    if (!(await flushNow())) return null;
    const j = await send(op);
    if (!j.ok || !j.data) { setSave((s) => ({ ...s, saving: false, error: j.error ?? "That did not save." })); return j.error ?? "That did not save."; }
    setDraft(j.data.course);
    setPeople(j.data.people);
    setSave((s) => ({ ...s, saving: false, error: null, unpublished: j.unpublished ?? s.unpublished, hasPublished: j.hasPublished ?? s.hasPublished }));
    return null;
  }), [run, flushNow, send]);

  // Leaving the page with edits waiting: send them.
  useEffect(() => {
    const onHide = () => { if (pending.current.size) void flushNow(); };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [flushNow]);

  const mapModule = useCallback((id: string, fn: (m: Module) => Module) => setDraft((c) => (c ? { ...c, modules: c.modules.map((m) => (m.id === id ? fn(m) : m)) } : c)), []);

  const ops: Pick<WorkspaceApi, "updateCourse" | "addModule" | "updateModule" | "removeModule" | "addStep" | "updateStep" | "removeStep" | "moveStep" | "setModuleKind" | "updateOngoing" | "planInterval"> = {
    updateCourse: (patch) => {
      setDraft((c) => (c ? { ...c, ...patch } : c));
      const sendable = pick(patch, COURSE_KEYS);
      if (Object.keys(sendable).length) queue("course", { t: "course", patch: sendable });
    },
    addModule: () => { void structural({ t: "add-module" }); },
    updateModule: (id, patch) => {
      mapModule(id, (m) => ({ ...m, ...patch }));
      const sendable = pick(patch, MODULE_KEYS);
      if (Object.keys(sendable).length) queue(`module:${id}`, { t: "module", id, patch: sendable });
    },
    removeModule: (id) => { void structural({ t: "remove-module", id }); },
    addStep: (moduleId, kind) => { if (ADDABLE.includes(kind)) void structural({ t: "add-step", moduleId, kind }); return ""; },
    updateStep: (moduleId, stepId, patch: Partial<Step>) => {
      mapModule(moduleId, (m) => ({ ...m, steps: m.steps.map((s) => (s.id === stepId ? { ...s, ...patch } : s)) }));
      const sendable = pick(patch, STEP_KEYS);
      if (Object.keys(sendable).length) queue(`step:${stepId}`, { t: "step", id: stepId, patch: sendable });
    },
    removeStep: (moduleId, id) => { void structural({ t: "remove-step", moduleId, id }); },
    moveStep: (moduleId, id, dir) => { void structural({ t: "move-step", moduleId, id, dir }); },
    setModuleKind: (id, kind) => { void structural({ t: "ongoing", moduleId: id, on: kind === "ongoing" }).then((err) => { if (!err && kind === "ongoing") void loadOngoing(id); }); },
    updateOngoing: (moduleId, patch: Partial<Ongoing>) => {
      mapModule(moduleId, (m) => (m.ongoing ? { ...m, ongoing: { ...m.ongoing, ...patch, ...(patch.every ? { everyDays: patch.every === "week" ? 7 : 1 } : {}) } } : m));
      const sendable: Record<string, unknown> = {};
      for (const k of ["every", "start", "end", "closes", "readFirst", "show"] as const) if (k in patch) sendable[k] = patch[k];
      if (Object.keys(sendable).length) queue(`ongoing:${moduleId}`, { t: "ongoing", moduleId, on: true, patch: sendable });
    },
    planInterval: (moduleId, key, patch) => {
      const w: OngoingWire = ongoingRef.current[moduleId] ?? { moduleId, tz: "", today: { state: "ended" }, closesAt: null, plans: {}, entries: [], entered: {}, commentsMode: "guide", isGuide: true };
      const cur = w.plans[key] ?? { note: null, items: [] };
      const next = {
        note: patch.note !== undefined ? patch.note.trim() ? patch.note : null : cur.note,
        items: patch.materials ? patch.materials.map((x) => ({ id: x.id, name: x.name, url: x.url, access: x.access })) : cur.items,
      };
      setOngoing((o) => ({ ...o, [moduleId]: { ...(o[moduleId] ?? w), plans: { ...(o[moduleId] ?? w).plans, [key]: next } } }));
      queue(`plan:${moduleId}:${key}`, { t: "plan", moduleId, key, note: next.note, items: next.items }, false);
    },
  };

  const adopt = useCallback((): Promise<string | null> => run(async () => {
    setSave((s) => ({ ...s, saving: true }));
    const j = await send({ t: "adopt" });
    if (!j.ok) { setSave((s) => ({ ...s, saving: false, error: j.error ?? "That did not work." })); return j.error ?? "That did not work."; }
    setSave((s) => ({ ...s, saving: false, error: null, publish: j.publish ?? s.publish, published: true }));
    return null;
  }), [run, send]);

  const publish = useCallback((): Promise<string | null> => run(async () => {
    if (timer.current) { window.clearTimeout(timer.current); timer.current = null; }
    setSave((s) => ({ ...s, saving: true }));
    if (!(await flushNow())) return "Some edits did not save; try again.";
    const j = await send({ t: "publish" });
    if (!j.ok || !j.data) { setSave((s) => ({ ...s, saving: false, error: j.error ?? "That did not publish." })); return j.error ?? "That did not publish."; }
    setDraft(j.data.course);
    setSave((s) => ({ ...s, saving: false, error: null, unpublished: false, hasPublished: true, publish: j.publish ?? null, published: true }));
    return null;
  }), [run, flushNow, send]);

  const post = useCallback(async <T,>(action: string, body: Record<string, unknown>): Promise<T | null> => {
    try {
      const res = await fetch(`/api/workspaces/${action}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ course: slug, ...body }) });
      return (await res.json()) as T;
    } catch { return null; }
  }, [slug]);

  const tools = {
    searchMembers: async (q: string) => (await post<{ ok: boolean; people?: { id: string; name: string }[] }>("members-search", { q }))?.people ?? [],
    addMember: async (userId: string) => { const j = await post<{ ok: boolean; error?: string }>("members-add", { userId }); return j?.ok ? null : j?.error ?? "That did not work."; },
    listInvites: async () => (await post<{ ok: boolean; invites?: InviteWire[] }>("invites", {}))?.invites ?? null,
    createInvite: async (opts: { label?: string; maxUses?: number | null; days?: number | null }) => {
      const j = await post<{ ok: boolean; error?: string; token?: string }>("invite-create", opts);
      return j?.ok && j.token ? { link: `${window.location.origin}/workspaces/join/${j.token}` } : { error: j?.error ?? "That did not work." };
    },
    revokeInvite: async (id: string) => { const j = await post<{ ok: boolean; error?: string }>("invite-revoke", { id }); return j?.ok ? null : j?.error ?? "That did not work."; },
  };

  /** Switching to the participant view after publishing: the published copy on this page is stale, so reload it. */
  const setEditing = useCallback((on: boolean) => {
    if (!on && save.published) { void flush().then(() => window.location.reload()); return; }
    setEditingState(on);
  }, [save.published, flush]);

  return { canEdit: canSave, viewSettings: Boolean(editor) && !canSave, editing: canSave && editing, setEditing, draft, people, save, ops, publish, adopt, tools };
}
