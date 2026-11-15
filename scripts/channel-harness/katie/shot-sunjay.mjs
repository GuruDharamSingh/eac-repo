// Screenshot the katie harness pages through a Chrome container's CDP (by IP).
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
  ["home", 1280, 1100], ["home", 390, 844, "phone"], ["home-list", 1280, 1100], ["home-week", 1280, 1100],
  ["board", 1280, 800], ["board-cell", 1280, 800], ["board-cell", 390, 844, "phone"],
  ["board-summary", 1280, 900], ["board-edit", 1280, 800],
  ["queue", 1280, 900], ["queue", 390, 844, "phone"], ["queue-cell", 1280, 800], ["queue-kind", 1280, 800],
  ["queue-piece", 1280, 1000], ["library", 1280, 800], ["library", 390, 844, "phone"],
];
for (const [name, w, h, tag] of shots) {
  if (only && !only.includes(name + (tag ? "-" + tag : ""))) continue;
  errors = [];
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: w < 500 });
  await send("Page.navigate", { url: `file:///out-sunjay/${name}.html` });
  await new Promise((r) => setTimeout(r, 2500));
  const m = await send("Runtime.evaluate", { expression: "JSON.stringify({sw: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight})", returnByValue: true });
  const dims = JSON.parse(m.result.result.value);
  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: w, height: Math.min(Math.max(dims.h, h), 2400), scale: 1 } });
  const file = `/png/sunjay-${name}${tag ? "-" + tag : ""}-${w}.png`;
  writeFileSync(file, Buffer.from(shot.result.data, "base64"));
  console.log(file, "scrollWidth", dims.sw, "viewport", w, "height", dims.h, "errors", JSON.stringify(errors));
}
ws.close();
