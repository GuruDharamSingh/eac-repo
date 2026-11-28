"use client";

import * as React from "react";
import { RichTextEditor } from "@elkdonis/cms-ui/editor";
import { MediaField } from "@/components/manage/media-field";
import type { StopDraft } from "@/components/manage/tour-builder/draft";
import { bodyFallback, NARRATIVE_HARD, NARRATIVE_SOFT } from "./types";

const label = "text-xs font-medium uppercase tracking-wider text-muted-foreground";
const field = "mt-1 w-full rounded-md border border-input bg-background px-3 py-2";

/**
 * The route step's stop editor (extracted 2026-11-26 so the wizard and the edit suite share its parts): returns the
 * two columns the route step lays out in a grid. Edits go through `patch` (marks the stop dirty) and `onNarrative`.
 */
export function StopEditor({
  stop,
  narrative,
  onNarrative,
  patch,
}: {
  stop: StopDraft;
  /** The stop's line on the tour page. */
  narrative: string;
  onNarrative: (v: string) => void;
  patch: (p: Partial<StopDraft>) => void;
}) {
  return (
    <>
      <div className="space-y-4">
        <NarrativeField value={narrative} onChange={onNarrative} fallback={bodyFallback(stop.body)} />
        <div>
          <span className={label}>What the visitor reads here</span>
          <div className="mt-1">
            <RichTextEditor key={`body-${stop.key}`} value={stop.body} onChange={(v) => patch({ body: v })} toolbar="compact" />
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
          <label className="block">
            <span className={label}>Stop name</span>
            <input value={stop.title} onChange={(e) => patch({ title: e.target.value })} className={field} />
          </label>
          <label className="block">
            <span className={label}>Minutes here</span>
            <input type="number" min={0} step={5} value={stop.durationMinutes} onChange={(e) => patch({ durationMinutes: e.target.value })} className={field} />
          </label>
        </div>
        <div>
          <span className={label}>Notes for the guide (private)</span>
          <div className="mt-1">
            <RichTextEditor key={`notes-${stop.key}`} value={stop.guideNotes} onChange={(v) => patch({ guideNotes: v })} toolbar="compact" />
          </div>
        </div>
        <MediaField value={stop.imageUrl} onChange={(url) => patch({ imageUrl: url })} label="Picture" />
      </div>
    </>
  );
}

/** The stop's line on the tour page: warns past NARRATIVE_SOFT (240); the field stops at NARRATIVE_HARD (280: what the stage column holds; the server accepts 300). */
export function NarrativeField({ value, onChange, fallback, help = "2–3 short lines; it is what the tour page shows for this stop." }: { value: string; onChange: (v: string) => void; fallback: string; help?: string }) {
  const n = value.length;
  const over = n > NARRATIVE_SOFT;
  return (
    <label className="block">
      <span className={label}>The stop's line on the tour page</span>
      <textarea
        rows={3}
        value={value}
        maxLength={NARRATIVE_HARD}
        onChange={(e) => onChange(e.target.value)}
        placeholder={fallback ? `Not written yet. The page shows: ${fallback}` : "Not written yet."}
        aria-describedby="rt-narr-help"
        className={field}
      />
      <span id="rt-narr-help" className="mt-1 flex justify-between gap-3 text-xs text-muted-foreground">
        <span>{help}</span>
        <span className={over ? "font-medium text-destructive" : ""} aria-live="polite">
          {n} / {NARRATIVE_SOFT}
          {over ? ` (limit ${NARRATIVE_HARD})` : ""}
        </span>
      </span>
    </label>
  );
}
