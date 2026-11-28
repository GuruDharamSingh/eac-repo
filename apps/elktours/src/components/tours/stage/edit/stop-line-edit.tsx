"use client";

import { useEffect, useState } from "react";
import { NARRATIVE_HARD, NARRATIVE_SOFT } from "@/components/office/create-tour/types";
import { draftFor, useStageEdit } from "./stage-edit-store";

/** The stop's line, typed where it is read. Saves when focus leaves the box (one Undo step per change). */
export function StopLineEdit({ stopId, fallback }: { stopId: string; fallback: string | null }) {
  const edit = useStageEdit();
  const api = edit?.api ?? null;
  const mine = draftFor(api, stopId);
  const stored = mine ? (api!.narratives[mine.draft.key] ?? "") : "";
  const [text, setText] = useState(stored);
  const [focus, setFocus] = useState(false);
  // Follow the saved text (an Undo, a reload) when not typing.
  useEffect(() => {
    if (!focus) setText(stored);
  }, [stored, focus]);
  if (!api || !api.ready || !mine) return <p className="ts-narr tse-line tse-line--wait">{fallback ?? "Loading…"}</p>;

  const over = text.length > NARRATIVE_SOFT;
  async function save() {
    setFocus(false);
    const next = text.trim();
    if (next === stored.trim()) return;
    await api!.commit({ narratives: { ...api!.narratives, [mine!.draft.key]: next } });
  }
  return (
    <div className="tse-region tse-line" data-tse="line">
      <textarea
        className="ts-narr tse-line__box"
        rows={6}
        maxLength={NARRATIVE_HARD}
        value={text}
        placeholder={fallback ? `${fallback}` : "Write what the guide says at this stop"}
        aria-label="The stop's line"
        aria-describedby={`tse-count-${stopId}`}
        onFocus={() => setFocus(true)}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => void save()}
      />
      <span id={`tse-count-${stopId}`} className={`tse-count${over ? " is-over" : ""}`}>
        {focus ? "Typing" : "The stop's line"} · {text.length} / {NARRATIVE_SOFT}
        {over ? " · the page cuts it at 240" : ""}
      </span>
    </div>
  );
}
