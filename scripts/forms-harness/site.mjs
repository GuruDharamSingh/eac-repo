// Drives the site-forms pages (entry-site.tsx) through a headless Chrome's DevTools port.
// node site.mjs <chrome-ip> [comma list of pages]
// For every page: a screenshot at 460, 900 and 390 px, console errors, sideways scroll.
// For the "-edit" pages (a filled item): Open full form and back, Save draft (none for a series),
// Publish, then AfterPublish's Done (or, for a series, the planner hand-off as the page's hash).
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
  if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description?.slice(0, 300) || m.params.exceptionDetails.text);
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
const js = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result.result.value;
await send("Runtime.enable");

const KINDS = ["meeting", "event", "post", "series", "workshop", "service"];
const PAGES = [...KINDS.flatMap((k) => ["surface", "page", "surface-edit", "page-edit"].map((h) => `sf-${k}-${h}`)), "sf-route-calendar", "sf-route-write", "sf-route-edit", "sf-route-acting"];
const WIDTHS = [460, 900, 390];
const BTN = (label) =>
  `(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === ${JSON.stringify(label)} && !x.disabled); if (!b) return false; b.click(); return true; })()`;
const has = (label) => `[...document.querySelectorAll('button')].some((x) => x.textContent.trim() === ${JSON.stringify(label)})`;
const sections = `document.querySelectorAll('.frm-sec, .frm-more').length`;

const report = {};
for (const page of PAGES) {
  if (only && !only.includes(page)) continue;
  const r = (report[page] = { shots: [], errors: [], checks: {} });
  for (const w of WIDTHS) {
    errors = [];
    await send("Emulation.setDeviceMetricsOverride", { width: w, height: w < 500 ? 844 : 1000, deviceScaleFactor: 1, mobile: w < 500 });
    await send("Page.navigate", { url: `file:///out/${page}.html` });
    await sleep(2500);
    const sw = await js("document.documentElement.scrollWidth");
    const shot = await send("Page.captureScreenshot", { format: "png" });
    const file = `/out/${page}-${w}.png`;
    writeFileSync(file, Buffer.from(shot.result.data, "base64"));
    r.shots.push({ w, file, sideways: sw > w });
    if (w === 460) r.startFrom = await js("Boolean(document.querySelector('.frm-preset'))");
    r.errors.push(...errors.map((e) => `${w}: ${e}`));
  }
  if (page.startsWith("sf-route-")) {
    // Which form opened, and what it starts with.
    r.checks = await js(`({ shared: Boolean(document.querySelector('.frm-site')), oldForm: Boolean(document.querySelector('.eac-composer, .eac-compose, .eac-write')), title: (document.querySelector('.frm-site input[id$=title], .frm-site textarea[id$=title], .frm-site .frm-title') || {}).value ?? null, date: (document.querySelector('.frm-site input[type=date]') || {}).value ?? null })`);
    continue;
  }
  if (!page.endsWith("-edit")) continue;
  // Interactions at the popup's width, on a fresh load.
  errors = [];
  await send("Emulation.setDeviceMetricsOverride", { width: 460, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: `file:///out/${page}.html` });
  await sleep(2500);
  const c = r.checks;
  c.quickSections = await js(sections);
  c.openFull = await js(BTN("Open full form"));
  await sleep(300);
  c.fullSections = await js(sections);
  c.fullRows = await js("[...document.querySelectorAll('.frm-more-name, .frm-sec-label')].map((x) => x.textContent.trim()).filter(Boolean)");
  c.fewerShown = await js(has("Fewer options"));
  c.backToQuick = await js(BTN("Fewer options"));
  await sleep(300);
  c.saveDraftShown = await js(has("Save draft"));
  if (c.saveDraftShown) {
    c.saveDraft = await js(BTN("Save draft"));
    await sleep(800);
    c.draftSaved = await js("window.__SAVES__.filter((s) => s.intent === 'draft').length");
  }
  c.publish = (await js(BTN("Publish"))) || (await js(BTN("Create")));
  await sleep(1200);
  c.published = await js("window.__SAVES__.filter((s) => s.intent === 'published').length");
  c.hash = await js("location.hash");
  c.afterPublishDone = await js(has("Done"));
  c.status = await js("([...document.querySelectorAll('[role=status], .frm-ready')].map((x) => x.textContent.trim()).filter(Boolean)[0] || null)");
  const shot = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(`/out/${page}-after.png`, Buffer.from(shot.result.data, "base64"));
  r.errors.push(...errors.map((e) => `interact: ${e}`));
}
console.log(JSON.stringify(report, null, 1));
ws.close();
