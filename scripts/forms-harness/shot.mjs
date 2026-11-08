// Screenshots the forms harness pages through a headless Chrome's DevTools port (README).
// node shot.mjs <chrome-ip> [comma list of page names, e.g. 1a,1h-plain]
import { writeFileSync } from "node:fs";

const host = process.argv[2];
const only = process.argv[3] ? process.argv[3].split(",") : null;
const list = await (await fetch(`http://${host}:9222/json/list`)).json();
const target = list.find((t) => t.type === "page");
const ws = new WebSocket(target.webSocketDebuggerUrl.replace(/ws:\/\/[^/]+/, `ws://${host}:9222`));
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let n = 0;
const pending = new Map();
let errors = [];
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  }
  if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description?.slice(0, 400) || m.params.exceptionDetails.text);
  if (m.method === "Runtime.consoleAPICalled" && (m.params.type === "error" || m.params.type === "warning"))
    errors.push(`console.${m.params.type}: ` + m.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 300));
});
const send = (method, params = {}) =>
  new Promise((r) => {
    const id = ++n;
    pending.set(id, r);
    ws.send(JSON.stringify({ id, method, params }));
  });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await send("Runtime.enable");

// Widths from the design canvas: desktop 1320, the field-states sheet 900, phones 390.
const PAGES = [
  ["1a", 1320], ["2a", 1320], ["2b", 1320], ["1b", 1320], ["1h", 1320], ["1i", 900], ["1j", 1320],
  ["1l", 390], ["1m", 390], ["1n", 390], ["blank", 1320],
  // pass 2
  ["1c", 1320], ["1c-page", 1320], ["1o", 390], ["1f", 1320], ["1f-page", 1320], ["1p", 390], ["service", 1320], ["service-page", 1320], ["service-m", 390],
];
const LOOKS = ["", "-plain", "-dark"];

for (const [page, w] of PAGES) {
  for (const look of LOOKS) {
    const name = page + look;
    if (only && !only.includes(name)) continue;
    errors = [];
    await send("Emulation.setDeviceMetricsOverride", { width: w, height: w < 500 ? 844 : 900, deviceScaleFactor: 1, mobile: w < 500 });
    await send("Page.navigate", { url: `file:///out/${name}.html` });
    await sleep(3000);
    const measure = async () =>
      JSON.parse(
        (
          await send("Runtime.evaluate", {
            expression:
              "JSON.stringify({sw: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight, ready: (document.querySelector('.frm-ready')||{}).textContent||null, alert: !!document.querySelector('[role=alert]')})",
            returnByValue: true,
          })
        ).result.result.value
      );
    // Lay the page out at its full height (until it stops growing), so the phone's sticky bars sit
    // where they would at the end of the scroll and the capture never runs past the viewport.
    let dims = await measure();
    let h = 0;
    for (let i = 0; i < 4 && Math.min(dims.h, 4000) !== h; i++) {
      h = Math.min(dims.h, 4000);
      await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: w < 500 });
      await sleep(500);
      dims = await measure();
    }
    const shot = await send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: w, height: h, scale: 1 } });
    const file = `/out/${name}-${w}.png`;
    writeFileSync(file, Buffer.from(shot.result.data, "base64"));
    console.log(file, "scrollWidth", dims.sw, "viewport", w, "height", dims.h, "ready", JSON.stringify(dims.ready), "alert", dims.alert, "errors", JSON.stringify(errors));
  }
}
ws.close();
