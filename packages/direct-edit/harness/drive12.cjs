const { chromium } = require("playwright-core");
const http = require("http"), fs = require("fs"), path = require("path");
const srv = http.createServer((q, r) => { const f = path.join("/h", q.url.split("?")[0]); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { "content-type": f.endsWith(".css") ? "text/css" : f.endsWith(".js") ? "text/javascript" : "text/html" }); r.end(d); }); });
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else { fail++; console.log("FAIL", n, x === undefined ? "" : JSON.stringify(x)); } };
(async () => {
  await new Promise((r) => srv.listen(8123, "127.0.0.1", r));
  const b = await chromium.connectOverCDP("http://127.0.0.1:9222"); const p = b.contexts()[0].pages()[0];
  p.setDefaultTimeout(15000); await p.setViewportSize({ width: 1400, height: 950 });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://127.0.0.1:8123/landing.html", { waitUntil: "domcontentloaded" }); await p.waitForTimeout(400);
  const shape = (scope) => p.$$eval(`${scope} .ig-hero-title, ${scope} .ig-hero-tagline, ${scope} .ig-hero-subtitle, ${scope} .ig-hero-actions, ${scope} .section-heading, ${scope} .about-lead, ${scope} blockquote, ${scope} .fundraising-section, ${scope} .board-section, ${scope} [data-landing-part]`, (els) => els.map((e) => { const r = e.getBoundingClientRect(); return [e.tagName, (e.className || "").toString().split(" ")[0] || e.dataset?.landingPart || "", (e.textContent || "").trim().slice(0, 14), Math.round(r.width), Math.round(r.height)]; }));
  await p.evaluate(() => document.querySelectorAll(".reveal").forEach((e) => e.classList.add("in-view")));
  await p.waitForTimeout(900);
  const original = await shape(".marketing-root");
  console.log("elements", original.length);
  await p.screenshot({ path: "/h/shots/l-coded.png" });

  // Convert, with the red hero you saved
  const skipped = await p.evaluate(() => window.openIt(null, { v: 1, boxes: { '[data-edit-section="hero"]': { style: { fill: "#c60c0c" } } } }));
  console.log("skipped", JSON.stringify(skipped));
  await p.waitForSelector(".de-vpanel .de-tabs"); await p.waitForTimeout(300);
  ok("nothing lost in converting", skipped.length === 0, skipped);
  const doc = await p.evaluate(() => window.ed.doc());
  const flat = JSON.stringify(doc);
  console.log("doc bytes", flat.length, "top", doc.content.map((n) => n.props.part || n.props.label || n.props.tag).join(" | "));
  const partsKept = (flat.match(/"type":"part"/g) || []).length; ok("live parts kept live", partsKept === 9, partsKept);
  ok("your red hero carried over", flat.includes("#c60c0c"));
  ok("classes kept", flat.includes("ig-hero-title") && flat.includes("about-lead"));
  ok("no script hook left", !flat.includes('"reveal"'));
  ok("the coded page is hidden, not gone", await p.$eval(".marketing-root", (e) => e.style.display === "none"));
  const rows = await p.$$eval(".de-layers li", (e) => e.map((x) => x.querySelector(".de-layer b").textContent + (x.querySelector(".de-layer span:not(.de-kind)") ? " " + x.querySelector(".de-layer span:not(.de-kind)").textContent : "")));
  console.log("TREE", rows.slice(0, 16).join(" / "));
  await p.screenshot({ path: "/h/shots/l-tree.png" });

  // Same as the coded page? Panel closed, so the width is the same.
  await p.click('[data-a="panel"]'); await p.waitForTimeout(800);
  const redHero = await p.locator('header.ig-hero').last().evaluate((e) => getComputedStyle(e).backgroundColor);
  ok("red hero drawn", redHero === "rgb(198, 12, 12)", redHero);
  await p.evaluate(() => document.documentElement.classList.remove("de-editing"));
  const inTree = await shape("div.marketing-root:not([style*='none'])");
  await p.evaluate(() => document.documentElement.classList.add("de-editing"));
  const diff = original.map((a, i) => (JSON.stringify(a) === JSON.stringify(inTree[i]) ? null : [a, inTree[i]])).filter(Boolean);
  console.log("parity", original.length, inTree.length, JSON.stringify(diff).slice(0, 600));
  ok("same order and sizes as the coded page", original.length === inTree.length && diff.length === 0);
  await p.screenshot({ path: "/h/shots/l-tree-nopanel.png" });
  await p.click('[data-a="panel"]'); await p.waitForTimeout(100);

  // Live part is sealed; hero words are boxes
  await p.locator('.de-layers li').filter({ hasText: "What's on" }).first().locator(".de-layer").click(); await p.waitForTimeout(40);
  ok("live part explains itself", (await p.textContent(".de-vpanel")).includes("stays live"));
  ok("no detach on a live part", (await p.$$('[data-tree-act="detach"]')).length === 0);
  const title = p.locator(".ig-hero-title").last();
  await p.keyboard.press("Escape"); await p.keyboard.press("Escape");
  await p.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" })); await p.waitForTimeout(150);
  const tb = await title.boundingBox(); const tx = tb.x + 40, ty = tb.y + 20;
  const headNow = () => p.$eval(".de-vpanel .de-head b", (e) => e.textContent).catch(() => null);
  const seq = []; for (let i = 0; i < 4 && (await headNow()) !== "Heading"; i++) { await p.mouse.click(tx, ty); await p.waitForTimeout(40); seq.push(await headNow()); }
  console.log("sequence", seq.join(" > ")); ok("click through to the heading", seq.at(-1) === "Heading", seq);
  ok("thin bar on the real heading", await p.$eval(".de-mb", (e) => !e.hidden));
  await p.screenshot({ path: "/h/shots/l-heading.png" });

  // THE MOVE: the heading out of the hero, into the About section
  const about = await p.locator(".about-section").last().boundingBox();
  const before = JSON.stringify(await p.evaluate(() => window.ed.doc())).length;
  // Drag within view: heading into the sign-in row's parent neighbour, the hero figure
  const fig = await p.locator(".ig-hero-figure").last().boundingBox();
  await p.mouse.move(tx, ty); await p.mouse.down(); await p.mouse.move(tx + 10, ty + 10, { steps: 2 }); await p.mouse.move(fig.x + fig.width / 2, fig.y + fig.height / 2, { steps: 10 });
  await p.screenshot({ path: "/h/shots/l-move.png" });
  await p.mouse.up(); await p.waitForTimeout(60);
  ok("heading moved into another box", await p.locator(".ig-hero-figure").last().evaluate((e) => !!e.querySelector(".ig-hero-title")));
  await p.click("[data-a=undo]"); await p.waitForTimeout(50);
  ok("undo returns it", await p.locator(".ig-hero-copy").last().evaluate((e) => !!e.querySelector(".ig-hero-title")));
  await p.click("[data-a=redo]"); await p.waitForTimeout(50);

  // Save, then draw it as a visitor would
  await p.click("[data-a=save]"); await p.waitForFunction(() => window.saved.length > 0);
  const saved = await p.evaluate(() => window.saved.at(-1));
  fs.writeFileSync("/h/landing-doc.json", JSON.stringify(saved));
  const check = await p.evaluate((s) => window.kit.validatePage(s, new Set(Object.keys(window.kit.config.components))), saved);
  ok("a valid page", check.ok && check.warnings.length === 0, check);
  ok("under the size limit", JSON.stringify(saved).length < 512 * 1024, JSON.stringify(saved).length);
  const stored = await p.evaluate((s) => window.kit.cleanBoxDoc(window.kit.sanitizeRichValues(s)), saved);
  ok("clean and stable", JSON.stringify(stored) === JSON.stringify(saved));
  const parts = await p.evaluate(() => { const o = {}; document.querySelectorAll(".marketing-root [data-landing-part]").forEach((e) => { o[e.dataset.landingPart] = o[e.dataset.landingPart] || e.outerHTML; }); return o; });
  await p.click('[data-a="panel"]'); await p.waitForTimeout(100);
  const edited = await shape("div.marketing-root:not([style*='none'])");
  await p.evaluate(([s, pts]) => { window.onbeforeunload = null; window.ed.dispose(); document.querySelectorAll(".marketing-root").forEach((e) => { e.style.display = "none"; }); document.documentElement.classList.remove("de-editing", "de-vpanel-open"); window.published(s, pts); }, [stored, parts]);
  await p.waitForTimeout(800);
  const pub = await shape("#pub");
  const diff2 = edited.map((a, i) => (JSON.stringify(a) === JSON.stringify(pub[i]) ? null : [a, pub[i]])).filter(Boolean);
  console.log("published parity", edited.length, pub.length, JSON.stringify(diff2).slice(0, 500));
  ok("visitor page matches the editor", edited.length === pub.length && diff2.length === 0);
  ok("anchors survive", (await p.locator("#pub #about").count()) === 1 && (await p.locator("#pub #board").count()) === 1);
  await p.screenshot({ path: "/h/shots/l-published.png", fullPage: false });
  ok("no errors", errs.length === 0, errs.slice(0, 3));
  console.log(`pass ${pass} fail ${fail}`); srv.close(); await b.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERR", e.message.slice(0, 500), (e.stack || "").split("\n").find((l) => l.includes("drive12"))); process.exit(2); });
