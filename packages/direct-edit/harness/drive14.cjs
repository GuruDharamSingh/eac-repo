// Stone 2, click into a block, in the editor. This file is the shell; the checks are in drive14-hand.cjs (the hand test,
// plan section 8), drive14-tools.cjs (B1 to B7) and drive14-review.cjs (B8 and the host with no contract). ONLY=hand,
// tools or review runs one. Each module starts from a fresh page. A module that is missing is a failure.
//
// ctx: { p, ok, errs, open, h } where h holds the helpers below.
const { chromium } = require("playwright-core");
const http = require("http"), fs = require("fs"), path = require("path");
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==", "base64");
const srv = http.createServer((q, r) => { if (q.url.startsWith("/pic.png")) { r.writeHead(200, { "content-type": "image/png" }); r.end(PNG); return; } const f = path.join("/h", q.url.split("?")[0]); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { "content-type": f.endsWith(".css") ? "text/css" : f.endsWith(".js") ? "text/javascript" : "text/html" }); r.end(d); }); });
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else { fail++; console.log("FAIL", n, x === undefined ? "" : JSON.stringify(x)); } };
const MODULES = [["hand", "drive14-hand.cjs"], ["tools", "drive14-tools.cjs"], ["review", "drive14-review.cjs"]];
(async () => {
  await new Promise((r) => srv.listen(8123, "127.0.0.1", r));
  fs.mkdirSync("/h/shots", { recursive: true });
  const b = await chromium.connectOverCDP("http://127.0.0.1:9222"); const p = b.contexts()[0].pages()[0];
  p.setDefaultTimeout(15000); await p.setViewportSize({ width: 1500, height: 950 });
  const errs = [];
  const note = (t) => { if (!/Broken on purpose/.test(t)) errs.push(t.slice(0, 300)); };
  p.on("pageerror", (e) => note(e.message)); p.on("console", (m) => { if (m.type() === "error" && !/net::ERR/.test(m.text())) note(m.text()); });
  p.on("dialog", (d) => d.accept().catch(() => {}));
  const open = async (hash = "", page = "view-blocks.html") => { await p.goto("about:blank"); await p.goto(`http://127.0.0.1:8123/${page}${hash}`); await p.waitForSelector(".de-vpanel .de-tabs"); await p.waitForTimeout(150); };

  const nodeIn = (d, id) => {
    let hit = null;
    const go = (list) => { for (const n of list ?? []) { if (n.props.id === id) hit = n; for (const v of Object.values(n.props)) if (Array.isArray(v) && v[0]?.type) go(v); } };
    go(d.content);
    return hit;
  };
  const h = {
    nodeIn,
    doc: () => p.evaluate(() => window.ed.doc()),
    node: async (id) => nodeIn(await p.evaluate(() => window.ed.doc()), id),
    morph: async (id) => nodeIn(await p.evaluate(() => window.ed.doc()), id)?.props.morph,
    sel: async (ref) => { await p.evaluate((i) => window.ed.select(i), ref); await p.waitForTimeout(40); },
    head: () => p.$eval(".de-vpanel .de-head b", (e) => e.textContent).catch(() => null),
    sub: () => p.$eval(".de-vpanel .de-head span", (e) => e.textContent).catch(() => null),
    sections: () => p.$$eval(".de-vpanel .de-sec[data-section]", (e) => e.map((x) => x.dataset.section)),
    labels: (s) => p.$$eval(`.de-vpanel .de-sec[data-section="${s}"] .de-label`, (e) => e.map((x) => x.textContent)),
    /** Layer rows on show, as "name note". */
    rows: () => p.$$eval(".de-layers li", (e) => e.map((x) => x.querySelector(".de-layer").innerText.replace(/\s+/g, " ").trim())),
    row: (name) => p.locator(".de-layers li").filter({ has: p.locator(".de-layer b", { hasText: new RegExp(`^${name}$`) }) }).first(),
    /** A real click at the middle of the first match. */
    click: async (selector, o = {}) => { const l = p.locator(selector).first(); await l.scrollIntoViewIfNeeded(); await p.waitForTimeout(70); const bb = await l.boundingBox(); const x = bb.x + bb.width * (o.dx ?? 0.5), y = bb.y + bb.height * (o.dy ?? 0.5); await p.mouse.move(x, y); await p.mouse.click(x, y, o.button ? { button: o.button } : undefined); await p.waitForTimeout(60); },
    right: async (selector) => { const l = p.locator(selector).first(); await l.scrollIntoViewIfNeeded(); await p.waitForTimeout(90); const bb = await l.boundingBox(); await p.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2, { button: "right" }); await p.waitForSelector(".de-menu"); await p.waitForTimeout(30); },
    menuOff: (id) => p.$eval(`.de-menu [data-mi="${id}"]`, (e) => e.disabled),
    closeMenu: async () => { await p.keyboard.press("Escape"); await p.waitForTimeout(40); },
    undo: async () => { await p.click("[data-a=undo]"); await p.waitForTimeout(60); },
    redo: async () => { await p.click("[data-a=redo]"); await p.waitForTimeout(60); },
    /** Set a colour field by typing, the way a person pastes a hex. */
    hex: async (id, value) => { await p.fill(`.de-vpanel [data-f="${id}"]`, value); await p.waitForTimeout(60); await p.$eval(`.de-vpanel [data-f="${id}"]`, (e) => e.blur()); await p.waitForTimeout(30); },
    css: (selector, prop) => p.$eval(selector, (e, q) => getComputedStyle(e)[q], prop),
    published: async () => { await p.evaluate(() => document.activeElement?.blur?.()); await p.click('#tt-acts [data-tt="published"]'); await p.waitForSelector("#tt-show .tt-show-page"); await p.waitForTimeout(120); },
    closeShow: async () => { await p.click('#tt-show [data-tt="close"]'); await p.waitForTimeout(60); },
    shot: (n) => p.screenshot({ path: `/h/shots/s14-${n}.png` }),
    pause: (ms) => p.waitForTimeout(ms),
  };

  await open();
  const only = process.env.ONLY;
  for (const [name, file] of MODULES) {
    if (only && only !== name) continue;
    if (!fs.existsSync(path.join(__dirname, file))) { ok(`${name}: ${file} is not written`, false); continue; }
    errs.length = 0;
    try { await open(); await require(`./${file}`)({ p, ok, errs, open, h }); }
    catch (e) { ok(`${name}: module stopped`, false, `${e.message.slice(0, 400)} ${(e.stack || "").split("\n").find((l) => l.includes("drive14")) ?? ""}`); }
    ok(`${name}: no errors`, errs.length === 0, errs.slice(0, 3));
  }
  console.log(`pass ${pass} fail ${fail}`); srv.close(); await b.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERR", e.message.slice(0, 500), (e.stack || "").split("\n").find((l) => l.includes("drive14"))); process.exit(2); });
