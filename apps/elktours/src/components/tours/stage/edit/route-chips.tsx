"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useSurfaceStage } from "@elkdonis/cms-ui/surface";
import { InsertStop } from "./insert-stop";
import { StopSettings } from "./stop-settings";
import { useStageEdit } from "./stage-edit-store";

/** Edit row above a stop's line: the stop numbers with a "+" between each pair, and Stop settings. */
export function StopEditRow({ stopId }: { stopId: string }) {
  const edit = useStageEdit();
  const stage = useSurfaceStage();
  const api = edit?.api ?? null;
  const [at, setAt] = useState<number | null>(null);
  const [settings, setSettings] = useState(false);
  if (!api || !api.ready) return null;
  const list = api.stops;
  return (
    <div className="tse-row-chips tse-region" data-tse="route">
      <span className="tse-label">Stops</span>
      <ol className="tse-chips">
        {list.map((s, i) => (
          <li key={s.key} className="tse-chips__item">
            {i > 0 && (
              <button type="button" className="tse-plus" aria-label={`Insert a stop between ${i} and ${i + 1}`} title={`Insert a stop between ${i} and ${i + 1}`} onClick={() => setAt(i)}>
                <Plus size={12} aria-hidden />
              </button>
            )}
            <button type="button" className="tse-num" aria-current={s.id === stopId ? "true" : undefined} aria-label={`Stop ${i + 1}: ${s.title}`} onClick={() => s.id && stage?.select(s.id)}>
              {i + 1}
            </button>
          </li>
        ))}
        <li className="tse-chips__item">
          <button type="button" className="tse-add" onClick={() => setAt(list.length)}>
            <Plus size={12} aria-hidden /> Add a stop after {list.length}
          </button>
        </li>
      </ol>
      <button type="button" className="tse-btn tse-btn--small" onClick={() => setSettings(true)}>
        Stop settings
      </button>
      {at != null && <InsertStop at={at} onClose={() => setAt(null)} />}
      {settings && <StopSettings stopId={stopId} onClose={() => setSettings(false)} />}
    </div>
  );
}
