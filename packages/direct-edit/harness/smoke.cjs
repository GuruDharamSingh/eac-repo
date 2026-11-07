// The assembled test page: click-through-test.html, production React, as published. Every view mounts,
// the Blocks view's bar works, and the stand-in holds with minified React. Run after pack-test.cjs page.
const { chromium } = require("playwright-core"); const http = require("http"), fs = require("fs");
const srv = http.createServer((q, r) => { r.writeHead(200, { "content-type": "text/html" }); r.end("<!doctype html><meta charset=utf-8>" + fs.readFileSync("/h/click-through-test.html")); });
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else { fail++; console.log("FAIL", n, x === undefined ? "" : JSON.stringify(x)); } };
(async () => { await new Promise((r) => srv.listen(8123, "127.0.0.1", r)); fs.mkdirSync("/h/shots", { recursive: true }); const b = await chromium.connectOverCDP("http://127.0.0.1:9222"); const p = b.contexts()[0].pages()[0]; const errs = []; p.on("pageerror", (e) => errs.push(e.message)); await p.setViewportSize({ width: 1400, height: 900 });
  await p.goto("http://127.0.0.1:8123/"); await p.waitForSelector(".de-vpanel .de-tabs");
  ok("blocks is the default tab", await p.$eval('.tt-tabs [data-v="blocks"]', (e) => e.getAttribute("aria-pressed") === "true"));
  const seen = async () => [(await p.$$(".de-panel")).length, (await p.$$(".de-editbar")).length, (await p.$$(".de-layer-sheet")).length];
  // Panel, top bar, selection sheet, as each view had them when this file was first written.
  const want = { blocks: "1,1,1", tree: "1,1,1", page: "1,1,1", cards: "1,0,0", sheet: "1,0,0", landing: "1,1,1" };
  ok("blocks: mounted", (await seen()).join() === want.blocks, await seen());
  ok("blocks: seed drawn", (await p.$$('#stage [data-tree-node="hero"], #stage [data-tree-node="wall"]')).length === 2);
  ok("blocks: the bar shows", await p.$eval("#tt-acts", (e) => !e.hidden && e.querySelectorAll("button").length === 2));
  await p.screenshot({ path: "/h/shots/z-test.png" });

  // Minified React: a block that throws stays in its own box, and the page as published still draws.
  const box = await p.locator('[data-tree-node="head"]').boundingBox();
  await p.mouse.click(box.x + 20, box.y + 10, { button: "right" }); await p.waitForSelector(".de-menu");
  await p.click('.de-menu [data-open="add"]'); await p.click('.de-menu [data-sub="add"] [data-mi="add:test-throw"]'); await p.waitForTimeout(60);
  ok("stand-in with production React", (await p.$$("[data-tree-standin]")).length === 1);
  ok("neighbours still drawn", (await p.$$('[data-tree-node="hero"], [data-tree-node="wall"]')).length === 2);
  await p.click("[data-a=undo]"); await p.waitForTimeout(40);
  await p.click('#tt-acts [data-tt="published"]'); await p.waitForTimeout(120);
  ok("as published draws", (await p.$$("#tt-show .blk-wall")).length === 1);
  await p.click('#tt-show [data-tt="close"]'); await p.waitForTimeout(40);
  ok("as published closes", (await p.$$("#tt-show")).length === 0);

  // Hand test step 6: what is saved comes back after a change of tab, and it holds no sample rows.
  await p.mouse.click(box.x + 20, box.y + 10, { button: "right" }); await p.waitForSelector(".de-menu");
  await p.click('.de-menu [data-open="add"]'); await p.click('.de-menu [data-sub="add"] [data-mi="add:thread-feed"]'); await p.waitForTimeout(60);
  ok("feed draws sample rows", (await p.locator("#stage").innerText()).includes("Morning Sadhana"));
  await p.click("[data-a=save]"); await p.waitForFunction(() => document.querySelector(".de-editbar-hint")?.textContent.includes("Saved"));
  await p.click('.tt-tabs [data-v="tree"]'); await p.waitForTimeout(200);
  await p.click('.tt-tabs [data-v="blocks"]'); await p.waitForTimeout(200);
  ok("feed comes back after a change of tab", (await p.locator("#stage").innerText()).includes("Morning Sadhana"));
  await p.click('#tt-acts [data-tt="saved-doc"]'); await p.waitForSelector("#tt-show pre");
  const savedText = await p.$eval("#tt-show pre", (e) => e.textContent);
  ok("saved holds the feed, no rows", savedText.includes('"thread-feed"') && !savedText.includes("Morning Sadhana"));
  await p.click('#tt-show [data-tt="close"]'); await p.waitForTimeout(40);

  for (const v of ["tree", "page", "cards", "sheet", "landing", "blocks"]) {
    await p.click(`.tt-tabs [data-v="${v}"]`); await p.waitForTimeout(250);
    const s = await seen(); console.log(v, ...s);
    ok(`${v}: mounted`, s.join() === want[v], s);
    ok(`${v}: the bar ${v === "blocks" ? "shows" : "is hidden"}`, await p.$eval("#tt-acts", (e) => getComputedStyle(e).display === "none") === (v !== "blocks"));
  }
  await p.screenshot({ path: "/h/shots/z-land.png" });
  ok("no page errors", errs.length === 0, errs.slice(0, 3));
  console.log(`pass ${pass} fail ${fail}`); srv.close(); await b.close(); process.exit(fail ? 1 : 0); })().catch((e) => { console.log("ERR", e.message.slice(0, 300)); process.exit(2); });
