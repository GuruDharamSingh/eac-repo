// Canvas lane (2026-11-22): a sealed block's bottom edge writes its declared `resize` setting; words typed on the canvas.
// The page is view-blocks' seed through the checked door (contentTab + setProp), as a host mounts it.
import { BLOCKS_SEED, blocksConfig, blocksContract } from "./blocks-fixture";
import { mountTreePage } from "/app/packages/direct-edit/src/puck/index";
import { contentDoor } from "/app/packages/house-editor/src/content-door";
import { morphCss } from "/app/packages/direct-edit/src/block/morph";
const w = window as any;
w.saved = [];
w.morphCss = morphCss;
const on = location.hash !== "#off";
// A banner that also carries a height on its root look, as a page edited before this lane may.
const seed: any = JSON.parse(JSON.stringify(BLOCKS_SEED));
const doc: any = { ...seed, content: seed.content.map((n: any) => (n.props.id === "ptb" ? { ...n, props: { ...n.props, height: 200 } } : n)) };
const host = document.getElementById("host")!;
w.ed = mountTreePage({
  host, config: blocksConfig, doc, contract: blocksContract as any, pageName: "Resize test",
  onSave: async (d: any) => { w.saved.push(d); return { ok: true }; },
  editSettings: async () => null,
  ...(on ? { contentTab: true, setProp: contentDoor(blocksContract) } : {}),
} as any);
