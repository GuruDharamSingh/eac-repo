import { mountVisualEditor } from "/app/packages/direct-edit/src/index";
import { mountTreePage, openPageAsTree, BOX_BLOCKS, BOX_ROOT } from "/app/packages/direct-edit/src/puck/index";
import { SHARED_BLOCKS } from "/app/packages/blocks/src/index";
import { buildPuckConfig } from "/app/packages/page-builder/src/config";
import { classifieds } from "./sample";
import { emptyPatches, cleanPatches, type PagePatches } from "/app/packages/direct-edit/src/block/patch";
import { mountClassifiedsEditor } from "/app/apps/arts-collective/src/lib/classifieds/editor-engine";
import { starterDoc } from "/app/apps/arts-collective/src/lib/classifieds/catalog";
import { CARD_LABELS, CARD_TEMPLATES, FEED_FIELDS, FEED_FIELD_KINDS, SAMPLE_ITEMS, cardsToSheet, starterCards } from "/app/apps/arts-collective/src/lib/cards/catalog";
import { BLOCKS_SEED, mountBlocksActions, mountBlocksView } from "./blocks-fixture";

const fixture = document.getElementById("fixture")!;
const PAGE = fixture.innerHTML;
fixture.remove();
const stage = document.getElementById("stage")!;
const acts = document.getElementById("tt-acts")!;
const views = ["blocks", "landing", "tree", "page", "cards", "sheet"];
const landData = JSON.parse(document.getElementById("land-data")!.textContent || "{}");
const inView = (l: string[]) => (l.includes("reveal") && !l.includes("in-view") ? [...l, "in-view"] : l);
let landDoc: any = null;
const treeConfig: any = buildPuckConfig({ blocks: [...SHARED_BLOCKS, ...(BOX_BLOCKS as any)] as any, root: BOX_ROOT as any });
let treeDoc: any = classifieds;
let blocksDoc: any = BLOCKS_SEED;
let stop: (() => void) | null = null;
let pageDoc: PagePatches = emptyPatches();

function sheet() {
  const doc: any = starterDoc("Test org");
  const ad = doc.ads[0];
  ad.o.tree = [{ id: "header", kind: "header" }, { id: "n1", kind: "box", kids: [{ id: "title", kind: "title" }, { id: "n2", kind: "box", kids: [{ id: "price", kind: "price" }] }] }, { id: "body", kind: "body" }, { id: "contact", kind: "contact" }];
  ad.o.copy = { ...(ad.o.copy || {}), header: "For sale", title: "Oak easel", price: "$120", body: "Barely used.", contact: "Box 6" };
  return doc;
}
function show(v: string) {
  stop?.(); stop = null;
  stage.innerHTML = "";
  document.querySelectorAll<HTMLElement>("[data-v]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === v)));
  document.getElementById("land-css")?.remove();
  document.body.classList.toggle("tt-land", v === "landing");
  acts.hidden = v !== "blocks";
  if (v === "blocks") {
    stage.innerHTML = '<p class="tt-try" data-de-ui><b>New: double-click the hero below.</b> It opens large over the page, so you can restyle its parts and rearrange it (Stack, Row, Columns, or drag a part). Right-click a block for the same thing as a menu row.</p><div id="treehost" class="tt-tree tt-blocks"></div>';
    const ed = mountBlocksView(document.getElementById("treehost")!, { doc: blocksDoc, onSave: async (d) => { blocksDoc = d; return { ok: true }; }, onDone: () => show("blocks") });
    const unbar = mountBlocksActions(acts, { editor: () => ed, saved: () => blocksDoc });
    stop = () => { unbar(); ed.dispose(); };
  } else if (v === "landing") {
    const css = document.createElement("style"); css.id = "land-css"; css.textContent = landData.css; document.head.prepend(css);
    stage.innerHTML = landData.body;
    const root = stage.querySelector<HTMLElement>(".marketing-root")!;
    root.querySelectorAll(".reveal").forEach((e) => e.classList.add("in-view"));
    const ed = openPageAsTree({ root, tree: landDoc, edits: { v: 1, boxes: { '[data-edit-section="hero"]': { style: { fill: "#c60c0c" } } } } as any, title: "Landing page", pageName: "Landing page", classes: inView, config: treeConfig, onSave: async (d) => { landDoc = d; return { ok: true }; }, onDone: () => show("landing") });
    stop = () => ed.dispose();
  } else if (v === "tree") {
    stage.innerHTML = '<div id="treehost" class="tt-tree"></div>';
    const ed = mountTreePage({ host: document.getElementById("treehost")!, config: treeConfig, doc: treeDoc, onSave: async (d) => { treeDoc = d; return { ok: true }; }, onDone: () => show("tree") });
    stop = () => ed.dispose();
  } else if (v === "page") {
    stage.innerHTML = PAGE;
    const ed = mountVisualEditor({ doc: pageDoc, onSave: async (d) => { pageDoc = cleanPatches(d); return { ok: true }; }, onDone: () => show("page") });
    stop = () => ed.dispose();
  } else {
    const onSave = async () => ({ ok: true });
    stop = v === "cards"
      ? mountClassifiedsEditor(stage, { doc: cardsToSheet(starterCards()), orgName: "Test org", threads: [], viewUrl: "#", onSave, pattern: { items: SAMPLE_ITEMS, fields: FEED_FIELDS, fieldKinds: FEED_FIELD_KINDS, labels: CARD_LABELS, title: "Feed cards", templates: CARD_TEMPLATES, source: "Sample items" } })
      : mountClassifiedsEditor(stage, { doc: sheet(), orgName: "Test org", threads: [], viewUrl: "#", onSave });
  }
}
document.querySelectorAll<HTMLElement>("[data-v]").forEach((b) => b.addEventListener("click", () => show(b.dataset.v!)));
show(views.includes(location.hash.slice(1)) ? location.hash.slice(1) : "blocks");
