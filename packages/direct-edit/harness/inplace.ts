// In place (2026-11-23): double-click goes one level in, in the same window; Esc one level out; no popup (largeView off by default);
// a part that repeats says it applies to every one; words typed in place, or a record's field opened where it stands.
// inplace.html (popup off) and inplace.html#large (the off switch turned on again).
import { createElement } from "react";
import { SHARED_BLOCKS } from "/app/packages/blocks/src/index";
import { defineBlock } from "/app/packages/blocks/src/registry";
import { contractOf } from "/app/packages/blocks/src/contract";
import { buildPuckConfig } from "/app/packages/page-builder/src/config";
import { mountTreePage, BOX_BLOCKS, BOX_ROOT } from "/app/packages/direct-edit/src/puck/index";
import { MorphMark } from "/app/packages/direct-edit/src/puck/morph-mark";
import { banner as ptBanner } from "/app/apps/sunjay/src/blocks/layout-blocks";
import { contentDoor } from "/app/packages/house-editor/src/content-door";
import { openRecordField } from "/app/packages/house-editor/src/fields/open-record";
import { elktoursFieldsRegistry } from "/app/apps/elktours/src/lib/tour-fields-registry";

const w = window as any;
w.saved = [];
w.opened = [];
w.loads = [];
w.saves = [];

// A stand-in for elktours' tour cards: data driven, parts that repeat, a title that says which record it comes from.
const TITLES = ["Paris by night", "Montmartre", "Left Bank"];
const tourList = defineBlock(
  {
    id: "tour-list-test", label: "Tour list", description: "Harness only.", memberSafe: true, dataDriven: true, styling: "tokens", category: "content",
    props: [{ name: "count", kind: "number", label: "How many", default: 3, min: 1, max: 6, step: 1 }] as const,
    parts: {
      card: { label: "Card", sel: ".tl-card", repeat: true },
      kicker: { label: "Card kicker", sel: ".tl-kicker", repeat: true },
      title: { label: "Card title", sel: ".tl-title", repeat: true },
      price: { label: "Card price", sel: ".tl-price", repeat: true },
    },
  },
  function TourList({ count }: { count?: number }) {
    return createElement("div", { className: "tl-root", style: { padding: 24, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, background: "#f3ede2" } },
      TITLES.slice(0, count ?? 3).map((t, i) => createElement("div", { key: t, className: "tl-card", style: { background: "#fff", padding: 16 } },
        createElement("p", { className: "tl-kicker", style: { margin: 0, fontSize: 12 } }, "2 h"),
        createElement("h3", { className: "tl-title", style: { margin: "4px 0", fontSize: 22 }, "data-words-from": `record:tour:t${i + 1}:title` }, t),
        createElement("span", { className: "tl-price" }, "EUR 40"))));
  },
  () => ({ count: 3 }),
);
const blocks: any[] = [...SHARED_BLOCKS, ptBanner, tourList];
const config: any = buildPuckConfig({ blocks: [...blocks, ...(BOX_BLOCKS as any)] as any, root: BOX_ROOT as any, morph: MorphMark as any });
const contract: any = contractOf(blocks);

const doc: any = {
  root: { props: { title: "In place test" } },
  content: [
    { type: "pt-banner", props: { id: "ptb", title: "Para Theater", subtitle: "Rock balancing", body: "We meet monthly.", ctaLabel: "Come along", ctaHref: "#", imageUrl: "", imageAlt: "", scrim: 60, align: "center", size: "compact", height: 0 } },
    { type: "tour-list-test", props: { id: "tl", count: 3 } },
    { type: "section-heading", props: { id: "head", title: "Recent work", eyebrow: "This season", subtitle: "", level: "h2", align: "start", rule: true } },
  ],
};
const large = location.hash === "#large";
const host = document.getElementById("host")!;
w.ed = mountTreePage({
  host, config, doc, contract, pageName: "In place test",
  onSave: async (d: any) => { w.saved.push(d); return { ok: true }; },
  editSettings: async () => null,
  contentTab: true, setProp: contentDoor(contract),
  // The real record panel (the Fields lens's own), with stand-in doors: a load that returns the tour's words, a save that is refused (as the signed-in run aborts it).
  recordWords: {
    open: (ref: string) => {
      w.opened.push(ref);
      openRecordField({
        registry: elktoursFieldsRegistry,
        load: async (a: any) => { w.loads.push(a); return { ok: true, values: { title: TITLES[Number(String(a.id).slice(1)) - 1] ?? "", excerpt: "", goodToKnow: "", contact: "" }, version: "v1" }; },
        save: async (i: any) => { w.saves.push(i); return { ok: false, error: "Not saved: refused in this test." }; },
      } as any, ref);
    },
  },
  ...(large ? { largeView: true } : {}),
} as any);
