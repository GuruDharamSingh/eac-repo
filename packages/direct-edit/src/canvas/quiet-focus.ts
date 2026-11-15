// ============================================================================
// The page's own controls out of the Tab order while it is edited (2026-11-14, item 5a;
// replaces `inert`, which also stopped part picking). A link, button, field, embed or
// editable element a block draws stays where it is and still takes a click (the editor
// reads the click), but Tab and Shift+Tab move through the editor's chrome instead of
// landing inside a block. Each element's own `tabindex` is remembered exactly (a value,
// or none) and put back on dispose, so the page's DOM after Done is what it was before.
//
// The editor's chrome is never touched: anything inside `[data-de-ui]` or
// `[data-edit-skip]`. Re-applied to whatever a re-render adds, and to an element whose
// own code sets its tabindex again. The editor's own typing in place (contenteditable set
// by canvas/interact.ts) is not a mutation this watches, so it is left alone.
// ============================================================================

const FOCUSABLE = [
  "a[href]",
  "area[href]",
  "button",
  "input",
  "select",
  "textarea",
  "iframe",
  "audio[controls]",
  "video[controls]",
  "summary",
  "[tabindex]",
  "[contenteditable]:not([contenteditable='false'])",
].join(",");
const CHROME = "[data-de-ui], [data-edit-skip]";
const QUIET = "-1";

export interface QuietFocus {
  /** Puts every element's own tabindex back (or removes the one this added) and stops watching. */
  dispose(): void;
}

export function quietFocus(scope: HTMLElement): QuietFocus {
  /** Element → its own tabindex before the editor came (null: it had none). */
  const was = new Map<Element, string | null>();

  const quiet = (el: Element) => {
    if (el.closest(CHROME)) return;
    const now = el.getAttribute("tabindex");
    if (now === QUIET && was.has(el)) return;
    if (!was.has(el)) was.set(el, now);
    else if (now !== QUIET) was.set(el, now); // the page's own code set it again: that is its value now
    el.setAttribute("tabindex", QUIET);
  };
  const scan = (root: Element) => {
    if (root.matches(FOCUSABLE)) quiet(root);
    root.querySelectorAll(FOCUSABLE).forEach(quiet);
  };

  scan(scope);
  const watch = new MutationObserver((records) => {
    // Records arrive after the write; this module's own write carries "-1" and is passed over below.
    for (const r of records) {
      if (r.type === "childList") r.addedNodes.forEach((n) => { if (n instanceof Element) scan(n); });
      else if (r.type === "attributes" && r.target instanceof Element && r.target.getAttribute("tabindex") !== QUIET) quiet(r.target);
    }
  });
  watch.observe(scope, { childList: true, subtree: true, attributes: true, attributeFilter: ["tabindex"] });

  return {
    dispose() {
      watch.disconnect();
      for (const [el, value] of was) {
        if (value === null) el.removeAttribute("tabindex");
        else el.setAttribute("tabindex", value);
      }
      was.clear();
    },
  };
}
