// Stone 1 checks. This file is the shell; the checks are in drive13-canvas.cjs (C1-C11)
// and drive13-panel.cjs (P1-P16), each `module.exports = async (ctx) => { ... }` and each
// run from a fresh page. ONLY=canvas or ONLY=panel runs one of them. A module that is
// missing is a failure, so an unwritten set of checks cannot read as a pass.
//
// ctx: { p, ok, errs, open, pick, rowFor, menu }
//   open(hash = "", page = "view-blocks.html")  fresh load; tree.html for a host with no contract
//   pick(name), rowFor(name)                    layer row by text, as in drive11
//   menu(selector)                              right-click the first match; resolves when .de-menu is open
//   errs                                        page and console errors of the current module
const { chromium } = require("playwright-core");
const http = require("http"), fs = require("fs"), path = require("path");
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==", "base64");
const srv = http.createServer((q, r) => { if (q.url.startsWith("/pic.png")) { r.writeHead(200, { "content-type": "image/png" }); r.end(PNG); return; } const f = path.join("/h", q.url.split("?")[0]); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { "content-type": f.endsWith(".css") ? "text/css" : f.endsWith(".js") ? "text/javascript" : "text/html" }); r.end(d); }); });
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else { fail++; console.log("FAIL", n, x === undefined ? "" : JSON.stringify(x)); } };
const MODULES = [["canvas", "drive13-canvas.cjs"], ["panel", "drive13-panel.cjs"]];
(async () => {
  await new Promise((r) => srv.listen(8123, "127.0.0.1", r));
  fs.mkdirSync("/h/shots", { recursive: true });
  const b = await chromium.connectOverCDP("http://127.0.0.1:9222"); const p = b.contexts()[0].pages()[0];
  p.setDefaultTimeout(15000); await p.setViewportSize({ width: 1500, height: 950 });
  const errs = [];
  // The test block's throw is the only error this driver expects; React logs it when a boundary catches it.
  const note = (t) => { if (!/Broken on purpose/.test(t)) errs.push(t.slice(0, 300)); };
  p.on("pageerror", (e) => note(e.message)); p.on("console", (m) => { if (m.type() === "error") note(m.text()); });
  const open = async (hash = "", page = "view-blocks.html") => { await p.goto("about:blank"); await p.goto(`http://127.0.0.1:8123/${page}${hash}`); await p.waitForSelector(".de-vpanel .de-tabs"); await p.waitForTimeout(150); };
  const rowFor = (name) => p.locator(".de-layers li").filter({ hasText: name }).first();
  const pick = async (name) => { await rowFor(name).locator(".de-layer").click(); await p.waitForTimeout(40); };
  const menu = async (selector) => { const l = p.locator(selector).first(); await l.scrollIntoViewIfNeeded(); const box = await l.boundingBox(); const v = p.viewportSize(); await p.mouse.click(Math.min(box.x + box.width / 2, v.width - 400), Math.min(box.y + box.height / 2, v.height - 10), { button: "right" }); await p.waitForSelector(".de-menu"); };
  const ctx = { p, ok, errs, open, pick, rowFor, menu };

  // The page every module starts from.
  await open();
  const state = await p.evaluate(() => ({ ed: typeof window.ed?.doc, remount: typeof window.remount, saved: Array.isArray(window.saved), kit: Object.keys(window.kit?.contract ?? {}).length, nodes: document.querySelectorAll("#host [data-tree-node]").length }));
  ok("shell: view-blocks mounted", state.ed === "function" && state.remount === "function" && state.saved && state.nodes > 0, state);
  ok("shell: contract holds the shared blocks, pt-banner and the test block", state.kit === 32, state.kit);
  ok("shell: no errors on open", errs.length === 0, errs.slice(0, 3));

  const only = process.env.ONLY;
  for (const [name, file] of MODULES) {
    if (only && only !== name) continue;
    if (!fs.existsSync(path.join(__dirname, file))) { ok(`${name}: ${file} is not written`, false); continue; }
    errs.length = 0;
    try { await open(); await require(`./${file}`)(ctx); }
    catch (e) { ok(`${name}: module stopped`, false, `${e.message.slice(0, 400)} ${(e.stack || "").split("\n").find((l) => l.includes("drive13")) ?? ""}`); }
    ok(`${name}: no errors`, errs.length === 0, errs.slice(0, 3));
  }
  console.log(`pass ${pass} fail ${fail}`); srv.close(); await b.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERR", e.message.slice(0, 500), (e.stack || "").split("\n").find((l) => l.includes("drive13"))); process.exit(2); });
