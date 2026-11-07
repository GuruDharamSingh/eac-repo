import { BLOCKS_SEED, blocksConfig, blocksContract, mountBlocksActions, mountBlocksView } from "./blocks-fixture";
import { mountTreePage } from "/app/packages/direct-edit/src/puck/index";
const w = window as any;
w.kit = { config: blocksConfig, contract: blocksContract };
w.saved = [];

// #review: the stone 2 review notes, which no shared block reaches. A contract with props that must get no field, a colour
// prop with a colon in its name and two parts selecting one element; stored nodes whose type is an Object.prototype name
// or no block at all.
const review = location.hash === "#review";
const heading = (blocksContract as any)["section-heading"];
const reviewContract: any = { ...blocksContract, "section-heading": { ...heading,
  parts: { ...heading.parts, again: { label: "Again", sel: ".blk-heading-title" } },
  props: [
    ...heading.props,
    ...["id", "puck", "editMode", "children", "morph"].map((name) => ({ name, kind: "string", label: `Field for ${name}`, group: "content" })),
    { name: "tone:deep", kind: "string", format: "color", label: "Colon colour", group: "look" },
  ],
} };
const reviewDoc: any = { ...BLOCKS_SEED, content: [...BLOCKS_SEED.content,
  { type: "constructor", props: { id: "ctor" } },
  { type: "__proto__", props: { id: "proto" } },
  { type: "toString", props: { id: "tostr" } },
  { type: "grid", props: { id: "gridU", columns: "2", minWidth: 220, gap: "regular", align: "stretch", items: [
    { type: "no-such-block", props: { id: "gone" } },
    { type: "words", props: { id: "wU", tag: "p", html: "Words beside it" } },
  ] } },
] };

let doc = review ? reviewDoc : BLOCKS_SEED;
const slot = document.getElementById("host")!;
function open() {
  const host = document.createElement("div");
  slot.replaceChildren(host);
  const onSave = async (d: any) => { doc = d; w.saved.push(d); return { ok: true }; };
  w.ed = review
    ? mountTreePage({ host, config: blocksConfig, doc, contract: reviewContract, pageName: "Blocks test", onSave })
    : mountBlocksView(host, { doc, onSave });
}
w.remount = () => { w.ed.dispose(); open(); };
open();
mountBlocksActions(document.getElementById("tt-acts")!, { editor: () => w.ed, saved: () => doc });
