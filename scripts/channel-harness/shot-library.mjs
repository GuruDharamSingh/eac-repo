// Content library harness screenshots + DOM dumps.
// node shot-library.mjs <chrome-ip> <pngdir> <page,page,...> [widths=1280,900,390]
// Reads file:///out/<page>.html; writes <pngdir>/<page>-<w>.png, .dom.html and prints metrics.
import { writeFileSync } from "node:fs";
const host = process.argv[2];
const outDir = process.argv[3];
const pages = process.argv[4].split(",");
const widths = (process.argv[5] || "1280,900,390").split(",").map(Number);
const list = await (await fetch(`http://${host}:9222/json/list`)).json();
const target = list.find((t) => t.type === "page");
const ws = new WebSocket(target.webSocketDebuggerUrl.replace(/ws:\/\/[^/]+/, `ws://${host}:9222`));
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let n = 0; const pending = new Map(); let errors = [];
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description?.slice(0, 400) || m.params.exceptionDetails.text); if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push("console: " + m.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 300)); });
const send = (method, params = {}) => new Promise((r) => { const id = ++n; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result.result.value;
await send("Runtime.enable");
for (const name of pages) {
  for (const w of widths) {
    errors = [];
    await send("Emulation.setDeviceMetricsOverride", { width: w, height: 900, deviceScaleFactor: 1, mobile: w < 500 });
    await send("Page.navigate", { url: `file:///out/${name}.html` });
    await new Promise((r) => setTimeout(r, 2500));
    const dims = JSON.parse(await ev("JSON.stringify({sw: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight})"));
    const dom = await ev("document.getElementById('root').outerHTML");
    writeFileSync(`${outDir}/${name}-${w}.dom.html`, dom ?? "");
    const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: w, height: Math.min(dims.h, 2400), scale: 1 } });
    writeFileSync(`${outDir}/${name}-${w}.png`, Buffer.from(shot.result.data, "base64"));
    console.log(name, w, "scrollWidth", dims.sw, "overflow", dims.sw > w, "h", dims.h, "errors", JSON.stringify(errors));
  }
}
ws.close();
