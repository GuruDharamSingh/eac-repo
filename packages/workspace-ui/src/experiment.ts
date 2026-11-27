"use client";

import { useCallback, useEffect, useState } from "react";
import type { CandidateWire, ExperimentTools, ExperimentWire, ResultWire } from "./types";

type Reply = Record<string, unknown> & { ok?: boolean; error?: string };

/** The experiment preset's calls (consent, publication requests, results). Null when the workspace is not an experiment. */
export function useExperiment(slug: string | undefined, enabled: boolean): ExperimentTools | null {
  const [state, setState] = useState<ExperimentWire | null>(null);
  const call = useCallback(async (action: string, body: Record<string, unknown> = {}): Promise<Reply> => {
    try {
      const res = await fetch(`/api/workspaces/${action}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ course: slug, ...body }) });
      return (await res.json()) as Reply;
    } catch { return { ok: false, error: "That did not work. Check your connection and try again." }; }
  }, [slug]);
  const refresh = useCallback(async () => {
    const j = await call("experiment");
    if (j.ok && j.state) setState(j.state as ExperimentWire);
  }, [call]);
  useEffect(() => { if (enabled) void refresh(); }, [enabled, refresh]);
  if (!enabled) return null;
  const err = (j: Reply) => (j.ok ? null : j.error ?? "That did not work.");
  return {
    state, refresh,
    agree: async () => { const j = await call("experiment-agree"); if (j.ok) await refresh(); return err(j); },
    withdraw: async () => { const j = await call("experiment-withdraw"); if (j.ok) await refresh(); return { error: err(j) ?? undefined, notes: (j.notes as string[] | undefined) ?? [] }; },
    decide: async (itemId, agree, credit) => { const j = await call("result-decide", { itemId, decision: agree ? "agree" : "decline", credit }); if (j.ok) await refresh(); return err(j); },
    saveConsent: async (text) => { const j = await call("consent-save", { body: text }); return { error: err(j) ?? undefined, version: j.version as number | undefined }; },
    loadResults: async (resultId) => { const j = await call("results", { resultId }); return j.ok ? { results: j.results as ResultWire[], candidates: j.candidates as CandidateWire[] } : null; },
    saveResult: async (r) => { const j = await call("result-save", r); return { id: j.id as string | undefined, error: err(j) ?? undefined }; },
    request: async (id, responseIds) => { const j = await call("result-request", { id, responseIds }); return { requested: j.requested as number | undefined, error: err(j) ?? undefined }; },
    publish: async (id) => { const j = await call("result-publish", { id }); if (j.ok) await refresh(); return { error: err(j) ?? undefined, included: j.included as number | undefined, audience: j.audience as string | undefined }; },
    takedown: async (id) => { const j = await call("result-takedown", { id }); if (j.ok) await refresh(); return err(j); },
  };
}
