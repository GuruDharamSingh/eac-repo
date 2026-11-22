// Plain module (no "use client"): app/layout.tsx is a server component and needs these values, not client references.

/** localStorage key for the phone light/dark choice (components/mobile/phone-theme.tsx). */
export const PHONE_THEME_KEY = "elk-m-theme";

/** Runs before first paint, so a light choice does not flash dark on load. */
export const phoneThemeScript = `try{if(localStorage.getItem("${PHONE_THEME_KEY}")==="light")document.documentElement.setAttribute("data-m-theme","light")}catch(e){}`;
