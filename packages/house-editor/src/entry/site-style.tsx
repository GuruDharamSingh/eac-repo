"use client";

// Site style, opened from the Edit button's family (2026-11-23, lane LIVE). Hosts direct-edit's SiteStyleEditor as it is:
// its own schema, its own save, its own Close. Inside the page editor it sits in the right-hand column, where the panel is
// (CSS below); on a page with no in-place editor it is the drawer it always was.
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { SiteStyle, SiteStyleSchema } from "@elkdonis/direct-edit/site";

export interface SiteStyleHost {
  schema: SiteStyleSchema;
  initial: SiteStyle | null;
  /** The site's own save (the editor-gated server action); the editor reads `ok` and `error` from it. */
  save(style: SiteStyle | null): Promise<{ ok: boolean; error?: string }>;
}

const COLUMN_CSS = `[data-ss-host="column"] aside[data-site-style-ui]{top:50px!important;right:8px!important;bottom:8px!important;width:330px!important;border-radius:12px!important;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,.1),0 3px 14px rgba(0,0,0,.12)!important;border-left:0!important}`;

let open: { root: Root; el: HTMLElement } | null = null;
let current: SiteStyle | null | undefined;

/** One editor at a time. `where: "column"` sits it in the page editor's right-hand column. */
export async function openSiteStyle(h: SiteStyleHost, where: "column" | "drawer"): Promise<void> {
  if (open) return;
  const mod = await import("@elkdonis/direct-edit/site/editor");
  if (current === undefined) current = h.initial;
  const el = document.createElement("div");
  el.dataset.ssHost = where;
  el.dataset.deUi = "";
  if (where === "column" && !document.getElementById("ee-column-css")) {
    // In the head, not in the host: React clears what is inside a root when it first renders.
    const css = document.createElement("style");
    css.id = "ee-column-css";
    css.textContent = COLUMN_CSS;
    document.head.append(css);
  }
  document.body.append(el);
  const root = createRoot(el);
  open = { root, el };
  const close = () => {
    const o = open;
    open = null;
    // Not during a React commit: the editor's own Close button may be calling this.
    setTimeout(() => { o?.root.unmount(); o?.el.remove(); }, 0);
  };
  root.render(
    createElement(mod.SiteStyleEditor, {
      schema: h.schema,
      initial: current ?? null,
      onSave: async (style: SiteStyle | null) => {
        const res = await h.save(style);
        if (res.ok) current = style;
        return res;
      },
      onClose: close,
    }),
  );
}

let provided: SiteStyleHost | null = null;
/** The site's mount hands over its schema, saved style and save once; the button and the page editor then open it without props. */
export function provideSiteStyle(h: SiteStyleHost | null): void {
  provided = h;
}
export const hasSiteStyle = (): boolean => provided !== null;
export function openProvidedSiteStyle(where: "column" | "drawer"): Promise<void> {
  return provided ? openSiteStyle(provided, where) : Promise.resolve();
}
