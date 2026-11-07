// Runs smoke-morph.ts's groups, each from a fresh load, in isolated Chromium. Prints `pass N fail M`, as the other
// drivers do. ONLY=<group,group> runs some. Any page error, and any console error other than a request that cannot
// reach the network (a font link, /x.jpg), is a failure. A missing group is a failure, so it cannot read as a pass.
const { chromium } = require("playwright-core");
const http = require("http"), fs = require("fs"), path = require("path");
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==", "base64");
const srv = http.createServer((q, r) => { if (q.url.startsWith("/pic.png")) { r.writeHead(200, { "content-type": "image/png" }); r.end(PNG); return; } const f = path.join("/h", q.url.split("?")[0]); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { "content-type": f.endsWith(".css") ? "text/css" : f.endsWith(".js") ? "text/javascript" : "text/html" }); r.end(d); }); });
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) pass++; else { fail++; console.log("FAIL", n, x === undefined ? "" : JSON.stringify(x)); } };
const GROUPS = ["hostile", "ordinary", "repair", "clean", "parts", "cascade-plain", "cascade-layered", "cascade-sunjay", "spacing", "fonts", "hydrate", "stored", "editorShape", "adapter"];
(async () => {
  await new Promise((r) => srv.listen(8123, "127.0.0.1", r));
  fs.mkdirSync("/h/shots", { recursive: true });
  const b = await chromium.connectOverCDP("http://127.0.0.1:9222"); const p = b.contexts()[0].pages()[0];
  p.setDefaultTimeout(30000); await p.setViewportSize({ width: 1400, height: 900 });
  let errs = [];
  // Parts are drawn with /x.jpg, and a font link has no network here.
  p.on("pageerror", (e) => errs.push(e.message.slice(0, 300)));
  p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|net::ERR|\.jpg|fonts\.googleapis/.test(`${m.text()} ${m.location().url}`)) errs.push(m.text().slice(0, 300)); if (m.type() === "log" && /^(fonts: control|spacing: )/.test(m.text())) console.log(m.text()); });
  const fresh = async () => { await p.goto("about:blank"); errs = []; await p.goto("http://127.0.0.1:8123/smoke-morph.html"); await p.waitForFunction(() => window.kit); };
  const run = async (name) => { const res = await p.evaluate((g) => window.kit.run(g), name); for (const [n, c, x] of res) ok(n, c, x); ok(`${name}: ran checks`, res.length > 0); ok(`${name}: no page or console errors`, errs.length === 0, errs.slice(0, 3)); return res; };

  await fresh();
  const known = await p.evaluate(() => window.kit.groups);
  for (const g of [...GROUPS, "phone", "show-published", "show-editor"]) ok(`group ${g} exists`, known.includes(g), known);
  const only = process.env.ONLY ? process.env.ONLY.split(",") : null;
  for (const g of GROUPS) {
    if (only && !only.includes(g)) continue;
    await fresh();
    await run(g);
  }
  if (!only || only.includes("phone")) {
    await p.setViewportSize({ width: 390, height: 800 }); await fresh(); await p.evaluate(() => { const s = document.createElement("style"); document.head.appendChild(s); }); await run("phone");
    await p.setViewportSize({ width: 1400, height: 900 });
  }
  // Pictures to read: the same looks, published and in the editor's shape.
  for (const kind of ["published", "editor"]) {
    if (only && !only.includes("show")) continue;
    await p.setViewportSize({ width: 1100, height: 1500 }); await fresh();
    const shown = await p.evaluate((k) => window.kit.run(`show-${k}`), kind);
    ok(`show ${kind}: drew`, shown.length === 0, shown);
    await p.waitForTimeout(150);
    const facts = await p.evaluate(() => ({ marks: document.querySelectorAll("[data-tree-node]").length, markers: document.querySelectorAll("template[data-morph]").length, wrap: document.querySelectorAll("[data-tree-wrap]").length }));
    ok(`show ${kind}: five markers`, facts.markers === 5, facts);
    ok(`show ${kind}: ${kind === "published" ? "no editor marks" : "marked"}`, kind === "published" ? facts.marks === 0 && facts.wrap === 0 : facts.marks === 5, facts);
    await p.screenshot({ path: `/h/shots/sm-${kind}.png`, fullPage: true });
  }
  console.log(`pass ${pass} fail ${fail}`); srv.close(); await b.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("ERR", e.message.slice(0, 400)); process.exit(2); });
