"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { versionsAutosave, versionsDiscardDraft, versionsKeep, versionsList, versionsSave } from "@/lib/versions-actions";
import { isFail, type DraftRow, type Fail, type VersionRow } from "@/lib/versions-types";

// ============================================================================
// The sandbox's side of versions: loads the history for one block, keeps track
// of which version the working copy came from (`baseId`), autosaves the working
// copy two seconds after the last change (the landing loft's "working copy"),
// and saves versions. All talking to the server goes through versions-actions.
// ============================================================================

export type Phase = "loading" | "ready" | "setup" | "denied" | "error";
export type Autosave = "idle" | "waiting" | "saving" | "saved" | "failed";

function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object")
    return `{${Object.keys(v as object)
      .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  return JSON.stringify(v ?? null);
}

/** What counts as "the same edit": the block's props (Puck re-shapes the rest of the document on its own). */
export function docKey(doc: unknown): string {
  const first = (doc as { content?: { props?: Record<string, unknown> }[] } | null)?.content?.[0]?.props ?? {};
  const { id: _id, ...rest } = first;
  void _id;
  return stable(rest);
}

// The version the working copy came from survives closing and reopening the sandbox (this tab only).
const readBase = (subject: string): string | null => {
  try {
    return sessionStorage.getItem(`dev-versions-base:${subject}`);
  } catch {
    return null;
  }
};
const writeBase = (subject: string, id: string | null) => {
  try {
    if (id) sessionStorage.setItem(`dev-versions-base:${subject}`, id);
    else sessionStorage.removeItem(`dev-versions-base:${subject}`);
  } catch {
    /* private mode: fine */
  }
};

export interface VersionsApi {
  phase: Phase;
  message: string;
  versions: VersionRow[];
  /** The autosaved working copy found when the sandbox opened, until it is picked up or thrown away. */
  found: DraftRow | null;
  baseId: string | null;
  setBaseId(id: string | null): void;
  autosave: Autosave;
  savedAt: string | null;
  /** Tell the store the document changed (starts the autosave timer). */
  changed(doc: unknown): void;
  /** What the document is now, so only real edits autosave. */
  baseline(doc: unknown): void;
  save(args: { note: string; doc: unknown; branchName?: string }): Promise<{ ok: true; saved: VersionRow; newBranch: boolean } | Fail>;
  keep(id: string, keep: boolean): Promise<void>;
  dropFound(): Promise<void>;
  clearFound(): void;
  refresh(): Promise<void>;
}

export function useVersions(subject: string, theme: string | null): VersionsApi {
  const [phase, setPhase] = useState<Phase>("loading");
  const [message, setMessage] = useState("");
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [found, setFound] = useState<DraftRow | null>(null);
  const [baseId, setBaseIdState] = useState<string | null>(() => readBase(subject));
  const [autosave, setAutosave] = useState<Autosave>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const baseRef = useRef<string | null>(readBase(subject));
  const base = useRef("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const live = useRef(true);
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const off = phase !== "ready";
  const offRef = useRef(off);
  offRef.current = off;

  const setBaseId = useCallback(
    (id: string | null) => {
      baseRef.current = id;
      setBaseIdState(id);
      writeBase(subject, id);
    },
    [subject],
  );

  const refresh = useCallback(async () => {
    const r = await versionsList(subject);
    if (!live.current) return;
    if (!isFail(r)) {
      // A remembered starting point that is gone (or never saved) is forgotten.
      if (baseRef.current && !r.versions.some((v) => v.id === baseRef.current)) {
        baseRef.current = null;
        setBaseIdState(null);
      }
      setVersions(r.versions);
      setFound(r.draft);
      setPhase("ready");
    } else {
      setPhase(r.reason === "setup" ? "setup" : r.reason === "denied" ? "denied" : "error");
      setMessage(r.message);
    }
  }, [subject]);

  useEffect(() => {
    live.current = true;
    void refresh();
    return () => {
      live.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [refresh]);

  const baseline = useCallback((doc: unknown) => {
    base.current = docKey(doc);
  }, []);

  const changed = useCallback(
    (doc: unknown) => {
      if (offRef.current) return;
      const key = docKey(doc);
      if (key === base.current) return;
      if (timer.current) clearTimeout(timer.current);
      setAutosave("waiting");
      timer.current = setTimeout(async () => {
        setAutosave("saving");
        const r = await versionsAutosave({ subject, baseId: baseRef.current, doc, theme: themeRef.current });
        if (!live.current) return;
        if (r.ok) {
          base.current = key;
          setAutosave("saved");
          setSavedAt(r.updatedAt);
        } else setAutosave("failed");
      }, 2000);
    },
    [subject],
  );

  const save = useCallback<VersionsApi["save"]>(
    async ({ note, doc, branchName }) => {
      if (timer.current) clearTimeout(timer.current);
      const r = await versionsSave({ subject, baseId: baseRef.current, note, doc, theme: themeRef.current, branchName });
      if (r.ok) {
        base.current = docKey(doc);
        setBaseId(r.saved.id);
        setVersions((v) => [...v, r.saved]);
        setFound(null);
        setAutosave("idle");
        setSavedAt(null);
      }
      return r;
    },
    [subject, setBaseId],
  );

  const keep = useCallback(
    async (id: string, on: boolean) => {
      const r = await versionsKeep(id, on);
      if (r.ok) setVersions((vs) => vs.map((v) => ({ ...v, kept: v.id === id ? on : on ? false : v.kept })));
    },
    [],
  );

  const dropFound = useCallback(async () => {
    await versionsDiscardDraft(subject);
    setFound(null);
  }, [subject]);

  return { phase, message, versions, found, baseId, setBaseId, autosave, savedAt, changed, baseline, save, keep, dropFound, clearFound: () => setFound(null), refresh };
}
