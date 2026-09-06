"use client";

import * as React from "react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

// ============================================================================
// Generic multi-step wizard state.
//
// Generalized from arts-collective's WizardProvider/BusinessWizardProvider,
// which were byte-for-byte clones differing only in storage key, step count,
// and answer type — this is parameterized on all three so one provider backs
// every wizard (artist onboarding, business onboarding, workshop authoring).
//
// It also fixes four concrete bugs those versions had:
//
//  1. Draft loss mid-step. There, `patch` only ran on step submit, so
//     anything typed on the current step vanished if the tab closed. Here
//     `patch` is meant to be called on change, and `autosaveMs` debounces a
//     real persist so a half-filled step survives.
//  2. Stale cache beating the server. There, localStorage was spread AFTER
//     the server values, so an old browser cache silently overwrote fresher
//     DB data. Here the cached blob carries a timestamp and is only applied
//     when it is newer than `serverUpdatedAt`.
//  3. Silent save failures. There, save-and-exit fired a fetch with no
//     status check and redirected regardless. Here `save()` surfaces errors
//     and reports status so the caller can block navigation.
//  4. A conditional `useWizard()` call inside try/catch (an illegal hook
//     call that only worked by render-order accident). `useWizardOptional`
//     is the supported way to read context that may be absent.
//
// Step lists (added 2026-09-01)
// -----------------------------
// The original took a fixed `totalSteps: number`, which cannot express a
// wizard whose steps are derived at runtime — the workshop wizard's steps come
// from the active template's manifest, so two templates yield different step
// counts, and a step can be conditional on earlier answers.
//
// Passing `steps` switches on list mode: `step` becomes a 1-based index into
// the *visible* steps, so `next`/`back` skip hidden ones without callers doing
// arithmetic. Progress is cached by step **id** rather than index, because an
// index means nothing once the step list changes — switching template with a
// numeric cache would drop the author onto an unrelated step.
//
// `totalSteps` still works and is unchanged for existing callers.
// ============================================================================

export type WizardSaveStatus = "idle" | "saving" | "saved" | "error";

export interface WizardStepMeta {
  /** Stable across renders and template changes — this is what gets cached. */
  id: string;
  label?: string;
  description?: string;
  /** The author may skip it; drives the step indicator, not visibility. */
  optional?: boolean;
}

export interface WizardContextValue<T> {
  /** 1-based index into `visibleSteps`. */
  step: number;
  /** Count of currently visible steps. */
  totalSteps: number;
  /** Every declared step, including those currently hidden. */
  steps: WizardStepMeta[];
  /** Steps passing `isStepVisible` for the current answers. */
  visibleSteps: WizardStepMeta[];
  /** Id of the current step, or null in plain `totalSteps` mode. */
  stepId: string | null;
  /** Jump to a step by id. No-op if it is unknown or currently hidden. */
  goToId: (id: string) => void;
  answers: Partial<T>;
  /** Merge fields into the draft. Safe to call on every change. */
  patch: (fields: Partial<T>) => void;
  setStep: (step: number) => void;
  next: () => void;
  back: () => void;
  /** Clears in-memory state AND the persisted cache. */
  reset: () => void;
  /** Force an immediate persist. Resolves false if it failed. */
  save: () => Promise<boolean>;
  saveStatus: WizardSaveStatus;
  saveError: string | null;
  lastSavedAt: Date | null;
  /** True once the cache-hydration pass has run — render a skeleton until then. */
  hydrated: boolean;
}

const Ctx = createContext<WizardContextValue<any> | null>(null);

export interface WizardProviderProps<T> {
  /** Namespaces the local cache, e.g. `artist-onboarding` or `workshop:th_abc`. */
  storageKey: string;
  /**
   * Fixed step count. Ignored when `steps` is supplied; kept so existing
   * callers (artist and business onboarding) need no changes.
   */
  totalSteps?: number;
  /**
   * Declared steps, in order. Supplying this switches on list mode and makes
   * `totalSteps` derived rather than declared.
   */
  steps?: WizardStepMeta[];
  /**
   * Hides a step for the current answers — a conditional step. Called for
   * every step on every render, so keep it cheap and pure.
   */
  isStepVisible?: (step: WizardStepMeta, answers: Partial<T>) => boolean;
  /** Server-loaded values — the source of truth when newer than the cache. */
  initialAnswers?: Partial<T>;
  /** When the server values were last written; enables staleness comparison. */
  serverUpdatedAt?: string | Date | null;
  /**
   * Persists the draft. Throw (or reject) to surface an error — the wizard
   * will not pretend the save succeeded. Typically wraps a server action
   * that upserts a draft row.
   */
  onSave?: (answers: Partial<T>) => Promise<void>;
  /** Debounce for autosave after a patch. 0 disables autosave. Default 2000ms. */
  autosaveMs?: number;
  children: React.ReactNode;
}

interface CachedBlob<T> {
  step: number;
  /** Preferred over `step` on resume when the provider is in list mode. */
  stepId?: string;
  answers: Partial<T>;
  savedAt: string;
}

export function WizardProvider<T>({
  storageKey,
  totalSteps: declaredTotal,
  steps,
  isStepVisible,
  initialAnswers,
  serverUpdatedAt,
  onSave,
  autosaveMs = 2000,
  children,
}: WizardProviderProps<T>) {
  const cacheKey = `eac:wizard:${storageKey}`;

  const [step, setStepState] = useState(1);
  const [answers, setAnswers] = useState<Partial<T>>(initialAnswers ?? {});
  const [hydrated, setHydrated] = useState(false);
  const [saveStatus, setSaveStatus] = useState<WizardSaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // Kept in a ref so the debounced timer always persists the latest values
  // without needing to be torn down and recreated on every keystroke.
  const answersRef = useRef(answers);
  answersRef.current = answers;

  // ── Step list ────────────────────────────────────────────────────────────
  // In plain mode a synthetic list stands in, so the rest of the provider has
  // exactly one shape to reason about.
  const listMode = Array.isArray(steps);
  const allSteps: WizardStepMeta[] = React.useMemo(() => {
    if (steps) return steps;
    const n = declaredTotal ?? 1;
    return Array.from({ length: n }, (_, i) => ({ id: String(i + 1) }));
  }, [steps, declaredTotal]);

  const visibleSteps = React.useMemo(() => {
    if (!isStepVisible) return allSteps;
    return allSteps.filter((s) => isStepVisible(s, answers));
  }, [allSteps, isStepVisible, answers]);

  const totalSteps = visibleSteps.length;

  // A conditional step can disappear under the cursor — clamp rather than
  // rendering a step that is no longer in the list.
  const safeStep = Math.min(Math.max(1, step), Math.max(1, totalSteps));
  const stepId = listMode ? (visibleSteps[safeStep - 1]?.id ?? null) : null;

  // Read by callbacks that must not be re-created when the list shifts.
  const visibleRef = useRef(visibleSteps);
  visibleRef.current = visibleSteps;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Hydrate from cache, but only if it is newer than the server's copy ──
  useEffect(() => {
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) {
        const cached = JSON.parse(raw) as CachedBlob<T>;
        const cachedAt = cached.savedAt ? new Date(cached.savedAt).getTime() : 0;
        const serverAt = serverUpdatedAt ? new Date(serverUpdatedAt).getTime() : 0;

        // Server wins ties and anything newer — the opposite of the old
        // behaviour, where a stale cache always clobbered fresh DB values.
        if (cachedAt > serverAt && cached.answers) {
          setAnswers({ ...(initialAnswers ?? {}), ...cached.answers });
          // Resolve by id first: an index is meaningless if the step list has
          // changed since the cache was written.
          const byId = cached.stepId
            ? visibleRef.current.findIndex((s) => s.id === cached.stepId)
            : -1;
          if (byId >= 0) {
            setStepState(byId + 1);
          } else if (typeof cached.step === "number") {
            const limit = Math.max(1, visibleRef.current.length);
            setStepState(Math.max(1, Math.min(limit, cached.step)));
          }
        } else if (cachedAt <= serverAt) {
          // Cache is stale; drop it so it can't resurrect later.
          localStorage.removeItem(cacheKey);
        }
      }
    } catch {
      // Corrupt cache is not worth failing the wizard over.
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  const writeCache = useCallback(
    (nextStep: number, nextAnswers: Partial<T>) => {
      try {
        const blob: CachedBlob<T> = {
          step: nextStep,
          stepId: visibleRef.current[nextStep - 1]?.id,
          answers: nextAnswers,
          savedAt: new Date().toISOString(),
        };
        localStorage.setItem(cacheKey, JSON.stringify(blob));
      } catch {
        // Quota/private-mode failures are non-fatal — the DB save is the
        // real persistence path.
      }
    },
    [cacheKey]
  );

  const save = useCallback(async (): Promise<boolean> => {
    if (!onSave) return true;
    setSaveStatus("saving");
    setSaveError(null);
    try {
      await onSave(answersRef.current);
      setSaveStatus("saved");
      setLastSavedAt(new Date());
      return true;
    } catch (err) {
      setSaveStatus("error");
      setSaveError(err instanceof Error ? err.message : "Could not save your progress");
      return false;
    }
  }, [onSave]);

  const scheduleAutosave = useCallback(() => {
    if (!onSave || autosaveMs <= 0) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void save();
    }, autosaveMs);
  }, [onSave, autosaveMs, save]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const patch = useCallback(
    (fields: Partial<T>) => {
      setAnswers((prev) => {
        const merged = { ...prev, ...fields };
        answersRef.current = merged;
        writeCache(safeStep, merged);
        return merged;
      });
      scheduleAutosave();
    },
    [safeStep, writeCache, scheduleAutosave]
  );

  const setStep = useCallback(
    (next: number) => {
      // Bounds come from the visible list, so hidden steps are simply not
      // addressable — `next`/`back` skip them without special-casing.
      const limit = Math.max(1, visibleRef.current.length);
      const clamped = Math.max(1, Math.min(limit, next));
      setStepState(clamped);
      writeCache(clamped, answersRef.current);
    },
    [writeCache]
  );

  const next = useCallback(() => setStep(safeStep + 1), [safeStep, setStep]);
  const back = useCallback(() => setStep(safeStep - 1), [safeStep, setStep]);

  const goToId = useCallback(
    (id: string) => {
      const index = visibleRef.current.findIndex((s) => s.id === id);
      if (index >= 0) setStep(index + 1);
    },
    [setStep]
  );

  const reset = useCallback(() => {
    setStepState(1);
    setAnswers({});
    answersRef.current = {};
    setSaveStatus("idle");
    setSaveError(null);
    setLastSavedAt(null);
    try {
      // The old startOverAction cleared DB columns but left the cache, so
      // the next visit repopulated from the browser. Clear both.
      localStorage.removeItem(cacheKey);
    } catch {
      /* ignore */
    }
  }, [cacheKey]);

  const value: WizardContextValue<T> = {
    step: safeStep,
    totalSteps,
    steps: allSteps,
    visibleSteps,
    stepId,
    goToId,
    answers,
    patch,
    setStep,
    next,
    back,
    reset,
    save,
    saveStatus,
    saveError,
    lastSavedAt,
    hydrated,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Throws if used outside a WizardProvider. */
export function useWizard<T>(): WizardContextValue<T> {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWizard must be used inside a <WizardProvider>");
  return ctx as WizardContextValue<T>;
}

/**
 * Context-or-null, for components that render both inside and outside a
 * wizard. Use this instead of wrapping useWizard() in try/catch — that
 * pattern is a conditional hook call and breaks under concurrent rendering.
 */
export function useWizardOptional<T>(): WizardContextValue<T> | null {
  return useContext(Ctx) as WizardContextValue<T> | null;
}
