// The forms harness entry: one page, one look, from window.__PAGE__ / __THEME__ (build.mjs writes them).
import * as React from "react";
import { createRoot } from "react-dom/client";
import { HarnessApp, type HarnessTheme } from "/repo/packages/studio/src/forms/harness";

declare global {
  interface Window {
    __PAGE__: string;
    __THEME__: HarnessTheme;
  }
}

createRoot(document.getElementById("root")!).render(<HarnessApp page={window.__PAGE__} theme={window.__THEME__} />);
