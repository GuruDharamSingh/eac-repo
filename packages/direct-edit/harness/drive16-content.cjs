// The Content tab (PLAN 9 step A, 2026-11-21): content.html#on is the page with the tab, content.html#off without it.
// Run with harness/runall.sh drive16-content.cjs (S=<scratch>, harness copied to $S/h3, content.js built by esbuild: see content.ts).
const { chromium } = require("playwright-core");
const http = require("http"), fs = require("fs"), path = require("path");
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==", "base64");
const srv = http.createServer((q, r) => { if (q.url.startsWith("/pic.png")) { r.writeHead(200, { "content-type": "image/png" }); r.end(PNG); return; } const f = path.join("/h", q.url.split("?")[0]); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { "content-type": f.endsWith(".css") ? "text/css" : f.endsWith(".js") ? "text/javascript" : "text/html" }); r.end(d); }); });
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else { fail++; console.log("FAIL", n, x === undefined ? "" : JSON.stringify(x)); } };

(async () => {
  await new Promise((r) => srv.listen(8123, "127.0.0.1", r));
  fs.mkdirSync("/h/shots", { recursive: true });
  const b = await chromium.connectOverCDP("http://127.0.0.1:9222"); const p = b.contexts()[0].pages()[0];
  p.setDefaultTimeout(15000); await p.setViewportSize({ width: 1500, height: 950 });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message.slice(0, 300))); p.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 300)); });
  p.on("dialog", (d) => d.accept().catch(() => {}));
  const open = async (hash) => { await p.goto("about:blank"); await p.goto(`http://127.0.0.1:8123/content.html${hash}`); await p.waitForSelector(".de-vpanel .de-tabs"); await p.waitForTimeout(200); };
  const sel = async (id) => { await p.evaluate((i) => window.ed.select(i), id); await p.waitForTimeout(80); };
  const node = async (id) => p.evaluate((i) => { let hit = null; const go = (l) => { for (const n of l ?? []) { if (n.props.id === i) hit = n; for (const v of Object.values(n.props)) if (Array.isArray(v) && v[0]?.type) go(v); } }; go(window.ed.doc().content); return hit; }, id);
  const prop = async (id, name) => (await node(id))?.props[name];
  const tabs = () => p.$$eval(".de-vpanel .de-tabs [role=tab]", (e) => e.map((x) => `${x.textContent}${x.getAttribute("aria-selected") === "true" ? "*" : ""}`));
  const secs = () => p.$$eval(".de-vpanel .de-sec[data-section]", (e) => e.map((x) => x.dataset.section));
  const undo = async () => { await p.click("[data-a=undo]"); await p.waitForTimeout(80); };
  const redo = async () => { await p.click("[data-a=redo]"); await p.waitForTimeout(80); };
  const labels = () => p.$$eval(".de-vpanel .de-body .de-row .de-label", (e) => e.map((x) => x.textContent));
  const has = (s) => p.$(s).then((e) => !!e);

  // ---- tab on
  await open("#on");
  await sel("hero");
  ok("C1 Content is the first tab and the one open", (await tabs()).join() === "Content*,Look,Code,Tweaks", await tabs());
  ok("C1 heading is the block label", (await p.textContent(".de-vpanel .de-head b")) === "Hero banner");
  ok("C1 content labels, in the order declared", (await labels()).join() === "Title,Subtitle,Background image,Image description,Text position,Height", await labels());
  ok("C1 no box sections in Content", (await secs()).every((s) => ["content", "layout", "appearance", "behaviour"].includes(s)), await secs());
  ok("C1 More settings at the bottom", await has('.de-vpanel [data-f="more-settings"]'));
  await p.screenshot({ path: "/h/shots/s16-content.png" });

  // text: typing coalesces to one undo step
  const before = await prop("hero", "title");
  await p.click('.de-vpanel [data-f="p-title"]');
  await p.keyboard.press("Control+A");
  await p.keyboard.type("A new title", { delay: 15 });
  await p.waitForTimeout(100);
  ok("C2 typed text is stored", (await prop("hero", "title")) === "A new title", await prop("hero", "title"));
  await p.$eval('.de-vpanel [data-f="p-title"]', (e) => e.blur()); await p.waitForTimeout(60);
  await undo();
  ok("C2 one undo takes back the whole of the typing", (await prop("hero", "title")) === before, await prop("hero", "title"));
  await redo();
  ok("C2 redo brings it back", (await prop("hero", "title")) === "A new title");

  // select
  await sel("hero");
  await p.selectOption('.de-vpanel [data-f="p-align"]', JSON.stringify("left")); await p.waitForTimeout(80);
  ok("C3 select is stored", (await prop("hero", "align")) === "left", await prop("hero", "align"));
  await undo();
  ok("C3 select undoes", (await prop("hero", "align")) !== "left", await prop("hero", "align"));

  // number, clamped by the door
  await sel("hero");
  await p.fill('.de-vpanel [data-f="p-height"]', "5000"); await p.waitForTimeout(100);
  ok("C4 number is clamped to the block maximum by the door", (await prop("hero", "height")) === 1200, await prop("hero", "height"));
  await p.fill('.de-vpanel [data-f="p-height"]', "300"); await p.waitForTimeout(100);
  ok("C4 number is stored", (await prop("hero", "height")) === 300, await prop("hero", "height"));

  // picture through the host's chooser
  await sel("hero");
  await p.click('.de-vpanel [data-f="propic-imageUrl"]'); await p.waitForTimeout(80);
  ok("C5 picture button opens the host chooser", (await p.evaluate(() => window.pickerCalls.length)) === 1);
  await p.click('[data-test="pick-one"]'); await p.waitForTimeout(100);
  ok("C5 picture is stored", (await prop("hero", "imageUrl")) === "/pic.png", await prop("hero", "imageUrl"));
  ok("C5 Remove button appears", await has('.de-vpanel [data-f="propclear-imageUrl"]'));
  await p.click('.de-vpanel [data-f="propclear-imageUrl"]'); await p.waitForTimeout(80);
  ok("C5 Remove empties it", (await prop("hero", "imageUrl")) === "", await prop("hero", "imageUrl"));

  // one home: no Height in Look
  await p.click('.de-vpanel [data-f="tab-props"]'); await p.waitForTimeout(80);
  ok("C6 Look tab has no Height control (the block declares Height)", !(await has('.de-vpanel [data-sync="row-height"]')));
  ok("C6 Look tab says where Height lives", /Content tab/.test((await p.textContent('.de-vpanel [data-f="home-height"]').catch(() => "")) ?? ""));
  ok("C6 Look tab has no settings of the block", !(await has('.de-vpanel [data-sync="row-p-title"]')));
  ok("C6 Look still has the other looks (padding)", await has('.de-vpanel [data-sync="row-padding"]'));
  await p.click('.de-vpanel [data-f="tab-content"]'); await p.waitForTimeout(60);

  // tab memory
  await p.click('.de-vpanel [data-f="tab-props"]'); await sel("card");
  ok("C7 a block after a block keeps the tab chosen", (await tabs()).join() === "Content,Look*,Code,Tweaks", await tabs());
  await sel("box1");
  ok("C7 an own box has no Content tab", (await tabs()).every((t) => !/Content/.test(t)), await tabs());
  await sel("hero");
  ok("C7 back on a block it opens on Content", (await tabs())[0] === "Content*", await tabs());

  // fall-back kinds
  await sel("faq");
  ok("C8 rows are named with Edit in settings", await has('.de-vpanel [data-f="edit-items"]'));
  await p.click('.de-vpanel [data-f="edit-items"]'); await p.waitForTimeout(100);
  ok("C8 the settings sheet is asked for", (await p.evaluate(() => window.settingsCalls.join())) === "faq", await p.evaluate(() => window.settingsCalls));
  await sel("faq");
  await p.click('.de-vpanel [data-f="more-settings"]'); await p.waitForTimeout(100);
  ok("C8 More settings asks for it too", (await p.evaluate(() => window.settingsCalls.length)) === 2);

  // the door refuses what it will not keep
  await sel("card");
  await p.fill('.de-vpanel [data-f="p-href"]', "javascript:alert(1)"); await p.waitForTimeout(100);
  await p.$eval('.de-vpanel [data-f="p-href"]', (e) => e.blur()); await p.waitForTimeout(80);
  ok("C9 a link the door will not keep is not stored", !(await prop("card", "href")), await prop("card", "href"));
  await p.fill('.de-vpanel [data-f="p-href"]', "https://example.org/x"); await p.waitForTimeout(100);
  ok("C9 a good link is stored", (await prop("card", "href")) === "https://example.org/x", await prop("card", "href"));

  // rows of a data block are resolved again
  await sel("gg");
  await p.evaluate(() => { window.rowCalls.length = 0; });
  const gapOpts = await p.$$eval('.de-vpanel [data-f="p-gap"] option', (e) => e.map((x) => x.value));
  const now = await prop("gg", "gap");
  const other = gapOpts.find((v) => JSON.parse(v) !== now);
  await p.selectOption('.de-vpanel [data-f="p-gap"]', other); await p.waitForTimeout(700);
  const rc = await p.evaluate(() => window.rowCalls);
  ok("C10 a setting of a data block asks the resolver again", rc.length === 1 && rc[0].type === "gallery-grid", rc);
  ok("C10 no error from any of this", errs.length === 0, errs.slice(0, 3));

  // ---- tab off: as before
  errs.length = 0;
  await open("#off");
  await sel("hero");
  ok("C11 off: tabs are as they were", (await tabs()).join() === "Properties*,Code,Tweaks", await tabs());
  ok("C11 off: Height is both a Look control and a setting in Properties", (await has('.de-vpanel [data-sync="row-p-height"]')) && (await has('.de-vpanel [data-sync="row-height"]')));
  ok("C11 off: no Content tab content", !(await has('.de-vpanel [data-f="more-settings"]')));
  await p.fill('.de-vpanel [data-f="p-height"]', "300"); await p.waitForTimeout(100);
  ok("C11 off: still writes", (await prop("hero", "height")) === 300);
  ok("C11 off: no errors", errs.length === 0, errs.slice(0, 3));

  console.log(`pass ${pass} fail ${fail}`); srv.close(); await b.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERR", e.message.slice(0, 500), (e.stack || "").split("\n")[1]); process.exit(2); });
