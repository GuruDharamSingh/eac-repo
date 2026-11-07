const { chromium } = require("playwright-core"); const http = require("http"), fs = require("fs"), path = require("path");
const srv = http.createServer((q, r) => { const f = path.join("/h", q.url.split("?")[0].split("#")[0]); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { "content-type": f.endsWith(".css") ? "text/css" : f.endsWith(".js") ? "text/javascript" : "text/html" }); r.end(d); }); });
const out = {}; const log = (k, v) => { out[k] = v; };
(async () => {
  await new Promise((r) => srv.listen(8123, "127.0.0.1", r));
  const b = await chromium.connectOverCDP("http://127.0.0.1:9222"); const p = b.contexts()[0].pages()[0];
  p.setDefaultTimeout(20000); await p.setViewportSize({ width: 1500, height: 950 });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("dialog", (d) => d.accept().catch(() => {}));
  await p.addInitScript(() => { let s = 12345; Math.random = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; });
  const panel = () => p.evaluate(() => (document.querySelector(".de-vpanel")?.innerHTML ?? "").replace(/<div data-sync="notice" hidden(="")?><\/div>/g, ""));
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
  log("errors", errs); fs.writeFileSync("/h/parity2.json", JSON.stringify(out, null, 1));
  console.log("probe2 keys", Object.keys(out).length, "errors", errs.length); srv.close(); await b.close(); process.exit(0);
})().catch((e) => { fs.writeFileSync("/h/parity2.json", JSON.stringify(out, null, 1)); console.log("ERR", e.message.slice(0, 400)); process.exit(2); });
