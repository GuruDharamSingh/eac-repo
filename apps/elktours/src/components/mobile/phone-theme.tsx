"use client";

import { useEffect, useState } from "react";
import { PHONE_THEME_KEY } from "./phone-theme-script";

/**
 * Light or dark for the phone design (2026-11-16). The choice is per visitor: kept in localStorage and set as
 * `data-m-theme` on <html>, which components/mobile/mobile.css reads below 768px. Light is the default since
 * 2026-11-22 (only an explicit "dark" is stored; visitors who picked dark before that date see light once);
 * desktop pages ignore the attribute. The pre-paint script is in phone-theme-script.ts.
 */
export type PhoneTheme = "dark" | "light";

function readTheme(): PhoneTheme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.getAttribute("data-m-theme") === "light" ? "light" : "dark";
}

/** This page's choice when storage is unavailable (private mode); null until the visitor picks. */
let picked: PhoneTheme | null = null;

/** The visitor's choice: what was picked on this page, else what is stored, else light. */
function chosenTheme(): PhoneTheme {
  if (picked) return picked;
  try {
    return localStorage.getItem(PHONE_THEME_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function setAttr(t: PhoneTheme) {
  const root = document.documentElement;
  if (t === "light") {
    if (root.getAttribute("data-m-theme") !== "light") root.setAttribute("data-m-theme", "light");
  } else if (root.hasAttribute("data-m-theme")) root.removeAttribute("data-m-theme");
}

/** Records the choice first, then sets the attribute, so PhoneThemeKeeper never undoes a deliberate change. */
function applyTheme(t: PhoneTheme) {
  picked = t;
  try {
    if (t === "dark") localStorage.setItem(PHONE_THEME_KEY, "dark");
    else localStorage.removeItem(PHONE_THEME_KEY);
  } catch {
    /* private mode: the choice lasts for this page only */
  }
  setAttr(t);
}

/**
 * Keeps the attribute in step with the visitor's choice. The pre-paint script sets it, but when a page throws a
 * hydration error React redraws from the root on the client and <html> comes back without it (seen 2026-11-16 on
 * `/` and `/tours/<slug>/dates`, React #418). Effects run after that redraw, and the observer restores it if
 * anything removes it later. Mounted once, in app/layout.tsx.
 */
export function PhoneThemeKeeper() {
  useEffect(() => {
    const root = document.documentElement;
    setAttr(chosenTheme());
    const obs = new MutationObserver(() => {
      const want = chosenTheme();
      if ((root.getAttribute("data-m-theme") === "light") !== (want === "light")) setAttr(want);
    });
    obs.observe(root, { attributes: true, attributeFilter: ["data-m-theme"] });
    return () => obs.disconnect();
  }, []);
  return null;
}

/** Dark | Light, two buttons. Used in the City menu (the Paris button). */
export function PhoneThemeToggle({ label = "Look" }: { label?: string }) {
  const [theme, setTheme] = useState<PhoneTheme>("light");
  useEffect(() => setTheme(readTheme()), []);
  const pick = (t: PhoneTheme) => {
    applyTheme(t);
    setTheme(t);
  };
  return (
    <div className="m-theme" role="group" aria-label={label}>
      <span className="m-kicker">{label}</span>
      <div className="m-theme-row">
        <button type="button" className="m-theme-btn" aria-pressed={theme === "dark"} onClick={() => pick("dark")}>Dark</button>
        <button type="button" className="m-theme-btn" aria-pressed={theme === "light"} onClick={() => pick("light")}>Light</button>
      </div>
    </div>
  );
}
