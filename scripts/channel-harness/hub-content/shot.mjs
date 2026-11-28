// Screenshot the hub-content harness pages through a Chrome container's CDP (by IP), at 1280 and 390.
// node shot.mjs <chrome ip> [comma list of page names]
import { writeFileSync } from "node:fs";
const ip = process.argv[2];
const only = process.argv[3]?.split(",");
const list = await (await fetch(`http://${ip}:9222/json/list`)).json();
const target = list.find((t) => t.type === "page");
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let n = 0;
const pending = new Map();
let errors = [];
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails?.exception?.description?.slice(0, 300) ?? "exception");
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push("console: " + m.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 300));
});
const send = (method, params = {}) => new Promise((r) => { const id = ++n; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result.result.value;
await send("Runtime.enable");
const pages = ["face", "list-site", "list-network", "piece", "edit", "suggest"];
for (const name of pages) for (const w of [1280, 390]) {
  if (only && !only.includes(name)) continue;
  errors = [];
  const h = w > 500 ? 900 : 844;
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: w < 500 });
  await send("Page.navigate", { url: `file:///out/${name}.html` });
  await new Promise((r) => setTimeout(r, 3200));
  const info = await ev(`JSON.stringify({sw: document.documentElement.scrollWidth, panelOverflowX: (document.querySelector('.hp-panel')||{}).scrollWidth > (document.querySelector('.hp-panel')||{}).clientWidth, tiles: document.querySelectorAll('.hp-tile').length, cols: (()=>{const g=document.querySelector('.hp-grid'); return g? getComputedStyle(g).gridTemplateColumns.split(' ').length : null})(), frame: (document.querySelector('.hp-frame:not([hidden]) .hp-title')||{}).textContent||null, edit: !!document.querySelector('.hp-edit form'), listbox: (()=>{const l=document.querySelector('[role=listbox]'); return l && !l.hidden ? l.querySelectorAll('[role=option]').length : 0})(), groups: [...document.querySelectorAll('.eac-c-suggest-group')].map(x=>x.textContent), log: window.__log})`);
  const shot = await send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: w, height: h, scale: 1 } });
  const file = `/png/hubcontent-${name}-${w}.png`;
  writeFileSync(file, Buffer.from(shot.result.data, "base64"));
  console.log(file, info, "errors", JSON.stringify(errors));
}
ws.close();
