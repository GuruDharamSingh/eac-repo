"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useTourEditor } from "@/components/office/create-tour/use-tour-editor";
import type { StopDraft } from "@/components/manage/tour-builder/draft";
import type { Narratives } from "@/components/office/create-tour/types";
import { Layer } from "./layer";
import type { StageEditApi, StageEditStore } from "./stage-edit-store";

const clock = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/**
 * Mounted by TourStage only while an editor is in edit mode: loads the tour into the shared editor hook, keeps the
 * undo history and publishes the API to the store. Renders the top bar and the Tour settings sheet.
 */
export function StageEditHost({ tourId, store }: { tourId: string; store: StageEditStore }) {
  const router = useRouter();
  const ed = useTourEditor({ initialId: tourId });
  const history = useRef<Array<{ stops: StopDraft[]; narratives: Narratives }>>([]);
  const [, bump] = useState(0);
  const [settings, setSettings] = useState(false);

  async function commit(next: { stops?: StopDraft[]; narratives?: Narratives }) {
    history.current.push({ stops: ed.stops, narratives: ed.narratives });
    bump((n) => n + 1);
    const ok = await ed.saveStops(next);
    if (!ok) {
      history.current.pop();
      bump((n) => n + 1);
    }
    return ok;
  }

  async function undo() {
    const prev = history.current.pop();
    bump((n) => n + 1);
    if (!prev) return;
    // A stop that was removed has no row any more: restoring it makes a new one.
    const live = new Set(ed.stops.map((s) => s.id).filter(Boolean));
    const stops = prev.stops.map((s) => (s.id && !live.has(s.id) ? { ...s, id: null } : s));
    const ok = await ed.saveStops({ stops, narratives: prev.narratives });
    if (!ok) {
      history.current.push(prev);
      bump((n) => n + 1);
    }
  }

  const api: StageEditApi = {
    ready: !ed.loading && !!ed.tourId,
    saving: ed.saving,
    savedAt: ed.savedAt,
    tourId,
    slug: ed.slug,
    stops: ed.stops,
    narratives: ed.narratives,
    canUndo: history.current.length > 0,
    commit,
    undo,
    refresh: () => router.refresh(),
    openTourSettings: () => setSettings(true),
  };
  // Published on every render of this component only; consumers re-render from the store, not this host.
  useEffect(() => {
    store.set({ api });
  });
  useEffect(() => () => store.set({ api: null }), [store]);

  // The page's own Edit menu steps aside while the stage is being edited.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("elk:stage-editing", { detail: true }));
    return () => void window.dispatchEvent(new CustomEvent("elk:stage-editing", { detail: false }));
  }, []);

  function done() {
    router.refresh();
    store.set({ editing: false });
  }

  return (
    <>
      {typeof document !== "undefined" &&
        createPortal(
          <div className="tse-layer tse-bar" role="region" aria-label="Editing the tour page">
            <strong>Editing the tour page</strong>
            <span className="tse-bar__hint">Click any outlined part to change it</span>
            <span className="tse-bar__spacer" />
            <span className="tse-bar__saved" aria-live="polite">
              {ed.loading ? "Loading…" : ed.saving ? "Saving…" : ed.savedAt ? `Saved ${clock(ed.savedAt)}` : "Nothing changed yet"}
            </span>
            <button type="button" className="tse-btn" onClick={() => void undo()} disabled={history.current.length === 0 || ed.saving}>
              Undo
            </button>
            <button type="button" className="tse-btn" onClick={() => setSettings(true)}>
              Tour settings
            </button>
            <button type="button" className="tse-btn tse-btn--primary" onClick={done} disabled={ed.saving}>
              Done
            </button>
          </div>,
          document.body
        )}
      {settings && (
        <Layer title="Tour settings" onClose={() => setSettings(false)}>
          <TourSettings ed={ed} tourId={tourId} onSaved={() => router.refresh()} />
        </Layer>
      )}
    </>
  );
}

function TourSettings({ ed, tourId, onSaved }: { ed: ReturnType<typeof useTourEditor>; tourId: string; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  if (ed.loading) return <p className="tse-note">Loading…</p>;
  async function save() {
    setBusy(true);
    const id = await ed.saveTour();
    setBusy(false);
    if (id) onSaved();
  }
  return (
    <div className="tse-form">
      <label className="tse-field">
        <span>Title</span>
        <input value={ed.draft.title} onChange={(e) => ed.set("title", e.target.value)} />
      </label>
      <label className="tse-field">
        <span>Summary</span>
        <textarea rows={3} value={ed.draft.excerpt} onChange={(e) => ed.set("excerpt", e.target.value)} />
      </label>
      <div className="tse-row">
        <button type="button" className="tse-btn tse-btn--primary" disabled={busy || ed.saving || !ed.draftDirty} onClick={() => void save()}>
          {busy ? "Saving…" : "Save"}
        </button>
        {ed.published ? <span className="tse-note">Published: a save goes to the live page.</span> : null}
      </div>
      <p className="tse-links">
        <a href={`/hub/tours/edit?tour=${encodeURIComponent(tourId)}`}>Open the full editor</a>
        <a href={`/hub/tours/suite?tour=${encodeURIComponent(tourId)}`}>Open the edit suite</a>
      </p>
    </div>
  );
}

