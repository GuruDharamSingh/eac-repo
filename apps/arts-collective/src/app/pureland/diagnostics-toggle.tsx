"use client";

import { useEffect, useState } from "react";

/**
 * "Send diagnostics": while Pureland is tested, the game's shell reports how it ran on this device
 * (browser, GPU, load times, errors, the game's console for the first minute, frame times, a small
 * snapshot of the view) to /api/pureland/log. On by default for members (all of them are testers
 * now); the choice lives in this browser's localStorage, which the game's page shares.
 */
const KEY = "pureland.diagnostics";

export function DiagnosticsToggle() {
  const [on, setOn] = useState(true);

  useEffect(() => {
    try {
      setOn(window.localStorage.getItem(KEY) !== "0");
    } catch {
      /* storage blocked: stays on, the shell treats it the same */
    }
  }, []);

  return (
    <div className="pl-save">
      <label className="pl-switch">
        <input
          type="checkbox"
          checked={on}
          onChange={(e) => {
            const next = e.target.checked;
            setOn(next);
            try {
              window.localStorage.setItem(KEY, next ? "1" : "0");
            } catch {
              /* ignore */
            }
          }}
        />
        <span>Send diagnostics</span>
      </label>
      <p className="pl-note">
        {on
          ? "While Pureland is being tested, it tells the developers how it ran in this browser: device, graphics, load times, errors and a small picture of the view in the first minute."
          : "Off: nothing about how the game runs leaves this browser."}
      </p>
    </div>
  );
}
