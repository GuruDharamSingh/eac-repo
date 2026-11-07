"use client";

import type { PagePatches } from "../block/patch";
import type { PuckDoc } from "../block/puck-tree";
import { adoptChildren } from "../canvas/adopt";
import { sectionOf, selectorFor } from "../canvas/layers";
import { mountTreePage, type TreePageOptions } from "./mount";

const newId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

export interface OpenPageOptions extends Omit<TreePageOptions, "host" | "doc" | "metadata"> {
  /** The element that holds the page as drawn by its code. */
  root: HTMLElement;
  /** The stored tree, or null to make one from what the page drew. */
  tree: PuckDoc | null;
  /** Style edits made before the page was a tree, carried over. */
  edits?: PagePatches;
  title?: string;
  /** Classes a script would have changed by now. */
  classes?(list: string[]): string[];
}

/**
 * A code-built page as a tree of boxes. The first time, what the page drew becomes the
 * tree, and nothing changes for visitors until it is saved. Elements marked
 * `data-landing-part` stay live and are shown here as they were just drawn. The page
 * stays underneath, hidden; the host reloads to come back to it.
 */
export function openPageAsTree(o: OpenPageOptions) {
  const { root, tree, edits, title, classes, ...rest } = o;
  const parts: Record<string, string> = {};
  root.querySelectorAll<HTMLElement>("[data-landing-part]").forEach((e) => { parts[e.dataset.landingPart!] = e.outerHTML; });
  const skipped: string[] = [];
  const doc: PuckDoc = tree ?? {
    root: { props: { title: title ?? "Page" } },
    content: adoptChildren(root, {
      newId,
      skipped,
      classes,
      part: (el) => (el.dataset.landingPart ? { part: el.dataset.landingPart, label: el.dataset.editName } : null),
      edits(el) {
        const section = sectionOf(el);
        return section ? edits?.boxes[selectorFor(el, section)] ?? null : null;
      },
    }),
  };
  const host = document.createElement("div");
  host.className = root.className;
  root.after(host);
  root.style.display = "none";
  const editor = mountTreePage({ ...rest, host, doc, metadata: { parts } });
  return { ...editor, skipped };
}

export interface VisitorPageOptions extends Omit<OpenPageOptions, "edits" | "classes"> {
  /** Finds the page's root in the HTML a signed-out visitor gets. */
  selector: string;
}

/**
 * A page that draws differently for a signed-in person, opened from what a signed-out visitor gets: the same
 * request with no cookies, so an editor's name, buttons and member links never reach the tree or the stored row.
 * Reads no layout. Elements marked `data-landing-part` stay live, as in openPageAsTree. Elements marked
 * `data-landing-block` are sealed blocks of that type: they draw their own root, so they hold only what is inside
 * it, and a look on them is stored as `morph`. Throws when the page cannot be read that way, and the editor stays shut.
 */
export async function openVisitorPage(o: VisitorPageOptions) {
  const { root, selector, tree, title, ...rest } = o;
  // No `accept: text/html`: on plain http a browser sends no Sec-Fetch headers, so the network sign-on takes a request asking for HTML as a page visit and redirects it to another host (2026-11-05). `manual` reports a redirect here instead of failing on that host's CORS rules.
  const res = await fetch(location.href, { credentials: "omit", cache: "no-store", redirect: "manual" });
  if (!res.ok) throw new Error(`A visitor's copy of this page is not available (${res.type === "opaqueredirect" ? "redirected" : res.status}).`);
  const from = new DOMParser().parseFromString(await res.text(), "text/html").querySelector<HTMLElement>(selector);
  if (!from) throw new Error(`A visitor's copy of this page has no ${selector}.`);
  const parts: Record<string, string> = {};
  from.querySelectorAll<HTMLElement>("[data-landing-part]").forEach((e) => { parts[e.dataset.landingPart!] = e.outerHTML; });
  from.querySelectorAll<HTMLElement>("[data-landing-block]").forEach((e) => { parts[e.dataset.landingBlock!] = e.innerHTML; });
  const skipped: string[] = [];
  const doc: PuckDoc = tree ?? {
    root: { props: { title: title ?? "Page" } },
    content: adoptChildren(from, {
      newId,
      skipped,
      part: (el) => (el.dataset.landingPart ? { part: el.dataset.landingPart, label: el.dataset.editName } : null),
      existing: (el) => (el.dataset.landingBlock ? { type: el.dataset.landingBlock, props: { id: newId("live") } } : null),
    }),
  };
  const host = document.createElement("div");
  host.className = root.className;
  root.after(host);
  root.style.display = "none";
  const editor = mountTreePage({ ...rest, host, doc, metadata: { parts } });
  return { ...editor, skipped };
}
