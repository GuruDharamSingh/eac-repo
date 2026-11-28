// Screenshot driver for the free-tier flow. Usage:
//   node flow.mjs <chromeIP> <jobs.json>
// jobs: [{ url, out, cookieHost?, width?, height?, full?, waitMs?, click?, dialog?: true, probe? }]
// Read-only: dialogs are dismissed (cancel), never accepted.
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
const [host, jobsFile] = process.argv.slice(2);
const jobs = JSON.parse(readFileSync(jobsFile, "utf8"));
const cookie = (() => { try { return readFileSync("/w/cookie.txt", "utf8").trim(); } catch { return ""; } })();
const log = (s) => appendFileSync("/w/flow.log", s + "\n");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const list = await (await fetch(`http://${host}:9222/json/list`)).json();
const ws = new WebSocket(list.find((t) => t.type === "page").webSocketDebuggerUrl.replace(/ws:\/\/[^/]+/, `ws://${host}:9222`));
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let n = 0; const pending = new Map(); let errors = []; let dialogs = [];
ws.addEventListener("message", async (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === "Runtime.exceptionThrown") errors.push((m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text || "").slice(0, 240));
  if (m.method === "Page.javascriptDialogOpening") {
    dialogs.push(m.params.message);
    ws.send(JSON.stringify({ id: ++n, method: "Page.handleJavaScriptDialog", params: { accept: false } }));
  }
});
const send = (method, params = {}, ms = 30000) => new Promise((r) => { const id = ++n; const t = setTimeout(() => { pending.delete(id); r({ timeout: method }); }, ms); pending.set(id, (m) => { clearTimeout(t); r(m); }); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (x) => (await send("Runtime.evaluate", { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value;

await send("Runtime.enable"); await send("Page.enable"); await send("Network.enable");
for (const job of jobs) {
  errors = []; dialogs = [];
  await send("Network.clearBrowserCookies");
  if (job.cookieHost) await send("Network.setCookie", { name: "sb-eac-auth", value: cookie, domain: job.cookieHost, path: "/" });
  const width = job.width ?? 1280; const height = job.height ?? 900;
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 600 });
  await send("Page.navigate", { url: job.url });
  await sleep(job.waitMs ?? 9000);
  for (let i = 0; i < 20 && (await ev("document.readyState")) !== "complete"; i++) await sleep(500);
  if (job.click) {
    const ok = await ev(`(() => { const want = ${JSON.stringify(job.click)}; const els = [...document.querySelectorAll('button,a,[role=button],span')]; const el = els.find(e => (want.startsWith("re:") ? new RegExp(want.slice(3)).test(e.textContent.trim()) : e.textContent.trim() === want) && e.offsetParent); if (el) { el.click(); return true } return false })()`);
    log(`click ${job.click}: ${ok}`);
    await sleep(job.afterClickMs ?? 2500);
  }
  if (job.probe) log(`probe ${job.out}: ${await ev(job.probe)}`);
  let h = height;
  if (job.full) {
    await ev(`(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } window.scrollTo(0, 0); })()`);
    h = Math.min(4200, Math.max(height, (await ev("document.documentElement.scrollHeight")) || height));
    await send("Emulation.setDeviceMetricsOverride", { width, height: h, deviceScaleFactor: 1, mobile: width < 600 });
    await sleep(800);
  }
  const overflow = await ev("document.documentElement.scrollWidth > window.innerWidth");
  const shot = await send("Page.captureScreenshot", { format: "png" });
  if (shot.result) writeFileSync(`/w/${job.out}`, Buffer.from(shot.result.data, "base64"));
  log(`${job.out} ${job.url} h=${h} overflow=${overflow} dialogs=${JSON.stringify(dialogs)} errors=${JSON.stringify(errors.slice(0, 4))}`);
}
ws.close();
process.exit(0);
