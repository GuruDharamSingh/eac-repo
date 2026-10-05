"use client";

import { useState } from "react";
import { withBase } from "@/lib/base-path";

/** The day's own note: how the reading went, who was there, anything to carry forward. */
export function DayNote({ day, initial }: { day: string; initial: string }) {
  const [note, setNote] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");

  async function save() {
    setState("saving");
    const res = await fetch(withBase("/api/akhand-path/day"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ day, note }),
    }).catch(() => null);
    if (res?.ok) {
      setSaved(note);
      setState("idle");
    } else {
      setState("error");
    }
  }

  return (
    <div className="paath-daynote">
      <textarea
        rows={4}
        value={note}
        placeholder="How the reading went today, who read, anything to carry into tomorrow…"
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="paath-notes__actions">
        {state === "error" && <span className="paath-error">Not saved. Try again.</span>}
        {note !== saved && state !== "saving" && <span className="paath-dim">Not saved yet</span>}
        <button type="button" className="btn" onClick={save} disabled={state === "saving" || note === saved}>
          {state === "saving" ? "Saving…" : "Save the day’s note"}
        </button>
      </div>
    </div>
  );
}
