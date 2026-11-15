// Screenshot the hub-card harness pages through a Chrome container's CDP (by IP).
// node shot.mjs <chrome ip> [comma list of name or name-phone]
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
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  }
  if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails?.exception?.description?.slice(0, 300) ?? "exception");
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push("console: " + m.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 300));
});
const send = (method, params = {}) =>
  new Promise((r) => {
    const id = ++n;
    pending.set(id, r);
    ws.send(JSON.stringify({ id, method, params }));
  });
await send("Runtime.enable");
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
const shots = [
  ["face", 1280, 700], ["face", 390, 844, "phone"],
  ["panel", 1280, 900], ["panel", 390, 844, "phone"],
  ["panel-week", 1280, 900],
  ["panel-piece", 1280, 900], ["panel-piece", 390, 844, "phone"],
  ["panel-cell", 1280, 900], ["panel-cell", 390, 844, "phone"],
  ["panel-cell-closed", 1280, 900],
];
for (const [name, w, h, tag] of shots) {
  if (only && !only.includes(name + (tag ? "-" + tag : ""))) continue;
  errors = [];
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: w < 500 });
  await send("Page.navigate", { url: `file:///out/${name}.html` });
  await new Promise((r) => setTimeout(r, 3500));
  const m = await send("Runtime.evaluate", { expression: "JSON.stringify({nest: window.__nest ?? null, sw: document.documentElement.scrollWidth, dlg: document.querySelector('dialog.eac-surface')?.scrollWidth ?? null})", returnByValue: true });
  const dims = JSON.parse(m.result.result.value);
  const shot = await send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: w, height: h, scale: 1 } });
  const file = `/png/hubcard-${name}${tag ? "-" + tag : ""}-${w}.png`;
  writeFileSync(file, Buffer.from(shot.result.data, "base64"));
  console.log(file, JSON.stringify(dims), "errors", JSON.stringify(errors));
}
ws.close();
