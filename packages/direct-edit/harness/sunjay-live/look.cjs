const { chromium } = require("playwright-core"); const http = require("http"), fs = require("fs");
const page = `<!doctype html><meta charset=utf-8><link rel=stylesheet href=/site.css><link rel=stylesheet href=/editor.css><body class="dark"><div id="host" style="min-height:100vh"></div><script src=/live.js></script>`;
const types = { css: "text/css", js: "text/javascript" };
const srv = http.createServer((q, r) => { const m = q.url.match(/^\/(site\.css|editor\.css|live\.js)$/); if (m) { r.writeHead(200, { "content-type": types[m[1].split(".").pop()] }); r.end(fs.readFileSync("/h/" + m[1])); return; } r.writeHead(200, { "content-type": "text/html" }); r.end(page); });
(async () => {
  await new Promise((r) => srv.listen(8123, "127.0.0.1", r)); fs.mkdirSync("/h/shots", { recursive: true });
  const b = await chromium.connectOverCDP("http://127.0.0.1:9222"); const p = b.contexts()[0].pages()[0];
  p.setDefaultTimeout(9000); await p.setViewportSize({ width: 1500, height: 950 });
  const errs = []; p.on("pageerror", (e) => errs.push((e.stack||e.message).slice(0, 420))); p.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 220)); });
  await p.goto("http://127.0.0.1:8123/"); await p.waitForSelector(".de-vpanel", { timeout: 15000 }).catch(async (e) => { console.log("no panel; errors:", errs.slice(0, 6)); console.log("body:", (await p.locator("body").innerText()).slice(0, 300)); await p.screenshot({ path: "/h/shots/00-fail.png" }); await b.close(); process.exit(1); }); await p.waitForTimeout(600);
  await p.screenshot({ path: "/h/shots/00-canvas.png" });
  const box = (sel) => p.$eval(sel, (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  for (const id of ["try-feed-cards", "try-standing", "try-profile", "try-calendar", "try-feed-list", "try-forum", "try-writing", "try-gallery"]) {
    const sel = `[data-tree-node="${id}"]`;
    try {
      const l = p.locator(sel).first(); await l.scrollIntoViewIfNeeded(); await p.waitForTimeout(150);
      const bb = await box(sel); await p.mouse.dblclick(bb.x + bb.w / 2, Math.max(bb.y + 90, 90)); await p.waitForTimeout(600);
      const open = await p.locator(".de-popup").count();
      console.log("==", id, Math.round(bb.w) + "x" + Math.round(bb.h), "popup", open, "standin", await p.locator(`${sel}[data-tree-standin]`).count());
      if (open) {
        console.log("  head:", await p.locator(".de-popup .de-head b").first().innerText().catch(() => "?"));
        console.log("  rows:", await p.$$eval(".de-popup .de-layers li", (l) => l.map((e) => e.innerText.replace(/\s+/g, " ").trim().slice(0, 20)).join(" | ")));
        console.log("  stage:", (await p.locator(".de-popup-stage").innerText()).replace(/\s+/g, " ").slice(0, 120));
        await p.screenshot({ path: `/h/shots/${id}.png` });
        await p.keyboard.press("Escape"); await p.waitForTimeout(200);
        if (await p.locator(".de-popup").count()) { await p.keyboard.press("Escape"); await p.waitForTimeout(250); }
        console.log("  closed:", (await p.locator(".de-popup").count()) === 0);
      }
    } catch (e) { console.log("==", id, "FAILED", e.message.slice(0, 200)); }
  }
  console.log("errors", errs.length, [...new Set(errs)].slice(0, 8));
  await b.close(); srv.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
