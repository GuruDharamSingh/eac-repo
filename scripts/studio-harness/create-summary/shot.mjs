// Screenshot the Studio Create + summary harness pages through a Chrome container's CDP (by IP).
// node shot.mjs <chrome ip> [comma list of name, name-phone or name-menu]
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
// Deterministic shots: the pop-up's slide-in replays when a capture extends the page (seen 2026-11-15).
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
// [page, width, height, tag, script run before the shot, extra wait in ms before it]
const shots = [
  ["create", 1440, 1000],
  ["create", 390, 844, "phone"],
  ["create", 1440, 1000, "more", "document.querySelectorAll('.studio-create__makemore summary')[1].click()"],
  ["create-dark", 1440, 1000],
  ["create-personal", 1280, 800],
  ["create-loading", 1280, 700],
  ["summary", 1440, 980],
  ["summary", 1440, 980, "menu", "document.querySelector('.ps-menu button').click()"],
  ["summary", 390, 844, "phone"],
  ["summary-dark", 1440, 980],
  ["summary-bare", 1280, 800],
  ["sheet", 1280, 980],
  ["sheet", 390, 844, "phone"],
  ["sheet-bare", 1280, 800],
  ["popup", 1280, 900],
  ["popup", 1280, 900, "menu", "document.querySelector('.ps-menu button').click()"],
  ["popup", 390, 844, "phone"],
  ["popup-edit", 1280, 900],
  ["popup-edit", 390, 844, "phone"],
  ["popup-bare", 390, 844, "phone"],
  ["gate", 1440, 900],
  ["gate", 1440, 900, "edit", "document.querySelector('.ps-btn--primary').click()"],
  ["gate", 1440, 900, "edit-list", "document.querySelector('.ps-btn--primary').click(); setTimeout(() => document.querySelector('.studio-coltabs button').click(), 300)"],
  ["gate-draft", 1440, 900],
  ["gate-stuck", 1440, 900, "early"],
  ["gate-stuck", 1440, 900, "late", null, 3000],
];
for (const [name, w, h, tag, script, extra] of shots) {
  if (only && !only.includes(name + (tag ? "-" + tag : ""))) continue;
  errors = [];
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: w < 500 });
  await send("Page.navigate", { url: `file:///out/${name}.html` });
  await new Promise((r) => setTimeout(r, 2500 + (extra ?? 0)));
  if (script) {
    await send("Runtime.evaluate", { expression: script });
    await new Promise((r) => setTimeout(r, 900));
  }
  const m = await send("Runtime.evaluate", { expression: "JSON.stringify({sw: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight})", returnByValue: true });
  const dims = JSON.parse(m.result.result.value);
  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: w, height: Math.min(Math.max(dims.h, h), 2400), scale: 1 } });
  const file = `/png/${name}${tag ? "-" + tag : ""}-${w}.png`;
  writeFileSync(file, Buffer.from(shot.result.data, "base64"));
  console.log(file, "scrollWidth", dims.sw, "viewport", w, "height", dims.h, "errors", JSON.stringify(errors));
}
ws.close();
