// With the panel scrolled to its end, the Detach button must be what is under the pointer, at common window sizes.
const { chromium } = require("playwright-core"); const http = require("http"), fs = require("fs");
const srv = http.createServer((q, r) => { r.writeHead(200, { "content-type": "text/html" }); r.end("<!doctype html><meta charset=utf-8>" + fs.readFileSync("/h/click-through-test.html")); });
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log(`TRACE ${c ? "ok" : "FAIL"} ${n} ${JSON.stringify(x)}`); };
(async () => {
  await new Promise((r) => srv.listen(8123, "127.0.0.1", r));
  const b = await chromium.connectOverCDP("http://127.0.0.1:9222"); const p = b.contexts()[0].pages()[0]; p.setDefaultTimeout(12000); p.on("dialog", (d) => d.accept().catch(() => {}));
  const check = () => p.evaluate(() => {
    const body = document.querySelector(".de-vpanel .de-body"); body.scrollTop = body.scrollHeight;
    const q = (s) => document.querySelector(s);
    const btn = q('.de-vpanel [data-f="detach-block"]').getBoundingClientRect(), why = q('.de-vpanel [data-f="detach-why"]')?.getBoundingClientRect(), tabs = q(".tt-tabs").getBoundingClientRect();
    const at = document.elementFromPoint(btn.left + btn.width / 2, btn.top + btn.height / 2);
    return { clear: at?.dataset?.f === "detach-block", whyClear: why ? why.bottom <= tabs.top : null, btn: [Math.round(btn.top), Math.round(btn.bottom)], tabsTop: Math.round(tabs.top), vh: innerHeight, off: q('.de-vpanel [data-f="detach-block"]').disabled };
  });
  for (const [w, h] of [[1500, 950], [1280, 720], [1920, 1080], [1366, 768]]) {
    await p.setViewportSize({ width: w, height: h }); await p.goto("about:blank"); await p.goto("http://127.0.0.1:8123/"); await p.waitForSelector(".de-vpanel .de-tabs"); await p.waitForTimeout(200);
    const l = p.locator('#stage [data-tree-node="head"]'); await l.scrollIntoViewIfNeeded(); await p.waitForTimeout(80); const bb = await l.boundingBox();
    await p.mouse.click(bb.x + 300, bb.y + 20, { button: "right" }); await p.waitForSelector(".de-menu"); await p.click('.de-menu [data-open="add"]'); await p.waitForTimeout(30); await p.click('.de-menu [data-sub="add"] [data-mi="add:thread-feed"]'); await p.waitForTimeout(100);
    const feed = await check();
    ok(`${w}x${h} Feed: grey Detach and its reason clear of the tabs`, feed.clear && feed.whyClear && feed.off, feed);
    await p.waitForTimeout(60); await p.screenshot({ path: `/h/shots/walk-tabs-feed-${w}.png` });
    const hero = p.locator('#stage [data-tree-node="hero"]'); await hero.scrollIntoViewIfNeeded(); await p.waitForTimeout(80); const hb = await hero.boundingBox(); await p.mouse.click(hb.x + hb.width / 2, hb.y + hb.height * 0.3); await p.waitForTimeout(80);
    const on = await check();
    ok(`${w}x${h} Hero: Detach clear of the tabs`, on.clear && !on.off, on);
    await p.click('.de-vpanel [data-f="detach-block"]'); await p.waitForTimeout(100);
    ok(`${w}x${h} Hero: a real click detaches`, (await p.$$('#stage [data-tree-node="hero"]')).length === 0);
  }
  console.log(`pass ${pass} fail ${fail}`); srv.close(); await b.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("ERR", e.message.slice(0, 400)); process.exit(2); });
