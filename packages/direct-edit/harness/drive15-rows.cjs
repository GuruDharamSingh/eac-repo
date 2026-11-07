// Layer rows dragged in the canvas tree editor (2026-11-07): tree.html, the page tree with own boxes, words,
// a picture, a grid and sealed blocks. A row pulled onto another row lands before or after it in that row's
// slot; the middle of a box's row puts it at the end of the box. One undo step; Escape cancels; a node never
// goes into itself. Run with harness/runall.sh drive15-rows.cjs (S=<scratch>, harness copied to $S/h3).
const { chromium } = require("playwright-core");
const http = require("http"), fs = require("fs"), path = require("path");
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==", "base64");
const srv = http.createServer((q, r) => { if (q.url.startsWith("/pic.png")) { r.writeHead(200, { "content-type": "image/png" }); r.end(PNG); return; } const f = path.join("/h", q.url.split("?")[0]); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { "content-type": f.endsWith(".css") ? "text/css" : f.endsWith(".js") ? "text/javascript" : "text/html" }); r.end(d); }); });
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else { fail++; console.log("FAIL", n, x === undefined ? "" : JSON.stringify(x)); } };

(async () => {
  await new Promise((r) => srv.listen(8123, "127.0.0.1", r));
  const b = await chromium.connectOverCDP("http://127.0.0.1:9222"); const p = b.contexts()[0].pages()[0];
  p.setDefaultTimeout(15000); await p.setViewportSize({ width: 1500, height: 950 });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message.slice(0, 300))); p.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 300)); });
  const open = async () => { await p.goto("about:blank"); await p.goto("http://127.0.0.1:8123/tree.html"); await p.waitForSelector(".de-vpanel .de-layers li[data-row]"); await p.waitForTimeout(150); };

  // The page's shape as ids: "head,A[w1,w2],B[w3,p1],G[pr],E[]".
  const shape = () => p.evaluate(() => {
    const kids = (n) => Object.values(n.props).find((v) => Array.isArray(v) && (v.length === 0 ? ["box", "grid"].includes(n.type) : v.every((k) => k && k.type && k.props)));
    const draw = (list) => list.map((n) => { const k = kids(n); return n.props.id + (k ? `[${draw(k)}]` : ""); }).join(",");
    return draw(window.ed.doc().content);
  });
  const row = (id) => p.locator(`.de-layers li[data-row="${id}"]`).first();
  /** Pull row `from` onto row `to`: where = before | after | inside. `esc` presses Escape before letting go. */
  const drag = async (from, to, where, esc = false) => {
    const a = await row(from).locator(".de-layer").first().boundingBox();
    await row(to).scrollIntoViewIfNeeded();
    const t = await row(to).locator(".de-layer").first().boundingBox();
    const y = where === "before" ? t.y + 2 : where === "after" ? t.y + t.height - 2 : t.y + t.height / 2;
    await p.mouse.move(a.x + 30, a.y + a.height / 2);
    await p.mouse.down();
    await p.mouse.move(a.x + 30, a.y + a.height / 2 + 12, { steps: 3 });
    await p.mouse.move(t.x + 40, y, { steps: 6 });
    await p.waitForTimeout(40);
    const seen = await p.evaluate(() => ({ line: !!document.querySelector(".de-insert:not([hidden])"), outlined: !!document.querySelector(".de-layers li.de-drop"), ghost: document.querySelector(".de-ghost")?.textContent ?? null }));
    if (esc) await p.keyboard.press("Escape");
    await p.mouse.up();
    await p.waitForTimeout(80);
    return seen;
  };
  const undo = async () => { await p.click("[data-a=undo]"); await p.waitForTimeout(60); };

  await open();
  const start = await shape();
  ok("start shape", start === "head,A[w1,w2],B[w3,p1],G[pr],E[]", start);
  const marks = await p.evaluate(() => ({
    drag: [...document.querySelectorAll(".de-layers li[data-drag]")].map((l) => l.dataset.drag),
    page: !!document.querySelector('.de-layers li[data-row="root"][data-drag]'),
  }));
  ok("every page node's row is draggable", ["head", "A", "w1", "w2", "B", "w3", "p1", "G", "pr", "E"].every((id) => marks.drag.includes(id)), marks.drag);
  ok("the Page row is not draggable", !marks.page);
  ok("no part or marked-run row is draggable", marks.drag.every((r) => !r.includes("~") && !r.includes(":")), marks.drag);

  // Words out of one box, after words in another.
  let seen = await drag("w1", "w3", "after");
  ok("a line shows while pulling over a words row", seen.line && !seen.outlined, seen);
  ok("the ghost names what moves", /^move /.test(seen.ghost ?? ""), seen.ghost);
  ok("w1 lands after w3 in B", (await shape()) === "head,A[w2],B[w3,w1,p1],G[pr],E[]", await shape());
  const drawn = await p.evaluate(() => { const b = document.querySelector('[data-tree-node="B"]'); return [...b.querySelectorAll("[data-tree-node]")].map((e) => e.dataset.treeNode).join(","); });
  ok("the page redraws in the new order", drawn === "w3,w1,p1", drawn);
  await undo();
  ok("one undo puts it back", (await shape()) === start, await shape());

  // Before, in the same list, moving down and up.
  await drag("head", "G", "before");
  ok("a top-level block moves down among the page's blocks", (await shape()) === "A[w1,w2],B[w3,p1],head,G[pr],E[]", await shape());
  await undo();
  await drag("E", "A", "before");
  ok("and up", (await shape()) === "head,E[],A[w1,w2],B[w3,p1],G[pr]", await shape());
  await undo();

  // Into a box: the middle of its row.
  seen = await drag("B", "E", "inside");
  ok("the middle of a box's row outlines it", seen.outlined && !seen.line, seen);
  ok("B goes inside the empty box E", (await shape()) === "head,A[w1,w2],G[pr],E[B[w3,p1]]", await shape());
  await undo();
  seen = await drag("p1", "A", "inside");
  ok("a picture goes to the end of box A", (await shape()) === "head,A[w1,w2,p1],B[w3],G[pr],E[]", await shape());
  await undo();
  // A sealed block out of the grid, and the middle of a words row is still before/after (words hold nothing).
  await drag("pr", "w2", "inside");
  const s1 = await shape();
  ok("a sealed block leaves the grid beside words (words take nothing inside)", s1 === "head,A[w1,pr,w2],B[w3,p1],G[],E[]" || s1 === "head,A[w1,w2,pr],B[w3,p1],G[],E[]", s1);
  await undo();

  // Never into itself.
  seen = await drag("A", "w2", "after");
  ok("a box is not offered its own child's row", !seen.line && !seen.outlined, seen);
  ok("nothing moved", (await shape()) === start, await shape());

  // Escape cancels.
  seen = await drag("w3", "w1", "before", true);
  ok("the line showed before Escape", seen.line, seen);
  ok("Escape: nothing moved", (await shape()) === start, await shape());
  ok("Escape: the ghost is gone", await p.evaluate(() => !document.querySelector(".de-ghost") && !document.querySelector(".de-insert")));

  // A plain click on a row still selects it.
  await row("w2").locator(".de-layer").first().click();
  await p.waitForTimeout(60);
  ok("a click still selects", await p.evaluate(() => document.querySelector('.de-layers li[data-row="w2"]')?.classList.contains("on")));
  ok("the click moved nothing", (await shape()) === start, await shape());

  // Saved document is clean and valid after a move.
  await drag("w1", "w3", "before");
  const valid = await p.evaluate(() => { const d = window.kit.cleanBoxDoc(window.ed.doc()); return !!window.kit.validatePage(d); });
  ok("the moved document still validates", valid);
  ok("no errors", errs.length === 0, errs.slice(0, 3));
  console.log(`pass ${pass} fail ${fail}`); srv.close(); await b.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERR", e.message.slice(0, 500), (e.stack || "").split("\n").find((l) => l.includes("drive15"))); process.exit(2); });
