// Screenshots through a running chromium (see README). Usage: node shot.mjs <chrome-ip> [comma list of page names]
import { writeFileSync } from "node:fs";
const host = process.argv[2];
const only = process.argv[3] ? process.argv[3].split(",") : null;
const list = await (await fetch(`http://${host}:9222/json/list`)).json();
const target = list.find((t) => t.type === "page");
const ws = new WebSocket(target.webSocketDebuggerUrl.replace(/ws:\/\/[^/]+/, `ws://${host}:9222`));
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let n = 0; const pending = new Map(); let errors = [];
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description?.slice(0, 400) || m.params.exceptionDetails.text);
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push("console: " + m.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 300));
});
const send = (method, params = {}) => new Promise((r) => { const id = ++n; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
await send("Runtime.enable");
const D = [1280, 900];
const shots = [
  ["card", 1280, 420], ["card-small", 1280, 420], ["card-solo", 1280, 420], ["card-guide", 1280, 420],
  ["popup", ...D], ["popup-guide", ...D], ["popup-demote", ...D], ["popup-nomatch", ...D],
  ["people", 1280, 1100], ["people-guide", 1280, 1100], ["people-expanded", 1280, 1100], ["confirm-remove", ...D], ["confirm-demote", ...D],
  ["arrivals", 1280, 900], ["arrivals-guide", 1280, 900], ["arrivals-empty", 1280, 700],
  ["visitors", 1280, 1100], ["visitors-30d", 1280, 1100], ["visitors-90d", 1280, 1100],
  ["permissions", 1280, 1000], ["permissions-guide", 1280, 900],
  ["small-org", 1280, 900], ["small-org-guide", 1280, 800], ["solo", 1280, 700],
  ["card-plain", 1280, 420], ["people-plain", 1280, 1100],
  ["popup-phone", 390, 900], ["people-phone", 390, 900],
  ["sb-card", 1280, 440], ["sb-card-bookreaders", 1280, 440], ["sb-card-noeditor", 1280, 440],
  ["sb-popup", 1280, 900], ["sb-popup-template", 1280, 1100], ["sb-popup-nonotes", 1280, 900],
  ["sb-pages-grid", 1280, 1500], ["sb-pages-list", 1280, 1500], ["sb-pages-expanded-editor", 1280, 1300], ["sb-pages-expanded-template", 1280, 1300],
  ["sb-pages-nonotes", 1280, 1300], ["sb-bookreaders", 1280, 1500], ["sb-new-page", 1280, 1200], ["sb-new-nested", 1280, 1300], ["sb-save-template", 1280, 1300],
  ["sb-theme", 1280, 1200], ["sb-profile", 1280, 1100], ["sb-profile-nokinds", 1280, 1100], ["sb-pages-plain", 1280, 1400],
  ["sb-popup-phone", 390, 900], ["sb-pages-phone", 390, 900],
];
for (const [name, w, h] of shots) {
  if (only && !only.includes(name)) continue;
  errors = [];
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: w < 500 });
  await send("Page.navigate", { url: `file:///out/${name}.html` });
  await new Promise((r) => setTimeout(r, 3200));
  const m = await send("Runtime.evaluate", { expression: "JSON.stringify({sw: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight})", returnByValue: true });
  const dims = JSON.parse(m.result.result.value);
  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: w, height: Math.min(Math.max(dims.h, 200), 2400), scale: 1 } });
  const file = `/out/${name}-${w}.png`;
  writeFileSync(file, Buffer.from(shot.result.data, "base64"));
  console.log(file, "scrollWidth", dims.sw, "viewport", w, "height", dims.h, "errors", JSON.stringify(errors));
}
ws.close();
