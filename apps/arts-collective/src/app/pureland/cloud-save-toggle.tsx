"use client";

import { useState, useTransition } from "react";
import { setPurelandCloudSave } from "@/lib/pureland-actions";

/** "Save my progress to my account": the game's shell mirrors its saves to /api/pureland/save. */
export function CloudSaveToggle({ enabled, savedAt, bytes }: { enabled: boolean; savedAt: string | null; bytes: number }) {
  const [on, setOn] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="pl-save">
      <label className="pl-switch">
        <input
          type="checkbox"
          checked={on}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.checked;
            setOn(next);
            setError(null);
            start(async () => {
              const result = await setPurelandCloudSave(next);
              if (!result.ok) {
                setOn(!next);
                setError(result.error ?? "Couldn't change that.");
              }
            });
          }}
        />
        <span>Save my progress to my account</span>
      </label>
      <p className="pl-note">
        {on
          ? savedAt
            ? `Last saved ${new Date(savedAt).toLocaleString()} (${Math.max(1, Math.round(bytes / 1024))} KB). Your progress follows you to any browser you sign in on.`
            : "Your progress will be saved here as you play, and follow you to any browser you sign in on."
          : "Off: your progress stays in this browser only."}
      </p>
      {error && <p className="pl-error">{error}</p>}
    </div>
  );
}
