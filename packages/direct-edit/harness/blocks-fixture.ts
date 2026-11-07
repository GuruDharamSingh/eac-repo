import { Component, createElement, useEffect, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { Render } from "@puckeditor/core/rsc";
import { SHARED_BLOCKS } from "/app/packages/blocks/src/index";
import { defineBlock } from "/app/packages/blocks/src/registry";
import { contractOf } from "/app/packages/blocks/src/contract";
import { buildPuckConfig } from "/app/packages/page-builder/src/config";
import { cleanBoxDoc } from "/app/packages/direct-edit/src/block/puck-tree";
import { mountTreePage, BOX_BLOCKS, BOX_ROOT } from "/app/packages/direct-edit/src/puck/index";
import { MorphMark } from "/app/packages/direct-edit/src/puck/morph-mark";
import { banner as ptBanner } from "/app/apps/sunjay/src/blocks/layout-blocks";

// Harness only: no shared block throws on this page, so the stand-in needs one that does.
// The word "heal" lets it draw, so a stand-in can come and go while a field holds focus (P18).
// __lateThrow makes it throw after it mounted, from its own state update (C13).
const testThrow = defineBlock(
  { id: "test-throw", label: "Test: breaks on purpose", description: "Harness only.", props: [{ name: "word", kind: "string", label: "Word", description: "Type heal and it draws.", default: "" }] as const, memberSafe: true, styling: "tokens", category: "content" },
  function Broken({ word }: { word?: string }) {
    const [late, setLate] = useState(false);
    useEffect(() => { if (!(globalThis as any).__lateThrow) return; const t = setTimeout(() => setLate(true), 60); return () => clearTimeout(t); }, []);
    if (late) throw new Error("Broken on purpose");
    if ((globalThis as any).__healed || word === "heal") return createElement("div", null, "Healed");
    throw new Error("Broken on purpose");
  },
);
// pt-banner is sunjay's Tailwind block, with its CSS inlined (sunjay-banner.css): it must behave as a tokens block does.
const blocks: any[] = [...SHARED_BLOCKS, ptBanner, testThrow];
export const blocksConfig: any = buildPuckConfig({ blocks: [...blocks, ...(BOX_BLOCKS as any)] as any, root: BOX_ROOT as any, morph: MorphMark as any });
export const blocksContract = contractOf(blocks);

const pic = (fill: string, name: string) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="${fill}"/><text x="20" y="44" font-family="Georgia,serif" font-size="26" fill="#ffffff">${name}</text></svg>`)}`;
const picture = (fill: string, caption: string) => ({ src: pic(fill, caption), alt: caption, caption, href: "", at: "", color: "" });

export const BLOCKS_SEED: any = {
  root: { props: { title: "Blocks test" } },
  content: [
    { type: "hero-banner", props: { id: "hero", title: "The Ambrosial Hours", subtitle: "Rise with the sun", imageUrl: pic("#55708a", ""), imageAlt: "", align: "center", height: 0 } },
    { type: "section-heading", props: { id: "head", title: "Recent work", eyebrow: "This season", subtitle: "", level: "h2", align: "start", rule: true } },
    { type: "picture-wall", props: { id: "wall", min: 220, shape: "auto", gap: "regular", captionPlace: "below", captionAt: "bottom-left", captionShow: "always", captionWeight: "regular", captionFont: "caption", captionSize: "theme", captionColor: "", captionScrim: "soft",
      pictures: [picture("#39475a", "Nightjar"), picture("#6d5a44", "Three Vessels"), picture("#8c6f5a", "Low Winter Sun"), picture("#44604f", "Fen Road"), picture("#5a4660", "Tide Table"), picture("#7a4a3c", "Kiln Door")] } },
    { type: "faq", props: { id: "faq", look: "divided", openFirst: true, items: [
      { question: "Is there a fee?", answer: "No. Bring paper and charcoal." },
      { question: "Can I come once?", answer: "Yes. Come when you can." },
      { question: "Where do we meet?", answer: "The address goes out by mail the day before." },
    ] } },
    { type: "grid", props: { id: "grid1", columns: "2", minWidth: 220, gap: "regular", align: "stretch", items: [
      { type: "prose", props: { id: "prose1", body: "A text block inside a grid." } },
      { type: "quote", props: { id: "quote1", text: "A quote block inside a grid." } },
    ] } },
    { type: "box", props: { id: "box1", tag: "section", look: { layout: "stack", dir: "column", gap: 10, padding: 16, fill: "#ddeeff" }, items: [
      { type: "words", props: { id: "w1", tag: "h2", html: "An own box, to compare its rows" } },
      { type: "words", props: { id: "w2", tag: "p", html: "Select this box, then the hero. The rows should look the same." } },
    ] } },
    { type: "feature-card", props: { id: "card", title: "Three Vessels", body: "Fired in the old kiln over two winters.", kicker: "Work", meta: "2026", marker: "01", image: "", href: "", record: "", tone: "panel" } },
    { type: "pt-banner", props: { id: "ptb", title: "Para Theater", subtitle: "Rock balancing, qi gong and conscious creativity", body: "We meet on the first Sunday of the month.", ctaLabel: "Come along", ctaHref: "#", imageUrl: pic("#3a4a55", "Rocks"), imageAlt: "", scrim: 60, align: "center", size: "compact", height: 0 } },
  ],
};

export function mountBlocksView(host: HTMLElement, o: { doc: any; onSave(d: any): Promise<{ ok: boolean }>; onDone?(): void }) {
  return mountTreePage({ host, config: blocksConfig, doc: o.doc, contract: blocksContract as any, pageName: "Blocks test", onSave: o.onSave, onDone: o.onDone });
}

// ---------------------------------------------------------------- test bar
const SHOW_CSS = `
html:has(#tt-show){overflow:hidden}
#tt-show{position:fixed;inset:0;z-index:2147483004;display:flex;flex-direction:column;background:#fbf7ef;color:#1d1a16;overscroll-behavior:contain}
#tt-show .tt-show-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:calc(8px + env(safe-area-inset-top,0px)) max(16px,env(safe-area-inset-right,0px)) 8px max(16px,env(safe-area-inset-left,0px));background:#1c2024;color:#fff;font:13px system-ui,sans-serif}
#tt-show [data-tt=close]{font:inherit;color:#fff;background:#0a7ea4;border:0;border-radius:5px;padding:5px 12px;cursor:pointer}
#tt-show [data-tt=close]:focus-visible{outline:2px solid #fff;outline-offset:1px}
#tt-show .tt-show-body{flex:1;min-height:0;overflow:auto}
#tt-show pre{margin:0;padding:16px;font:12px/1.5 ui-monospace,Menlo,monospace;white-space:pre-wrap;overflow-wrap:anywhere}
#tt-show .tt-show-note{margin:0;padding:16px;font:13px system-ui,sans-serif}
#tt-show .tt-show-page{padding:16px}
`;

/** A published page has no stand-in, so the test block's throw would otherwise leave this overlay blank. */
class PublishedBoundary extends Component<{ children: ReactNode }, { message: string | null }> {
  state = { message: null as string | null };
  static getDerivedStateFromError(e: unknown) { return { message: e instanceof Error ? e.message : String(e) }; }
  render() { return this.state.message === null ? this.props.children : createElement("p", { className: "tt-show-note" }, `A block failed while drawing: ${this.state.message}. Published pages have no stand-in for it.`); }
}

/**
 * Fills the bar with "Show saved document" and "Show as published". Both open one overlay.
 * The overlay's two attributes keep the canvas's clicks and the editor's keys out of it; Undo's
 * Ctrl+Z is not behind those attributes, so keys are stopped at the window while it is open.
 */
export function mountBlocksActions(bar: HTMLElement, o: { editor(): { doc(): any; select(id: string | null): void }; saved(): any }): () => void {
  bar.innerHTML = '<button type="button" data-tt="saved-doc">Show saved document</button><button type="button" data-tt="published">Show as published</button>';
  let close: (() => void) | null = null;
  const open = (opener: HTMLElement, title: string, fill: (body: HTMLElement) => () => void) => {
    close?.();
    // Close returns to this: comparing with the published page must not cost the selection (plan 5, section 8, steps 4 and 5).
    const was = document.querySelector<HTMLElement>(".de-layers li.on")?.dataset.row ?? null;
    o.editor().select(null);
    const show = document.createElement("div");
    show.id = "tt-show";
    show.setAttribute("data-de-ui", "");
    show.setAttribute("data-de-menu", "");
    show.setAttribute("role", "dialog");
    show.setAttribute("aria-modal", "true");
    show.setAttribute("aria-label", title);
    show.innerHTML = `<style>${SHOW_CSS}</style><div class="tt-show-bar"><b>${title}</b><button type="button" data-tt="close">Close</button></div><div class="tt-show-body"></div>`;
    document.body.appendChild(show);
    const empty = fill(show.querySelector<HTMLElement>(".tt-show-body")!);
    const keys = (ev: KeyboardEvent) => { ev.stopPropagation(); if (ev.key === "Escape") { ev.preventDefault(); close?.(); } };
    window.addEventListener("keydown", keys, true);
    close = () => { close = null; window.removeEventListener("keydown", keys, true); empty(); show.remove(); o.editor().select(was); if (opener.isConnected) opener.focus(); };
    const closeButton = show.querySelector<HTMLElement>('[data-tt="close"]')!;
    closeButton.addEventListener("click", () => close?.());
    closeButton.focus();
  };
  const onClick = (ev: Event) => {
    const b = (ev.target as Element).closest<HTMLElement>("[data-tt]");
    if (b?.dataset.tt === "saved-doc") open(b, "Saved document", (body) => {
      const seed = o.saved() === BLOCKS_SEED;
      body.innerHTML = `${seed ? '<p class="tt-show-note">Nothing saved yet. This is the document the page started from.</p>' : ""}<pre></pre>`;
      body.querySelector("pre")!.textContent = JSON.stringify(o.saved(), null, 2);
      return () => {};
    });
    if (b?.dataset.tt === "published") open(b, "As published", (body) => {
      // The canvas's own side padding, so the two compare by eye.
      const page = body.appendChild(document.createElement("div"));
      page.className = "tt-show-page";
      const root = createRoot(page);
      root.render(createElement(PublishedBoundary, null, createElement(Render as any, { config: blocksConfig, data: cleanBoxDoc(o.editor().doc()) })));
      return () => root.unmount();
    });
  };
  bar.addEventListener("click", onClick);
  return () => { close?.(); bar.removeEventListener("click", onClick); bar.replaceChildren(); };
}
