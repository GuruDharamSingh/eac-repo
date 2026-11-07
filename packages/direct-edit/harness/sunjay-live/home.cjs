const { chromium } = require("playwright-core"); const http = require("http"), fs = require("fs"), path = require("path");
const visitor = fs.readFileSync("/h/home/visitor.html", "utf8").replace(/<script\b[\s\S]*?<\/script>/g, "").replace(/<link[^>]*>/g, "");
let page = visitor.replace("</head>", `<link rel=stylesheet href=/site.css><link rel=stylesheet href=/editor.css></head>`).replace("</body>", `<script src=/home.js></script></body>`);
const types = { css: "text/css", js: "text/javascript", jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
const file = (u) => (u === "/site.css" ? "/h/home/site.css" : u === "/editor.css" ? "/h/editor.css" : u === "/home.js" ? "/h/home.js" : u.startsWith("/api/media/") ? "/h/home/media/" + path.basename(decodeURIComponent(u)) : null);
const srv = http.createServer((q, r) => { const f = file(q.url.split("?")[0]); if (f && fs.existsSync(f)) { r.writeHead(200, { "content-type": types[f.split(".").pop()] || "application/octet-stream" }); r.end(fs.readFileSync(f)); return; } r.writeHead(f ? 404 : 200, { "content-type": "text/html" }); r.end(f ? "" : page); });
(async () => {
  await new Promise((r) => srv.listen(8123, "127.0.0.1", r));
  const b = await chromium.connectOverCDP("http://127.0.0.1:9222"); const p = b.contexts()[0].pages()[0];
  p.setDefaultTimeout(9000); await p.setViewportSize({ width: 1500, height: 950 });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message.slice(0, 220))); p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errs.push("console: " + m.text().slice(0, 220)); });
  const dialogs = []; p.on("dialog", async (d) => { dialogs.push(d.message().slice(0, 60)); await d.accept(); });
  await p.goto("http://127.0.0.1:8123/"); await p.waitForTimeout(300);
  // The live page predates these markers until the next go-live: written here as app/page.tsx writes them, then served so the page's fetch of itself gets them too.
  page = await p.evaluate(() => {
    const wrap = (el, id) => { const d = document.createElement("div"); d.dataset.landingBlock = id; el.replaceWith(d); d.append(el); };
    const img = document.querySelector(".pts-banner > img"); img.dataset.landingPart = "banner"; img.dataset.editName = "Banner picture";
    document.querySelector(".pts-hero__stage").dataset.landingBlock = "home-stage";
    document.querySelector(".landing-standing").dataset.landingBlock = "home-standing";
    wrap(document.querySelector(".landing-standing + .eac-face"), "home-forum");
    wrap(document.querySelector(".pts-split--center > .ifs-join"), "home-join");
    return "<!doctype html>" + document.documentElement.outerHTML;
  });
  fs.writeFileSync("/h/home/marked.html", page);
  await p.goto("http://127.0.0.1:8123/"); await p.waitForTimeout(500);
  await p.screenshot({ path: "/h/shots/h0-visitor.png", fullPage: true });
  const rects = (root) => p.$$eval(`${root} .pts-panel, ${root} .pts-banner, ${root} .ifs-stage, ${root} .eac-face, ${root} .ifs-join`, (l) => l.map((e) => { const r = e.getBoundingClientRect(); return [e.className.split(" ")[0], Math.round(r.width), Math.round(r.height)]; }));
  const before = await rects(".pts-snap");
  await p.evaluate(() => globalThis.__open(null, "first save notice")); await p.waitForSelector(".de-vpanel"); await p.waitForTimeout(800);
  await p.screenshot({ path: "/h/shots/h1-editor.png" });
  const host = ".pts-snap:not([style*='display: none'])";
  // The page's width changes under the panel, so compare heights in a page laid out at the same width: close the panel first.
  console.log("types:", await p.evaluate(() => [...document.querySelectorAll("[data-tree-node]")].length), "live blocks:", await p.$$eval("[data-landing-block]", (l) => l.map((e) => e.dataset.landingBlock)).then((x) => x.filter(Boolean)));
  console.log("signed-in words in the tree:", await p.evaluate(() => /You are signed in|Edit series/.test(document.querySelector(".pts-snap:not([style*='none'])").textContent)));
  const sel = (id) => `.pts-snap:not([style*="none"]) [data-landing-block="${id}"]`;
  const box = (s) => p.$eval(s, (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  const head = () => p.locator(".de-vpanel .de-head b, .de-popup .de-head b").first().innerText();
  for (const id of ["home-stage", "home-standing", "home-forum", "home-join"]) {
    await p.locator(sel(id)).first().scrollIntoViewIfNeeded(); await p.waitForTimeout(200);
    const bb = await box(sel(id)); await p.mouse.dblclick(bb.x + bb.w / 2, bb.y + Math.min(bb.h / 2, 60)); await p.waitForSelector(".de-popup"); await p.waitForTimeout(450);
    console.log(id, "popup rows:", await p.$$eval(".de-popup .de-layer b", (l) => l.map((e) => e.textContent).join(" | ")));
    await p.screenshot({ path: `/h/shots/h2-${id}.png` });
    if (id === "home-forum") {
      const row = async (name) => { await p.locator(".de-popup .de-layer").filter({ has: p.locator(`b:text-is("${name}")`) }).first().click(); await p.waitForTimeout(220); };
      await row("Topic title"); console.log("selected:", await p.locator(".de-popup .de-head b").first().innerText());
      await row("Card"); console.log("card shapes:", await p.$$eval(".de-popup .de-arr-shape button", (l) => l.map((e) => e.textContent).join(" | ")));
      await p.click('.de-popup [data-arr="as:c2"]'); await p.waitForTimeout(300);
      await p.screenshot({ path: "/h/shots/h3-forum-c2.png" });
      await p.click('.de-popup [data-a="save"]'); await p.waitForTimeout(350);
    } else if (id === "home-stage") {
      const row = async (name) => { await p.locator(".de-popup .de-layer").filter({ has: p.locator(`b:text-is("${name}")`) }).first().click(); await p.waitForTimeout(220); };
      await row("Stage"); console.log("stage shapes:", await p.$$eval(".de-popup .de-arr-shape button", (l) => l.map((e) => e.textContent).join(" | ")));
      console.log("stage order:", await p.$$eval(".de-popup .de-arr-name", (l) => l.map((e) => e.textContent).join(" | ")));
      await p.click('.de-popup [data-arr="move:media:-1"]'); await p.waitForTimeout(300);
      await p.screenshot({ path: "/h/shots/h3-stage-swapped.png" });
      await p.click('.de-popup [data-a="save"]'); await p.waitForTimeout(350);
    } else {
      await p.click('.de-popup [data-a="done"], .de-popup [data-a="close"]').catch(() => {}); await p.waitForTimeout(350);
      if (await p.locator(".de-popup").count()) { await p.keyboard.press("Escape"); await p.waitForTimeout(150); await p.keyboard.press("Escape"); await p.waitForTimeout(250); }
    }
    console.log("  popup closed:", (await p.locator(".de-popup").count()) === 0);
  }
  // Retype a heading in place, then save.
  await p.click('.de-pill [data-a="save"]'); await p.waitForTimeout(600);
  console.log("notices on save:", dialogs);
  const saved = await p.evaluate(() => globalThis.__saved);
  fs.writeFileSync("/h/home/saved.json", JSON.stringify(saved));
  const types_ = {}; const walk = (l) => { for (const n of l || []) { types_[n.type] = (types_[n.type] || 0) + 1; for (const v of Object.values(n.props)) if (Array.isArray(v) && v.some((x) => x && x.props)) walk(v); } }; walk(saved.content);
  console.log("saved node types:", JSON.stringify(types_), "bytes", JSON.stringify(saved).length);
  console.log("signed-in or live text stored:", /You are signed in|Edit series|eac-forum-mini|Hosted by/.test(JSON.stringify(saved)));
  const parts = await p.evaluate(() => { const o = {}; document.querySelectorAll(".pts-snap[style*='none'] [data-landing-block]").forEach((e) => { o[e.dataset.landingBlock] = e.innerHTML; }); document.querySelectorAll(".pts-snap[style*='none'] [data-landing-part]").forEach((e) => { o[e.dataset.landingPart] = e.outerHTML; }); return o; });
  fs.writeFileSync("/h/home/parts.json", JSON.stringify(parts));
  console.log("errors", errs.length, [...new Set(errs)].slice(0, 6));
  await p.screenshot({ path: "/h/shots/h4-after-save.png" });
  console.log("before(px):", JSON.stringify(before.slice(0, 12)));
  await b.close(); srv.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
