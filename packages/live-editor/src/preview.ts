/**
 * The one live-preview <style> tag every style panel writes through.
 *
 * Shared on purpose: a page may open several panels in one session (a pin on
 * the sidebar, then a pin on the gallery, then the full panel). Each writes
 * only the variables it edits, and the tag always renders the union, so
 * changing the frame colour in one place never blanks a text colour previewed
 * in another. Cancel restores a panel's variables to their last committed
 * values — not to the app default — so an unsaved experiment disappears and
 * the saved look comes back.
 */
const TAG_ID = "lve-theme-preview";
const vars = new Map<string, string>();

function tag(): HTMLStyleElement | null {
  if (typeof document === "undefined") return null;
  let el = document.getElementById(TAG_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = TAG_ID;
    document.head.appendChild(el);
  }
  return el;
}

function flush() {
  const el = tag();
  if (!el) return;
  const css = [...vars.entries()].map(([k, v]) => `  ${k}: ${v};`).join("\n");
  el.textContent = vars.size ? `:root {\n${css}\n}` : "";
}

export function setPreviewVars(next: Record<string, string>) {
  for (const [k, v] of Object.entries(next)) vars.set(k, v);
  flush();
}

export function clearPreviewVars(names: string[]) {
  for (const n of names) vars.delete(n);
  flush();
}
