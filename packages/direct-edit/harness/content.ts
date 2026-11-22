// The Content tab (PLAN 9 step A): view-blocks' page with the tab on (#on) or off (#off), the checked door passed in as setProp.
import { BLOCKS_SEED, blocksConfig, blocksContract } from "./blocks-fixture";
import { mountTreePage } from "/app/packages/direct-edit/src/puck/index";
import { contentDoor } from "/app/packages/house-editor/src/content-door";
const w = window as any;
w.saved = [];
w.settingsCalls = [];
w.rowCalls = [];
w.pickerCalls = [];
const on = location.hash !== "#off";
const doc: any = { ...BLOCKS_SEED, content: [...BLOCKS_SEED.content, { type: "gallery-grid", props: { id: "gg", gap: "regular", columns: "3" } }] };
const host = document.getElementById("host")!;
w.ed = mountTreePage({
  host, config: blocksConfig, doc, contract: blocksContract as any, pageName: "Content test",
  onSave: async (d: any) => { w.saved.push(d); return { ok: true }; },
  choosePicture: (el, o) => { w.pickerCalls.push(o.value ?? ""); el.innerHTML = '<button type="button" data-test="pick-one">Use test picture</button>'; el.querySelector("button")!.addEventListener("click", () => o.onPick("/pic.png")); return () => { el.innerHTML = ""; }; },
  editSettings: async (node: any) => { w.settingsCalls.push(node.type); return null; },
  ...(on ? {
    contentTab: true,
    setProp: contentDoor(blocksContract),
    resolveRows: async (node: any) => { w.rowCalls.push({ type: node.type, props: JSON.parse(JSON.stringify(node.props)) }); return null; },
  } : {}),
} as any);
