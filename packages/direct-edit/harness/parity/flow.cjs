const { chromium } = require("playwright-core"); const http = require("http"), fs = require("fs"), path = require("path");
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==", "base64");
const srv = http.createServer((q, r) => { if (q.url.startsWith("/pic.png")) { r.writeHead(200, { "content-type": "image/png" }); r.end(PNG); return; } const f = path.join("/h", q.url.split("?")[0].split("#")[0]); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { "content-type": f.endsWith(".css") ? "text/css" : f.endsWith(".js") ? "text/javascript" : "text/html" }); r.end(d); }); });
const out = []; 
(async () => {
  await new Promise((r) => srv.listen(8123, "127.0.0.1", r));
  const b = await chromium.connectOverCDP("http://127.0.0.1:9222"); const p = b.contexts()[0].pages()[0];
  p.setDefaultTimeout(6000); await p.setViewportSize({ width: 1500, height: 950 });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("dialog", (d) => d.accept().catch(() => {}));
  await p.addInitScript(() => { let s = 12345; Math.random = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; });
  const snap = async (k) => { out.push([k, await p.evaluate(() => ({ panel: (document.querySelector(".de-vpanel")?.innerHTML ?? "").replace(/<div data-sync="notice" hidden(="")?><\/div>/g, ""), scope: document.querySelector("#host")?.innerHTML ?? "", doc: JSON.stringify(window.ed?.doc?.() ?? null), act: document.activeElement?.dataset?.f ?? document.activeElement?.tagName, sel: document.activeElement?.selectionStart ?? null, bar: document.querySelector(".de-editbar")?.textContent ?? "", undo: document.querySelector("[data-a=undo]")?.disabled, redo: document.querySelector("[data-a=redo]")?.disabled, save: document.querySelector("[data-a=save]")?.disabled }))]); };
  const pick = async (id) => { await p.locator(`.de-layers li[data-row="${id}"] .de-layer`).first().click(); await p.waitForTimeout(30); };
  const step = async (k, fn) => { try { await fn(); } catch (e) { out.push([k + " FAILED", e.message.slice(0, 120)]); } await p.waitForTimeout(40); await snap(k); };
  const open = async (u) => { await p.goto("about:blank"); await p.goto(`http://127.0.0.1:8123/${u}`); await p.waitForSelector(".de-vpanel .de-tabs"); await p.waitForTimeout(150); };
  await open("tree.html");
  await step("pick A", () => pick("A"));
  await step("type dest", async () => { await p.click('[data-f="attr-href"]'); await p.keyboard.type("https://a.example/x"); });
  await step("type anchor", async () => { await p.click('[data-f="attr-anchor"]'); await p.keyboard.type("here"); });
  await step("type name", async () => { await p.keyboard.press("Tab"); await p.keyboard.type("Nom"); });
  await step("undo1", () => p.click("[data-a=undo]"));
  await step("redo1", () => p.click("[data-a=redo]"));
  const numSel = '[data-k="gap"]';
  await step("gap type", async () => { await p.click(numSel); await p.keyboard.press("Control+a"); await p.keyboard.type("24"); });
  await step("gap arrow", () => p.keyboard.press("ArrowUp"));
  await step("gap blur", () => p.keyboard.press("Tab"));
  await step("undo gap", () => p.click("[data-a=undo]"));
  await step("fill pop", () => p.click('[data-pop^="color:"]'));
  await step("fill custom", () => p.click('.de-colorpop [data-ctab="custom"]'));
  await step("fill hex", async () => { await p.fill(".de-colorpop [data-hex]", "#112233"); });
  await step("undo hex", () => p.click("[data-a=undo]"));
  await step("code tab", () => p.click('[data-tab="code"]'));
  await step("code type", async () => { await p.click(".de-sheet-css"); await p.keyboard.type("border-top: 2px solid red;"); await p.waitForTimeout(350); });
  await step("props tab", () => p.click('[data-tab="props"]'));
  await step("esc", async () => { await p.evaluate(() => document.activeElement.blur()); await p.keyboard.press("Escape"); });
  await step("pick head", () => pick("head"));
  const menu = async (sel) => { const bb = await p.locator(sel).first().boundingBox(); await p.mouse.click(bb.x + bb.width / 2, bb.y + 10, { button: "right" }); await p.waitForSelector(".de-menu"); };
  await step("head menu detach", async () => { await menu('[data-tree-node="head"]'); await p.click('.de-menu [data-mi="detach"]'); });
  await step("undo detach", () => p.click("[data-a=undo]"));
  await step("add faq", async () => { await menu('[data-tree-node="head"]'); await p.click('.de-menu [data-open="add"]'); await p.waitForTimeout(20); await p.click('.de-menu [data-sub="add"] [data-mi="add:faq"]'); });
  await step("faq menu reset", async () => { await menu('[data-tree-node^="n"][data-tree-type="faq"],[data-tree-type="faq"]'); await p.click('.de-menu [data-mi="reset"]').catch(() => p.keyboard.press("Escape")); });
  await step("save", () => p.click("[data-a=save]"));
  await step("saved", async () => { out.push(["saved doc", await p.evaluate(() => JSON.stringify(window.saved))]); });
  await open("tree.html#classifieds");
  await step("cl first", async () => { const id = await p.$eval(".de-layers li[data-row]:nth-child(3)", (e) => e.dataset.row); await pick(id); });
  await step("cl type", async () => { await p.click('[data-f="attr-label"]'); await p.keyboard.type("Lab"); });
  await step("cl undo", () => p.click("[data-a=undo]"));
  // classifieds editor on arts-collective
  for (const h of ["", "#cards"]) {
    await p.goto("about:blank"); await p.goto(`http://127.0.0.1:8123/editor.html${h}`, { timeout: 30000 }).catch(() => {}); await p.waitForTimeout(600);
    out.push(["editor" + h, await p.evaluate(() => (document.querySelector(".de-panel")?.innerHTML ?? "NOPANEL").replace(/<div data-sync="notice" hidden(="")?><\/div>/g, "")) ]);
    const first = await p.$eval("[data-node]", (e) => e.dataset.node).catch(() => null);
    if (first) { const bb = await p.locator(`[data-node="${first}"] [data-part]`).first().boundingBox().catch(() => null); if (bb) { for (let i = 0; i < 3; i++) { await p.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.waitForTimeout(40); } out.push(["editor" + h + " sel", await p.evaluate(() => (document.querySelector(".de-panel")?.innerHTML ?? "").replace(/<div data-sync="notice" hidden(="")?><\/div>/g, "")) ]); await p.click("#cle-txt").catch(() => {}); await p.keyboard.type("zz"); await p.waitForTimeout(60); out.push(["editor" + h + " typed", await p.evaluate(() => (document.querySelector(".de-panel")?.innerHTML ?? "").replace(/<div data-sync="notice" hidden(="")?><\/div>/g, "")) ]); } }
  }
  out.push(["errors", errs]);
  fs.writeFileSync("/h/flow.json", JSON.stringify(out, null, 0));
  console.log("flow steps", out.length, "errs", errs.length, errs.slice(0, 2)); srv.close(); await b.close(); process.exit(0);
})().catch((e) => { fs.writeFileSync("/h/flow.json", JSON.stringify(out)); console.log("ERR", e.message.slice(0, 300)); process.exit(2); });
