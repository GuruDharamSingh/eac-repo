// Plain module (no "use client"): app/layout.tsx is a server component and needs these values, not client references.

/** localStorage key for the phone light/dark choice (components/mobile/phone-theme.tsx). Stores "dark" only: light is the default (2026-11-22). */
export const PHONE_THEME_KEY = "elk-m-theme";

/** Runs before first paint, so the default light look does not flash dark on load; only a stored "dark" skips it. */
export const phoneThemeScript = `var t=null;try{t=localStorage.getItem("${PHONE_THEME_KEY}")}catch(e){}if(t!=="dark")document.documentElement.setAttribute("data-m-theme","light")`;
