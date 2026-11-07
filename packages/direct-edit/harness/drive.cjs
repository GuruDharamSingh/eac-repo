const { chromium } = require("playwright-core");
const http = require("http"), fs = require("fs"), path = require("path");
const srv = http.createServer((q, r) => { const f = path.join("/h", q.url.split("?")[0].split("#")[0]); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { "content-type": f.endsWith(".css") ? "text/css" : f.endsWith(".js") ? "text/javascript" : "text/html" }); r.end(d); }); });
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) pass++; else { fail++; console.log("FAIL", n, x === undefined ? "" : JSON.stringify(x)); } };
const cen = async (p, id) => { const b = await p.locator("#" + id).boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
const tags = (p, sel) => p.$$eval(sel, (e) => e.map((x) => x.textContent));
(async () => {
  await new Promise((r) => srv.listen(8123, "127.0.0.1", r));
  const b = await chromium.connectOverCDP("http://127.0.0.1:9222");
  const ctx = b.contexts()[0]; const p = ctx.pages()[0];
  p.on("pageerror", (e) => { ok("pageerror", false, e.message); });
  await p.setViewportSize({ width: 1300, height: 900 });
  await p.goto("http://127.0.0.1:8123/visual.html");
  const sel = () => p.evaluate(() => window.ct.selected()?.id ?? null);
  const hovTag = async () => (await tags(p, ".de-layer-sheet .de-box.hov .de-tag"))[0] ?? null;
  const selTag = async () => (await tags(p, ".de-layer-sheet .de-box:not(.hov):not(.kid) .de-tag"))[0] ?? null;
  const kids = () => p.$$eval(".de-layer-sheet .de-box.kid", (e) => e.length);
  const [tx, ty] = await cen(p, "b1");
  await p.mouse.move(tx, ty);
  ok("hover starts outermost", /^.*Landing/.test(await hovTag() ?? ""), await hovTag());
  const seq = [];
  for (let i = 0; i < 6; i++) { await p.mouse.click(tx, ty); seq.push(await p.evaluate(() => { const s = window.ct.selected(); return s.id || s.tagName; })); await p.mouse.move(tx + 1, ty); }
  console.log("click sequence", seq.join(" > "));
  ok("sequence", seq.slice(0, 4).join() === "page,band,c1,p1", seq);
  ok("stops at leaf", seq[5] === "p1", seq);
  ok("b is not a layer", !seq.includes("b1"));
  await p.screenshot({ path: "/h/shots/v-leaf.png" });
  await p.keyboard.press("Escape"); ok("esc up", (await sel()) === "c1", await sel());
  ok("reveal shows c1's boxes", (await kids()) === 3, await kids());
  const c = await p.evaluate(() => window.api.layerChain(document.getElementById("h1a"), document.getElementById("page")).map((e) => e.id));
  ok("wrapper collapsed", !c.includes("wrap1") && c.includes("h1a"), c);
  // Beside the selection: neighbour, not its insides
  const [hx, hy] = await cen(p, "h2a"); await p.mouse.move(hx, hy);
  ok("hover neighbour", (await hovTag() ?? "").startsWith("Column"), await hovTag());
  await p.screenshot({ path: "/h/shots/v-neighbour.png" });
  await p.mouse.click(hx, hy); ok("click neighbour", (await sel()) === "c2", await sel());
  await p.keyboard.press("Enter"); ok("enter first child", (await sel()) === "h2a", await sel());
  await p.keyboard.press("Escape"); await p.keyboard.press("Escape"); await p.keyboard.press("Escape"); await p.keyboard.press("Escape");
  ok("esc to nothing", (await sel()) === null, await sel());
  // Upper branch
  await p.mouse.click(...await cen(p, "ttl")); await p.mouse.click(...await cen(p, "ttl"));
  ok("second level header", (await sel()) === "hd", await sel());
  await p.mouse.click(...await cen(p, "ttl")); ok("third level heading", (await sel()) === "ttl", await sel());
  // Links and buttons do not fire
  const url0 = p.url(); await p.mouse.click(...await cen(p, "lk")); ok("link inert", p.url() === url0, p.url());
  await p.evaluate(() => window.ct.select(document.getElementById("c1")));
  await p.mouse.click(...await cen(p, "btn")); await p.mouse.click(...await cen(p, "btn"));
  ok("button inert", !(await p.evaluate(() => window.fired)));
  ok("button selected", (await sel()) === "btn", await sel());
  // Atom
  await p.evaluate(() => window.ct.select(document.getElementById("band")));
  const [ax, ay] = await cen(p, "t1"); await p.mouse.click(ax, ay); ok("atom selected", (await sel()) === "c3", await sel());
  ok("atom named", (await selTag()) === "Pictures", await selTag());
  await p.mouse.click(ax, ay); ok("atom not entered", (await sel()) === "c3", await sel());
  ok("atom reveals none", (await kids()) === 0);
  // Alt
  await p.evaluate(() => window.ct.select(null));
  await p.keyboard.down("Alt"); await p.mouse.click(tx, ty); await p.keyboard.up("Alt");
  ok("alt deepest", (await sel()) === "p1", await sel());
  // Right click
  await p.evaluate(() => window.ct.select(null));
  await p.mouse.click(tx, ty, { button: "right" });
  ok("layers row closed", (await p.$$('.de-menu [data-open="layers"]')).length === 1 && await p.$eval('.de-menu [data-sub="layers"]', (e) => e.hidden));
  await p.click('.de-menu [data-open="layers"]');
  const items = await tags(p, '.de-menu [data-sub="layers"] [role=menuitem]'); console.log("menu", items);
  ok("menu lists stack", items.length === 4, items);
  await p.screenshot({ path: "/h/shots/v-menu.png" });
  await p.click('.de-menu [data-mi="layer:2"]'); ok("menu picks", (await sel()) === "c1", await sel());
  // Outside
  const [ox, oy] = await cen(p, "outside"); await p.mouse.move(ox, oy); ok("no hover outside", (await hovTag()) === null);
  await p.mouse.click(ox, oy); ok("outside clears", (await sel()) === null);
  // Addresses, tree, scroll
  const round = await p.evaluate(() => { const s = document.getElementById("page"); return ["hd","ttl","nv","c2","p2","c3"].map((id) => { const el = document.getElementById(id); const a = window.api.addressOf(el, s); return [id, a, window.api.atAddress(a) === el]; }); });
  console.log("addresses", JSON.stringify(round)); ok("address round trip", round.every((r) => r[2]), round);
  const tree = await p.evaluate(() => { const go = (n, d) => "  ".repeat(d) + n.name + "\n" + n.kids.map((k) => go(k, d + 1)).join(""); return go(window.api.readLayers(document.getElementById("page")), 0); });
  console.log(tree);
  await p.evaluate(() => window.ct.select(document.getElementById("c1")));
  await p.mouse.wheel(0, 200); await p.waitForTimeout(120);
  const drift = await p.evaluate(() => { const a = document.querySelector(".de-layer-sheet .de-box:not(.kid):not(.hov)").getBoundingClientRect(), b = document.getElementById("c1").getBoundingClientRect(); return Math.abs(a.top - b.top); });
  ok("follows scroll", drift < 1.5, drift);
  await p.evaluate(() => { window.ct.dispose(); }); 
  ok("dispose", (await p.$$(".de-layer-sheet")).length === 0);
  // Pointer-events none, rect hit: fresh page
  await p.goto("http://127.0.0.1:8123/visual.html#rect"); await p.reload();
  await p.addStyleTag({ content: "#page *{pointer-events:none}" });
  const [rx, ry] = await cen(p, "h2a"); await p.mouse.click(rx, ry); await p.mouse.click(rx, ry); await p.mouse.click(rx, ry); await p.mouse.click(rx, ry);
  ok("rect hit through pointer-events none", (await sel()) === "h2a", await sel());
  // ---- The real editor
  await p.goto("http://127.0.0.1:8123/editor.html"); await p.waitForTimeout(400);
  const eSel = () => p.$$eval(".de-box:not(.hov):not(.kid):not(.follow) .de-tag", (e) => e[0]?.textContent ?? null);
  const eHov = () => p.$$eval(".de-box.hov .de-tag", (e) => e[0]?.textContent ?? null);
  const at = async (s) => { const bb = await p.locator(s).first().boundingBox(); return [bb.x + bb.width / 2, bb.y + bb.height / 2]; };
  const ad = '[data-node]'; const first = await p.$eval(ad, (e) => e.dataset.node);
  const inAd = (part) => `[data-node="${first}"] [data-part="${part}"]`;
  const [px, py] = await at(inAd("price"));
  await p.mouse.move(px, py); await p.waitForTimeout(30);
  console.log("editor at load:", await eSel(), "| hover:", await eHov());
  ok("editor hover ad first", /ad/.test(await eHov() ?? ""), await eHov());
  const es = [];
  for (let i = 0; i < 4; i++) { await p.mouse.click(px, py); await p.waitForTimeout(30); es.push(await eSel()); await p.mouse.move(px + 1, py); await p.waitForTimeout(30); if (i === 0) ok("editor hover next box", /Row|Box|Column/.test(await eHov() ?? ""), await eHov()); }
  console.log("editor sequence", es.join(" > "));
  ok("editor reaches price", /Price/.test(es[3] ?? "") && /ad/.test(es[0] ?? ""), es);
  await p.screenshot({ path: "/h/shots/e-price.png" });
  await p.keyboard.press("Escape"); await p.waitForTimeout(30);
  ok("editor esc", !/Price/.test(await eSel() ?? ""), await eSel());
  ok("editor reveal", (await p.$$eval(".de-box.kid", (e) => e.length)) === 1, await p.$$eval(".de-box.kid", (e) => e.length));
  // beside: title's a sibling of n2 inside n1
  const [bx, by] = await at(inAd("title")); await p.mouse.click(bx, by); await p.waitForTimeout(30);
  ok("editor beside goes to neighbour", /Title|Heading/.test(await eSel() ?? ""), await eSel());
  // Alt
  await p.keyboard.press("Escape"); await p.keyboard.press("Escape"); await p.keyboard.press("Escape");
  await p.keyboard.down("Alt"); await p.mouse.click(px, py); await p.keyboard.up("Alt"); await p.waitForTimeout(30);
  ok("editor alt deepest", /Price/.test(await eSel() ?? ""), await eSel());
  await p.mouse.click(px, py, { button: "right" }); await p.waitForTimeout(30);
  await p.click('.de-menu [data-open="layers"]'); await p.waitForTimeout(30);
  const eItems = await tags(p, '.de-menu [data-sub="layers"] [role=menuitem]'); console.log("editor layers", eItems);
  ok("editor layers listed", eItems.length === 4, eItems);
  ok("editor tools still there", (await tags(p, ".de-menu > button")).some((t) => t.startsWith("Duplicate")));
  await p.screenshot({ path: "/h/shots/e-menu.png" });
  await p.click('.de-menu [data-mi="layer:n1"]'); await p.waitForTimeout(30);
  ok("editor layer pick", /Row|Box/.test(await eSel() ?? ""), await eSel());
  await p.goto("http://127.0.0.1:8123/editor.html#cards"); await p.reload(); await p.waitForTimeout(400);
  const secondCard = p.locator("[data-node]").nth(1);
  const sc = await secondCard.locator("[data-part]").first().boundingBox();
  const cs = []; await p.mouse.move(sc.x + sc.width / 2, sc.y + sc.height / 2); await p.waitForTimeout(30);
  ok("cards hover card first", /Card/.test(await eHov() ?? ""), await eHov());
  for (let i = 0; i < 2; i++) { await p.mouse.click(sc.x + sc.width / 2, sc.y + sc.height / 2); await p.waitForTimeout(30); cs.push(await eSel()); }
  console.log("cards sequence", cs.join(" > "));
  ok("cards goes in", /Card/.test(cs[0] ?? "") && !/Card/.test(cs[1] ?? ""), cs);
  ok("cards others follow", (await p.$$eval(".de-box.follow", (e) => e.length)) > 1);
  await p.screenshot({ path: "/h/shots/c-part.png" });
  console.log(`pass ${pass} fail ${fail}`);
  srv.close(); await b.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERR", e.message); process.exit(2); });
