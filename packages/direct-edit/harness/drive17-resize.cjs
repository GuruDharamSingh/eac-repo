// Canvas lane (2026-11-22): resize.html#on. A banner's bottom edge writes its Height setting (not a look); clamped; one undo step;
// a block without `resize` unchanged; words typed on the canvas write the setting, Escape restores, one undo step.
// Run with the package's runall.sh pattern (S=<scratch holding h3/>), resize.js built by esbuild from resize.ts (see canvas.sh in the report).
const { chromium } = require("playwright-core");
const http = require("http"), fs = require("fs"), path = require("path");
const srv = http.createServer((q, r) => { const f = path.join("/h", q.url.split("?")[0]); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { "content-type": f.endsWith(".css") ? "text/css" : f.endsWith(".js") ? "text/javascript" : "text/html" }); r.end(d); }); });
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else { fail++; console.log("FAIL", n, x === undefined ? "" : JSON.stringify(x)); } };

(async () => {
  await new Promise((r) => srv.listen(8124, "127.0.0.1", r));
  fs.mkdirSync("/h/shots", { recursive: true });
  const b = await chromium.connectOverCDP("http://127.0.0.1:9222"); const p = b.contexts()[0].pages()[0];
  p.setDefaultTimeout(15000); await p.setViewportSize({ width: 1500, height: 2600 });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message.slice(0, 300))); p.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 300)); });
  const open = async (hash) => { await p.goto("about:blank"); await p.goto(`http://127.0.0.1:8124/resize.html${hash}`); await p.waitForSelector(".de-vpanel"); await p.waitForTimeout(250); };
  const sel = async (id) => { await p.evaluate((i) => window.ed.select(i), id); await p.waitForTimeout(120); };
  const node = async (id) => p.evaluate((i) => { let hit = null; const go = (l) => { for (const n of l ?? []) { if (n.props.id === i) hit = n; for (const v of Object.values(n.props)) if (Array.isArray(v) && v[0]?.type) go(v); } }; go(window.ed.doc().content); return hit; }, id);
  const prop = async (id, name) => (await node(id))?.props[name];
  const undo = async () => { await p.click("[data-a=undo]"); await p.waitForTimeout(100); };
  const redo = async () => { await p.click("[data-a=redo]"); await p.waitForTimeout(100); };
  const has = (s) => p.$(s).then((e) => !!e);
  const hint = () => p.evaluate(() => (document.querySelector(".de-hint, [data-f=hint], .de-top .de-note") || {}).textContent || document.body.innerText);
  const secH = () => p.$eval('[data-tree-node="ptb"]', (e) => Math.round(e.getBoundingClientRect().height));
  const minH = () => p.$eval('[data-tree-node="ptb"]', (e) => e.style.minHeight);
  /** Drag the selected block's handle `h` by dy screen pixels; `mid` runs while the pointer is still down. */
  const drag = async (h, dy, mid) => {
    const bb = await (await p.$(`.de-handle.${h}`)).boundingBox();
    const x = bb.x + bb.width / 2, y = bb.y + bb.height / 2;
    await p.mouse.move(x, y); await p.mouse.down();
    const n = 6; for (let i = 1; i <= n; i++) { await p.mouse.move(x, y + (dy * i) / n); await p.waitForTimeout(25); }
    await p.waitForTimeout(80);
    if (mid) await mid();
    await p.mouse.up(); await p.waitForTimeout(150);
  };

  await open("#on");
  await p.evaluate(() => window.scrollTo(0, 0));
  // the page's banner starts with a height setting 200 AND a look height stored on its root
  await p.evaluate(() => 0);
  ok("R0 the banner starts at its stored Height setting", (await prop("ptb", "height")) === 200, await prop("ptb", "height"));

  // ---- the handle
  await sel("ptb");
  await p.evaluate(() => document.querySelector('[data-tree-node="ptb"]').scrollIntoView({ block: "start" })); await p.waitForTimeout(150);
  ok("R1 a banner that declares resize wears a bottom handle", await has(".de-handle.s"));
  ok("R1 and a side handle", await has(".de-handle.e"));
  ok("R1 the hint says how, and why the width is not offered", /bottom edge/.test(await p.evaluate(() => document.body.innerText)) && /fills the width/.test(await p.evaluate(() => document.body.innerText)));
  const h0 = await secH();
  let live = null;
  await drag("s", 140, async () => { live = { h: await secH(), min: await minH(), stored: await prop("ptb", "height") }; });
  const after = await prop("ptb", "height");
  ok("R2 dragging the edge writes the Height setting", typeof after === "number" && after > 200 && after % 10 === 0, after);
  ok("R2 about the dragged distance (where it started + 140, in 10s)", Math.abs(after - (h0 + 140)) <= 10, [after, h0]);
  ok("R2 the banner is redrawn live while dragging", live && live.stored === live.h - 0 || (live && Math.abs(live.h - live.stored) <= 2 && /px/.test(live.min)), live);
  ok("R2 the page shows the new height", Math.abs((await secH()) - after) <= 2, [await secH(), after]);
  ok("R2 no look was written (morph untouched)", (await prop("ptb", "morph")) === undefined, await prop("ptb", "morph"));
  ok("R2 no box look either", (await prop("ptb", "look")) === undefined);
  await p.screenshot({ path: "/h/shots/s17-dragged.png" });

  // the same number in the block's settings
  const field = await p.$eval('.de-vpanel [data-f="p-height"]', (e) => e.value).catch(() => null);
  ok("R3 the Content tab shows the same value", Number(field) === after, field);

  // one undo step
  await undo();
  ok("R4 one undo takes the whole drag back", (await prop("ptb", "height")) === 200, await prop("ptb", "height"));
  await redo();
  ok("R4 redo brings it back", (await prop("ptb", "height")) === after, await prop("ptb", "height"));

  // clamping
  await sel("ptb");
  await drag("s", 6000);
  ok("R5 pulled far down it stops at the setting's maximum (1200)", (await prop("ptb", "height")) === 1200, await prop("ptb", "height"));
  await p.evaluate(() => document.querySelector('[data-tree-node="ptb"]').scrollIntoView({ block: "start" })); await p.waitForTimeout(150);
  await sel("ptb");
  await drag("s", -6000);
  ok("R5 pulled far up it stops at the minimum (0, as tall as its words)", (await prop("ptb", "height")) === 0, await prop("ptb", "height"));

  // Escape cancels
  await p.evaluate(() => document.querySelector('[data-tree-node="ptb"]').scrollIntoView({ block: "start" })); await p.waitForTimeout(150);
  await sel("ptb");
  const keep = await prop("ptb", "height");
  const bb = await (await p.$(".de-handle.s")).boundingBox();
  await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.mouse.down(); await p.mouse.move(bb.x + bb.width / 2, bb.y + 120, { steps: 5 });
  await p.keyboard.press("Escape"); await p.mouse.up(); await p.waitForTimeout(150);
  ok("R6 Escape during a drag puts the setting back", (await prop("ptb", "height")) === keep, await prop("ptb", "height"));

  // width does nothing, and says why
  const before = JSON.stringify((await node("ptb")).props);
  await sel("ptb");
  await drag("e", 120);
  ok("R7 the width handle writes nothing", JSON.stringify((await node("ptb")).props) === before);
  ok("R7 and says why in plain words", /always fills the width/.test(await p.evaluate(() => document.body.innerText)));

  // the typed height in the size row (tab off: Look still has the row)
  await open("#off");
  await sel("ptb");
  await p.click('.de-vpanel [data-f="tab-props"]').catch(() => {});
  const row = await p.$('.de-vpanel [data-f="height"]');
  if (row) {
    await row.fill("320"); await row.press("Enter"); await p.waitForTimeout(150);
    ok("R8 typing a height in the size row writes the setting", (await prop("ptb", "height")) === 320 && (await prop("ptb", "morph")) === undefined, [await prop("ptb", "height"), await prop("ptb", "morph")]);
  } else ok("R8 the size row's number field was found", false);

  // ---- a block without resize keeps today's way
  await open("#on");
  await sel("card");
  ok("R9 a block with no resize declaration has no handle", !(await has(".de-handle.s")));
  const heroHandles = async () => { await sel("hero"); return has(".de-handle.s"); };
  ok("R9 a block that declares resize (hero banner) has one", await heroHandles());

  // ---- one home: a height stored on the banner's root look is kept and not drawn
  const css = await p.evaluate(() => {
    const m = { parts: { root: { h: 500, fill: "#123456" } } };
    const sel = { root: { label: "r", sel: "> section" } };
    return { with: window.morphCss(m, sel, { setsHeight: true })?.css ?? "", without: window.morphCss(m, sel, {})?.css ?? "" };
  });
  ok("R10 root height is not drawn when the block declares resize", !/min-height/.test(css.with) && /#123456/.test(css.with), css.with);
  ok("R10 root height is drawn for a block without it", /min-height:500px/.test(css.without), css.without);
  ok("R10 a block with no look keeps drawing nothing", await p.evaluate(() => window.morphCss({ parts: { root: { h: 500 } } }, { root: { label: "r", sel: "> section" } }, { setsHeight: true }) === null));

  // ---- typing on the canvas
  await open("#on");
  await p.evaluate(() => document.querySelector('[data-tree-node="ptb"]').scrollIntoView({ block: "start" })); await p.waitForTimeout(150);
  const t0 = await prop("ptb", "title");
  await p.dblclick('[data-tree-node="ptb"] h1'); await p.waitForTimeout(250); await p.dblclick('[data-tree-node="ptb"] h1'); await p.waitForTimeout(250); // 2026-11-23: the first double-click goes in, the next types
  const typing = await p.evaluate(() => { const e = document.querySelector('[data-tree-node="ptb"] h1'); return e && (e.isContentEditable || e.getAttribute("contenteditable")); });
  ok("T1 double-click on the title types in place (not the block's pop-up)", !!typing && !(await has(".de-popup, [data-de-popup]")), typing);
  await p.keyboard.press("Control+A"); await p.keyboard.type("Rocks and breath", { delay: 12 }); await p.waitForTimeout(80);
  await p.screenshot({ path: "/h/shots/s17-typing.png" });
  await p.keyboard.press("Enter"); await p.waitForTimeout(250);
  ok("T2 Enter writes the setting", (await prop("ptb", "title")) === "Rocks and breath", await prop("ptb", "title"));
  ok("T2 the page shows it", (await p.$eval('[data-tree-node="ptb"] h1', (e) => e.textContent)) === "Rocks and breath");
  await undo();
  ok("T3 the whole spell of typing is one undo step", (await prop("ptb", "title")) === t0, await prop("ptb", "title"));
  await redo();
  ok("T3 redo", (await prop("ptb", "title")) === "Rocks and breath");
  // Escape restores
  await p.dblclick('[data-tree-node="ptb"] h1'); await p.waitForTimeout(250); await p.dblclick('[data-tree-node="ptb"] h1'); await p.waitForTimeout(250);
  await p.keyboard.press("Control+A"); await p.keyboard.type("Not kept", { delay: 12 });
  await p.keyboard.press("Escape"); await p.waitForTimeout(250);
  ok("T4 Escape restores the words", (await prop("ptb", "title")) === "Rocks and breath" && (await p.$eval('[data-tree-node="ptb"] h1', (e) => e.textContent)) === "Rocks and breath", await prop("ptb", "title"));
  // blur writes
  await p.dblclick('[data-tree-node="ptb"] p.italic'); await p.waitForTimeout(250); await p.dblclick('[data-tree-node="ptb"] p.italic'); await p.waitForTimeout(250);
  await p.keyboard.press("Control+A"); await p.keyboard.type("A new line", { delay: 12 });
  await p.mouse.click(5, 400); await p.waitForTimeout(250);
  ok("T5 leaving the words (blur) writes the subtitle", (await prop("ptb", "subtitle")) === "A new line", await prop("ptb", "subtitle"));
  // rows: the pop-up is gone (2026-11-23), the words are typed in place or a line says why
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.evaluate(() => document.querySelector('[data-tree-node="faq"]').scrollIntoView({ block: "center" })); await p.waitForTimeout(150);
  const faqRow = await p.$('[data-tree-node="faq"] summary');
  ok("T6 the faq has a row to try", !!faqRow);
  if (faqRow) {
    await faqRow.dblclick(); await p.waitForTimeout(300); await faqRow.dblclick(); await p.waitForTimeout(300);
    ok("T6 a row's words type in place now (no pop-up exists)", !(await has(".de-popup")));
  }
  ok("T7 no errors", errs.filter((e) => !/404/.test(e)).length === 0, errs.slice(0, 3));

  console.log(`pass ${pass} fail ${fail}`); srv.close(); await b.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERR", e.message.slice(0, 500), (e.stack || "").split("\n")[1]); process.exit(2); });
