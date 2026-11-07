// Same interactions on a no-contract host, baseline source against current source. Writes what the editor showed and stored.
const { chromium } = require("playwright-core"); const http = require("http"), fs = require("fs"), path = require("path");
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==", "base64");
const srv = http.createServer((q, r) => { if (q.url.startsWith("/pic.png")) { r.writeHead(200, { "content-type": "image/png" }); r.end(PNG); return; } const f = path.join("/h", q.url.split("?")[0].split("#")[0]); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { "content-type": f.endsWith(".css") ? "text/css" : f.endsWith(".js") ? "text/javascript" : "text/html" }); r.end(d); }); });
const out = {}; const log = (k, v) => { out[k] = v; };
(async () => {
  await new Promise((r) => srv.listen(8123, "127.0.0.1", r));
  const b = await chromium.connectOverCDP("http://127.0.0.1:9222"); const p = b.contexts()[0].pages()[0];
  p.setDefaultTimeout(8000); await p.setViewportSize({ width: 1500, height: 950 });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("dialog", (d) => d.accept().catch(() => {}));
  await p.addInitScript(() => { let s = 12345; Math.random = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; });
  const panel = () => p.evaluate(() => (document.querySelector(".de-vpanel")?.innerHTML ?? "").replace(/<div data-sync="notice" hidden(="")?><\/div>/g, ""));
  const scope = () => p.evaluate(() => (document.querySelector("#host") ?? document.querySelector(".marketing-root"))?.innerHTML ?? "");
  const docJson = () => p.evaluate(() => JSON.stringify(window.ed.doc()));
  const tab = async (t) => { await p.click(`.de-vpanel [data-tab="${t}"]`); await p.waitForTimeout(25); };
  const menuRows = () => p.$$eval(".de-menu button[data-mi], .de-menu [data-open]", (e) => e.map((x) => [x.dataset.mi ?? x.dataset.open, x.textContent.trim(), !!x.disabled]));
  const openMenu = async (id) => {
    const l = p.locator(`[data-tree-node="${id}"]`).first(); await l.scrollIntoViewIfNeeded(); await p.waitForTimeout(80);
    const box = await l.boundingBox(); const v = p.viewportSize();
    await p.mouse.click(Math.min(box.x + box.width / 2, v.width - 400), Math.min(box.y + Math.min(box.height / 2, 20), v.height - 10), { button: "right" }); await p.waitForSelector(".de-menu");
  };
  const closeMenu = async () => { await p.keyboard.press("Escape"); await p.waitForTimeout(25); };
  const rowsOf = () => p.$$eval(".de-layers li", (e) => e.map((x) => x.dataset.row).filter((r) => r && !r.includes(":")));
  const walk = async (name) => {
    for (const id of await rowsOf()) {
      if (id.startsWith("root") || id === "__root__") continue;
      await p.evaluate((i) => window.ed.select(i), id); await p.waitForTimeout(25);
      log(`${name} ${id} props`, await panel());
      await tab("code"); log(`${name} ${id} code`, await panel()); await tab("props");
      try { await openMenu(id); log(`${name} ${id} menu`, await menuRows()); await closeMenu(); } catch (e) { log(`${name} ${id} menu`, "no menu: " + e.message.slice(0, 80)); await closeMenu(); }
    }
    log(`${name} scope`, await scope());
  };
  const adds = async (name, anchor) => {
    await openMenu(anchor); await p.click('.de-menu [data-open="add"]'); await p.waitForTimeout(20);
    const rows = await p.$$eval('.de-menu [data-sub="add"] button[data-mi]', (e) => e.map((x) => x.dataset.mi)); await closeMenu();
    log(`${name} add rows`, rows);
    for (const mi of rows) {
      await openMenu(anchor); await p.click('.de-menu [data-open="add"]'); await p.waitForTimeout(20); await p.click(`.de-menu [data-sub="add"] [data-mi="${mi}"]`); await p.waitForTimeout(60);
      log(`${name} ${mi} panel`, await panel()); log(`${name} ${mi} doc`, await docJson()); log(`${name} ${mi} scope`, await scope());
      const sel = await p.$eval(".de-layers li.on", (e) => e.dataset.row).catch(() => null);
      if (sel) { try { await openMenu(sel); log(`${name} ${mi} menu`, await menuRows()); await closeMenu(); } catch (e) { log(`${name} ${mi} menu`, "no menu"); await closeMenu(); } }
      if (mi === "add:words") { await p.keyboard.press("Escape"); await p.waitForTimeout(30); }
      await p.click("[data-a=undo]"); await p.waitForTimeout(40);
    }
  };
  /** Add a block, run one menu row on it, and record what was stored. */
  const actOn = async (name, anchor, type, action) => {
    await openMenu(anchor); await p.click('.de-menu [data-open="add"]'); await p.waitForTimeout(20); await p.click(`.de-menu [data-sub="add"] [data-mi="add:${type}"]`); await p.waitForTimeout(60);
    const sel = await p.$eval(".de-layers li.on", (e) => e.dataset.row); await openMenu(sel);
    const row = p.locator(`.de-menu [data-mi="${action}"]`); const off = await row.isDisabled(); log(`${name} ${type} ${action} disabled`, off);
    if (off) await closeMenu(); else { await row.click(); await p.waitForTimeout(80); }
    log(`${name} ${type} ${action} doc`, await docJson()); log(`${name} ${type} ${action} panel`, await panel());
    for (let i = 0; i < 2; i++) { if (await p.$eval("[data-a=undo]", (e) => !e.disabled)) { await p.click("[data-a=undo]"); await p.waitForTimeout(40); } }
  };

  const open = async (url) => { await p.goto("about:blank"); await p.goto(`http://127.0.0.1:8123/${url}`); await p.waitForSelector(".de-vpanel .de-tabs"); await p.waitForTimeout(150); };
  await open("tree.html"); await walk("tree"); await adds("tree", "head");
  for (const [type, action] of [["faq", "reset"], ["faq", "copy-style"], ["faq", "detach"], ["picture-wall", "detach"], ["prose", "detach"], ["thread-feed", "detach"], ["hero-banner", "detach"]]) await actOn("tree", "head", type, action);
  await p.click("[data-a=save]").catch(() => {}); await p.waitForTimeout(100); log("tree saved", await p.evaluate(() => JSON.stringify(window.saved)));
  await open("tree.html#classifieds"); await walk("classifieds");
  await p.goto("about:blank"); await p.goto("http://127.0.0.1:8123/landing.html", { waitUntil: "domcontentloaded" }); await p.waitForTimeout(400);
  log("landing skipped", await p.evaluate(() => window.openIt(null, { v: 1, boxes: { '[data-edit-section="hero"]': { style: { fill: "#c60c0c" } } } }))); await p.waitForSelector(".de-vpanel .de-tabs"); await p.waitForTimeout(200);
  await walk("landing");
  await p.click("[data-a=save]").catch(() => {}); await p.waitForTimeout(100); log("landing saved", await p.evaluate(() => JSON.stringify(window.saved)));
  // Classifieds and cards on the panel, with their Words field: the one textarea an existing host has in a .de-row.
  for (const hash of ["", "#cards"]) {
    await p.goto("about:blank"); await p.goto(`http://127.0.0.1:8123/editor.html${hash}`, { timeout: 60000 }); await p.waitForTimeout(500);
    log(`editor${hash} start`, await panel());
    const first = await p.$eval("[data-node]", (e) => e.dataset.node);
    const parts = await p.$$eval(`[data-node="${first}"] [data-part]`, (e) => e.map((x) => x.dataset.part));
    log(`editor${hash} parts`, parts);
    for (const part of parts) {
      const bb = await p.locator(`[data-node="${first}"] [data-part="${part}"]`).first().boundingBox().catch(() => null); if (!bb) continue;
      for (let i = 0; i < 3; i++) { await p.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.waitForTimeout(50); await p.mouse.move(bb.x + bb.width / 2 + 1, bb.y + bb.height / 2); }
      log(`editor${hash} ${part} panel`, await panel());
      const css = await p.$eval("#cle-txt", (e) => { const s = getComputedStyle(e), r = e.getBoundingClientRect(), pr = e.parentElement.getBoundingClientRect(); return { flex: s.flex, minWidth: s.minWidth, boxSizing: s.boxSizing, padding: s.padding, lineHeight: s.lineHeight, resize: s.resize, border: s.border, bg: s.backgroundColor, w: r.width, h: r.height, parentW: pr.width }; }).catch(() => null);
      if (css) log(`editor${hash} ${part} words field`, css);
      await p.keyboard.press("Escape"); await p.keyboard.press("Escape"); await p.keyboard.press("Escape"); await p.waitForTimeout(30);
    }
  }
  // A panel that clamps its scroll under a right-click, on a host with no contract. Recorded, whichever way it goes, so the two bundles can be compared.
  await open("tree.html");
  await p.evaluate(() => window.ed.select("A")); await p.waitForTimeout(40);
  const scrolled = await p.evaluate(() => { const b = document.querySelector(".de-vpanel .de-body"); b.scrollTop = b.scrollHeight; return b.scrollTop; });
  await p.waitForTimeout(60);
  const hb = await p.locator('[data-tree-node="head"]').first().boundingBox();
  await p.mouse.click(hb.x + hb.width / 2, hb.y + hb.height / 2, { button: "right" }); await p.waitForTimeout(200);
  log("no contract: panel scrolled before the right-click", scrolled > 0);
  log("no contract: panel scroll after", await p.$eval(".de-vpanel .de-body", (b) => b.scrollTop));
  log("no contract: menu open after a clamp", (await p.$$(".de-menu")).length);
  log("errors", errs);
  fs.writeFileSync("/h/parity.json", JSON.stringify(out, null, 1));
  console.log("probe keys", Object.keys(out).length, "errors", errs.length); srv.close(); await b.close(); process.exit(0);
})().catch((e) => { fs.writeFileSync("/h/parity.json", JSON.stringify(out, null, 1)); console.log("ERR", e.message.slice(0, 400), (e.stack || "").split("\n").slice(1, 3).join(" ")); process.exit(2); });
