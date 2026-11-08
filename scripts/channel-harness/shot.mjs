import { writeFileSync } from "node:fs";
const host = process.argv[2];
const only = process.argv[3] ? process.argv[3].split(",") : null;
const list = await (await fetch(`http://${host}:9222/json/list`)).json();
const target = list.find((t) => t.type === "page");
const ws = new WebSocket(target.webSocketDebuggerUrl.replace(/ws:\/\/[^/]+/, `ws://${host}:9222`));
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let n = 0; const pending = new Map(); let errors = [];
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description?.slice(0, 400) || m.params.exceptionDetails.text); if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push("console: " + m.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 300)); });
const send = (method, params = {}) => new Promise((r) => { const id = ++n; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
await send("Runtime.enable");
const shots = [
  ["home", 1280, 900], ["matrix", 1280, 900], ["queue", 1280, 1000], ["month", 1280, 900], ["board", 1280, 900],
  ["newpost", 1280, 900], ["piece", 1280, 860], ["plan", 1280, 860], ["library", 1280, 860], ["quick", 1280, 860],
  ["home-phone", 390, 844], ["empty", 1100, 700], ["dark", 1280, 900], ["newpost", 390, 844, "phone"], ["piece", 390, 844, "phone"], ["lightbox", 1280, 860], ["outlets", 1280, 1000], ["outlets-live", 1280, 900], ["newpost-pick", 1280, 700], ["newpost-confirm", 1280, 900], ["newpost-posted", 1280, 900], ["katie", 1280, 900], ["routines", 1280, 900], ["adjust", 1280, 1000],
  ["kinds", 1280, 900], ["face", 1280, 500], ["popup", 1280, 900], ["popup-lightbox", 1280, 900], ["popup-empty", 1280, 760], ["popup-plain", 1280, 900], ["popup-dark", 1280, 900], ["popup", 390, 844, "phone"],
  ["content", 1280, 1100], ["content-list", 1280, 1000], ["content-lightbox", 1280, 900], ["content-empty", 1280, 700], ["content", 390, 844, "phone"], ["lightbox-piece", 1280, 600],
];
for (const [name, w, h, tag] of shots) {
  if (only && !only.includes(name + (tag ? "-" + tag : ""))) continue;
  errors = [];
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: w < 500 });
  await send("Page.navigate", { url: `file:///out/${name}.html` });
  await new Promise((r) => setTimeout(r, 2500));
  if (name === "newpost-pick" || name === "newpost-confirm" || name === "newpost-posted") await new Promise((r) => setTimeout(r, 1500));
  const m = await send("Runtime.evaluate", { expression: "JSON.stringify({pick: window.__pick, sw: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight, dialog: !!document.querySelector('dialog[open]')})", returnByValue: true });
  const dims = JSON.parse(m.result.result.value);
  const dialogOpen = dims.dialog;
  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: !dialogOpen, clip: { x: 0, y: 0, width: w, height: dialogOpen ? h : Math.min(dims.h, 2400), scale: 1 } });
  const file = `/out/${name}${tag ? "-" + tag : ""}-${w}.png`;
  writeFileSync(file, Buffer.from(shot.result.data, "base64"));
  console.log(file, JSON.stringify(dims.pick ?? null), "scrollWidth", dims.sw, "viewport", w, "height", dims.h, "dialog", dialogOpen, "errors", JSON.stringify(errors));
}
ws.close();
