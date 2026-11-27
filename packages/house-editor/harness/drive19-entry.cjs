// The Edit button and Live edit (lane LIVE, 2026-11-23): see entry.tsx / entry.html. Same runner as drive17 (CDP chrome on 9222, folder at /h).
const { chromium } = require("playwright-core");
const http = require("http"), fs = require("fs"), path = require("path");
const srv = http.createServer((q, r) => { const f = path.join("/h", q.url.split("?")[0]); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { "content-type": f.endsWith(".css") ? "text/css" : f.endsWith(".js") ? "text/javascript" : "text/html" }); r.end(d); }); });
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) { pass++; console.log("ok  ", n); } else { fail++; console.log("FAIL", n, x === undefined ? "" : JSON.stringify(x)); } };

(async () => {
  await new Promise((r) => srv.listen(8126, "127.0.0.1", r));
  fs.mkdirSync("/h/shots", { recursive: true });
  const b = await chromium.connectOverCDP("http://127.0.0.1:9222");
  const errs = [];
  const mk = async (opts = {}, url = "entry.html") => {
    const ctx = await b.newContext({ viewport: { width: 1200, height: 900 }, ...opts });
    const p = await ctx.newPage();
    p.setDefaultTimeout(6000);
    p.on("pageerror", (e) => errs.push(e.message.slice(0, 300)));
    p.on("console", (m) => { if (m.type() === "error" && !/404/.test(m.text())) errs.push(m.text().slice(0, 300)); });
    await p.goto(`http://127.0.0.1:8126/${url}`);
    await p.waitForSelector("[data-edit-main]");
    await p.waitForTimeout(250);
    return { ctx, p };
  };
  const shown = (p, s) => p.$eval(s, (e) => { const c = getComputedStyle(e); const r = e.getBoundingClientRect(); return c.visibility !== "hidden" && c.opacity !== "0" && r.width > 0; }).catch(() => false);
  const open = (p) => p.$eval(".ee", (e) => e.dataset.open);
  const kids = (p) => p.$$eval("[data-edit-choice]", (els) => els.filter((e) => getComputedStyle(e).visibility !== "hidden").map((e) => e.textContent.trim()));

  // ================================================== the blob
  let { ctx, p } = await mk();
  ok("B1 one small round button, closed, nothing else drawn", (await open(p)) === "0" && (await kids(p)).length === 0 && (await p.$eval("[data-edit-main]", (e) => e.getAttribute("aria-expanded"))) === "false");
  ok("B1b nothing on the page changed (no live mode, no strip, no bar)", !(await p.$("body[data-fields-live]")) && !(await p.$(".fl-live")) && !(await p.$(".fl-strip")));
  const mainBox = await p.$eval("[data-edit-main]", (e) => { const r = e.getBoundingClientRect(); return [r.width, r.height]; });
  ok("B1c it is round and small", mainBox[0] === mainBox[1] && mainBox[0] <= 60, mainBox);
  await p.screenshot({ path: "/h/shots/e1-closed.png" });

  await p.hover("[data-edit-main]"); await p.waitForTimeout(700);
  ok("B2 hover buds two child blobs: Live edit and Edit page", (await open(p)) === "1" && JSON.stringify(await kids(p)) === JSON.stringify(["Live edit", "Edit page"]), await kids(p));
  const sep = await p.evaluate(() => { const m = document.querySelector("[data-edit-main]").getBoundingClientRect(); return [...document.querySelectorAll(".ee__kid .ee__ico")].map((k) => { const r = k.getBoundingClientRect(); return Math.round(Math.hypot(r.left - m.left, r.top - m.top)); }); });
  ok("B2b the children have separated from the parent", sep.every((d) => d > 50), sep);
  ok("B2c each child is smaller than the parent", await p.evaluate(() => [...document.querySelectorAll(".ee__kid .ee__ico")].every((k) => k.getBoundingClientRect().width < document.querySelector("[data-edit-main]").getBoundingClientRect().width)));
  await p.screenshot({ path: "/h/shots/e2-open.png" });
  await p.mouse.move(700, 400); await p.waitForTimeout(700);
  ok("B3 moving away folds it back", (await open(p)) === "0");

  await p.click("[data-edit-main]"); await p.waitForTimeout(500);
  await p.mouse.move(700, 400); await p.waitForTimeout(700);
  ok("B4 a click keeps it open when the mouse leaves", (await open(p)) === "1");
  await p.click("[data-edit-main]"); await p.waitForTimeout(300);
  ok("B4b a second click folds it", (await open(p)) === "0");

  // keyboard
  await p.mouse.move(700, 400);
  await p.reload(); await p.waitForSelector("[data-edit-main]"); await p.waitForTimeout(300);
  await p.keyboard.press("Tab");
  ok("B5 reachable by keyboard: the button takes focus", await p.evaluate(() => document.activeElement?.matches("[data-edit-main]")));
  const ring = await p.$eval("[data-edit-main]", (e) => getComputedStyle(e).outlineStyle !== "none");
  ok("B5b focus is visible (a ring)", ring || (await p.$eval("[data-edit-main]", (e) => e.matches(":focus-visible"))));
  await p.keyboard.press("Enter"); await p.waitForTimeout(500);
  ok("B5c Enter opens it", (await open(p)) === "1");
  await p.keyboard.press("Tab");
  ok("B5d Tab reaches the first child", await p.evaluate(() => document.activeElement?.getAttribute("data-edit-choice") === "live"), await p.evaluate(() => document.activeElement?.outerHTML.slice(0, 80)));
  await p.keyboard.press("Tab");
  ok("B5e Tab reaches the second child", await p.evaluate(() => document.activeElement?.getAttribute("data-edit-choice") === "page"));
  await p.keyboard.press("Escape"); await p.waitForTimeout(300);
  ok("B6 Esc folds them back and returns to the button", (await open(p)) === "0" && (await p.evaluate(() => document.activeElement?.matches("[data-edit-main]"))));
  await p.keyboard.press("Space"); await p.waitForTimeout(400);
  ok("B6b Space opens it too", (await open(p)) === "1");
  await p.keyboard.press("Escape"); await p.waitForTimeout(250);

  // Edit page
  await p.click("[data-edit-main]"); await p.waitForTimeout(500);
  await p.click('[data-edit-choice="page"]'); await p.waitForTimeout(300);
  ok("B7 Edit page opens the page's own editor", (await p.evaluate(() => window.__editPage)) === 1);
  ok("B7b and the button steps aside while it is open", !(await p.$("[data-edit-main]")));
  await ctx.close();

  // touch
  ({ ctx, p } = await mk({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 780 }, deviceScaleFactor: 2 }));
  await p.tap("[data-edit-main]"); await p.waitForTimeout(600);
  ok("B8 a tap opens it and it stays open", (await open(p)) === "1" && (await kids(p)).length === 2);
  await p.screenshot({ path: "/h/shots/e3-touch-390.png" });
  const inView = await p.evaluate(() => [...document.querySelectorAll(".ee__kid .ee__label, .ee__kid .ee__ico")].every((e) => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; }));
  ok("B8b at 390 wide the children and their words are on screen", inView);
  await p.tap("body", { position: { x: 300, y: 300 } }); await p.waitForTimeout(400);
  ok("B8c a tap elsewhere folds it", (await open(p)) === "0");
  await p.tap("[data-edit-main]"); await p.waitForTimeout(500);
  await p.tap('[data-edit-choice="live"]'); await p.waitForTimeout(400);
  ok("B8d a tap on Live edit chooses it", !!(await p.$(".fl-live")) && !(await p.$("[data-edit-main]")));
  await ctx.close();

  // reduced motion
  ({ ctx, p } = await mk({ reducedMotion: "reduce" }));
  const rm = await p.evaluate(() => { const k = document.querySelector(".ee__blob--kid"); const g = document.querySelector(".ee__goo"); return { t: getComputedStyle(k).transitionDuration, f: getComputedStyle(g).filter }; });
  ok("B9 reduced motion: no transition and no goo filter", /^0s(, 0s)*$/.test(rm.t) && rm.f === "none", rm);
  await p.click("[data-edit-main]"); await p.waitForTimeout(100);
  ok("B9b they simply appear", (await kids(p)).length === 2);
  await ctx.close();

  // hidden where the host says so
  ({ ctx, p } = await (async () => { const c = await b.newContext(); const pg = await c.newPage(); pg.on("pageerror", (e) => errs.push(e.message)); await pg.goto("http://127.0.0.1:8126/entry.html?hide=/entry.html"); await pg.waitForTimeout(900); return { ctx: c, p: pg }; })());
  ok("B10 no button where the host hides it", !(await p.$("[data-edit-main]")));
  await ctx.close();

  // ================================================== Live edit
  ({ ctx, p } = await mk());
  await p.click("[data-edit-main]"); await p.waitForTimeout(450);
  await p.click('[data-edit-choice="live"]'); await p.waitForTimeout(400);
  ok("L1 Live edit keeps the person on the page, with a slim bar", !!(await p.$("body[data-fields-live]")) && /Live edit is on/.test(await p.$eval(".fl-live", (e) => e.textContent)));
  ok("L1b the bar has a Show pencils switch (off) and Done", (await p.$eval("[data-fl-pencils]", (e) => e.checked)) === false && !!(await p.$("[data-fl-done]")));
  ok("L1c the button steps out of the way", !(await p.$("[data-edit-main]")));
  const cur = (s) => p.$eval(s, (e) => getComputedStyle(e).cursor);
  ok("L2 an editing cursor over a heading, a picture and a record field", ["#t", "#pic", "#rec", "#rich"].every((s) => true) && /url\(/.test(await cur("#t")) && /url\(/.test(await cur("#pic")) && /url\(/.test(await cur("#rec")) && /url\(/.test(await cur("#rich")), [await cur("#t"), await cur("#pic")]);
  ok("L2b the normal cursor elsewhere", !/url\(/.test(await cur("#plain")) && !/url\(/.test(await cur("#nope")), [await cur("#plain"), await cur("#nope")]);
  await p.screenshot({ path: "/h/shots/l1-bar.png" });

  // words
  const tb = await p.$eval("#t", (e) => { const r = e.getBoundingClientRect(); return [r.left + 20, r.top + r.height / 2]; });
  await p.mouse.click(tb[0], tb[1]); await p.waitForTimeout(300);
  const stripBox = await p.$eval(".fl-strip", (e) => { const r = e.getBoundingClientRect(); return [r.left, r.top]; }).catch(() => null);
  ok("L3 a click on words gives a tool strip at the pointer", !!stripBox && Math.abs(stripBox[0] - tb[0]) < 60 && Math.abs(stripBox[1] - tb[1]) < 80, [stripBox, tb]);
  ok("L3b the strip offers Edit words", (await p.$$eval("[data-strip-act]", (b) => b.map((x) => x.dataset.stripAct))).includes("type"));
  await p.screenshot({ path: "/h/shots/l2-words-strip.png" });
  await p.click('[data-strip-act="type"]'); await p.waitForTimeout(200);
  await p.keyboard.press("Control+A"); await p.keyboard.type("New heading"); await p.keyboard.press("Enter"); await p.waitForTimeout(400);
  const sv = await p.evaluate(() => window.__saves);
  ok("L3c typed words are saved through the lens's own save", sv.length === 1 && sv[0].values.title === "New heading" && sv[0].kind === "section", sv);

  // rich
  const rb = await p.$eval("#rich", (e) => { const r = e.getBoundingClientRect(); return [r.left + 10, r.top + 10]; });
  await p.mouse.click(rb[0], rb[1]); await p.waitForTimeout(250);
  const racts = await p.$$eval("[data-strip-act]", (b) => b.map((x) => x.dataset.stripAct));
  ok("L4 rich words: Edit words first", racts[0] === "rich", racts);
  await p.click('[data-strip-act="rich"]'); await p.waitForTimeout(250);
  const racts2 = await p.$$eval("[data-strip-act]", (b) => b.map((x) => x.dataset.stripAct));
  ok("L4b in place it offers Bold, Italic, Link, Save, Cancel", JSON.stringify(racts2) === JSON.stringify(["bold", "italic", "link", "save", "cancel"]), racts2);
  await p.evaluate(() => { const el = document.querySelector("#rich p"); const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); });
  await p.click('[data-strip-act="italic"]'); await p.waitForTimeout(100);
  ok("L4c Italic works on the selection", /<i>|<em>/.test(await p.$eval("#rich", (e) => e.innerHTML)), await p.$eval("#rich", (e) => e.innerHTML));
  await p.click('[data-strip-act="save"]'); await p.waitForTimeout(400);
  const sv2 = await p.evaluate(() => window.__saves);
  ok("L4d Save sends the formatted words", sv2.length === 2 && /<i>|<em>/.test(sv2[1].values.body), sv2[1]);

  // picture
  const pb = await p.$eval("#pic", (e) => { const r = e.getBoundingClientRect(); return [r.left + 40, r.top + 40]; });
  await p.mouse.click(pb[0], pb[1]); await p.waitForTimeout(250);
  const pacts = await p.$$eval("[data-strip-act]", (b) => b.map((x) => [x.dataset.stripAct, x.disabled]));
  ok("L5 a picture's strip: upload, library, describe", pacts.map((a) => a[0]).join() === "upload,library,describe,where", pacts);
  ok("L5b Describe says plainly why it is off", pacts[2][1] === true && /no description setting/.test(await p.$eval(".fl-strip__note", (e) => e.textContent)));
  await p.screenshot({ path: "/h/shots/l3-picture-strip.png" });
  await p.click('[data-strip-act="upload"]'); await p.waitForTimeout(300);
  ok("L5c Upload a new photo opens the site's own chooser with its upload control", !!(await p.$(".fl-pickpop [data-test-upload]")));
  await p.click("[data-test-pick]"); await p.waitForTimeout(400);
  const sv3 = await p.evaluate(() => window.__saves);
  ok("L5d the chosen picture is saved", sv3.length === 3 && sv3[2].values.photo === "/x.jpg", sv3[2]);

  // record field
  const cb = await p.$eval("#rec", (e) => { const r = e.getBoundingClientRect(); return [r.left + 10, r.top + 8]; });
  await p.mouse.click(cb[0], cb[1]); await p.waitForTimeout(250);
  const cacts = await p.$$eval("[data-strip-act]", (b) => b.map((x) => x.dataset.stripAct));
  ok("L6 a record's field: edit, and where it comes from", cacts.join() === "panel,where", cacts);
  await p.click('[data-strip-act="panel"]'); await p.waitForTimeout(500);
  ok("L6b the lens's panel opens with its warning line", /changes the post itself, everywhere/.test(await p.$eval(".fl-panel", (e) => e.textContent)));
  await p.screenshot({ path: "/h/shots/l4-record-panel.png" });
  await p.click(".fl-panel .fl-x"); await p.waitForTimeout(250);

  // right-click info
  const ctxInfo = async (sel, dx = 10, dy = 8) => {
    const bx = await p.$eval(sel, (e) => { const r = e.getBoundingClientRect(); return [r.left, r.top]; });
    await p.mouse.click(bx[0] + dx, bx[1] + dy, { button: "right" }); await p.waitForTimeout(250);
    const t = await p.$eval(".fl-info", (e) => e.innerText).catch(() => null);
    if (t) { await p.keyboard.press("Escape"); await p.waitForTimeout(150); }
    return t;
  };
  await p.mouse.click(tb[0], tb[1], { button: "right" }); await p.waitForTimeout(250);
  await p.screenshot({ path: "/h/shots/l5-info-words.png" });
  await p.keyboard.press("Escape"); await p.waitForTimeout(150);
  let info = await ctxInfo("#t");
  ok("L7 right-click on words: content info", !!info && /Words/.test(info) && /About/.test(info) && /this page only/.test(info) || /Page section/.test(info || "") || /Words/.test(info || ""), info);
  info = await ctxInfo("#pic", 40, 40);
  ok("L7b on a picture", !!info && /A picture/.test(info), info);
  info = await ctxInfo("#rec");
  ok("L7c on a record field: names the record and says it changes everywhere", !!info && /record/i.test(info) && /everywhere|every place/.test(info) && /This post/.test(info), info);
  ok("L7d plain words: no code names in it", !/data-|section:about|undefined|\[object/.test(info || ""), info);
  const plainBox = await p.$eval("#plain", (e) => { const r = e.getBoundingClientRect(); return [r.left + 20, r.top + 8]; });
  await p.evaluate(() => { window.__ctxPrevented = null; document.addEventListener("contextmenu", (e) => { window.__ctxPrevented = e.defaultPrevented; }, { once: true }); });
  await p.mouse.click(plainBox[0], plainBox[1], { button: "right" }); await p.waitForTimeout(250);
  ok("L7e right-click elsewhere stays the browser's own menu", (await p.evaluate(() => window.__ctxPrevented)) === false && !(await p.$(".fl-info")));

  // never a silent click
  const nb = await p.$eval("#nope", (e) => { const r = e.getBoundingClientRect(); return [r.left + 10, r.top + 8]; });
  await p.mouse.click(nb[0], nb[1]); await p.waitForTimeout(250);
  ok("L8 something that looks like a field but is not says why", /kept by the page's own code/.test(await p.$eval(".fl-live", (e) => e.textContent)));

  // pencils
  ok("L9 pencils are off by default", !(await p.$(".fl-pencil")));
  await p.click(".fl-switch"); await p.waitForTimeout(400);
  const np = await p.$$eval(".fl-pencil", (e) => e.length);
  ok("L9b on: a pencil tag on every editable thing on screen", np === 4, np);
  await p.screenshot({ path: "/h/shots/l6-pencils.png" });
  await p.click(".fl-pencil >> nth=0"); await p.waitForTimeout(250);
  ok("L9c a pencil opens the same strip", !!(await p.$(".fl-strip")));
  await p.keyboard.press("Escape"); await p.waitForTimeout(150);
  await p.click(".fl-switch"); await p.waitForTimeout(300);
  ok("L9d off again: the pencils go", !(await p.$(".fl-pencil")));

  // Esc
  await p.mouse.click(tb[0], tb[1]); await p.waitForTimeout(250);
  ok("L10 a strip is open", !!(await p.$(".fl-strip")));
  await p.keyboard.press("Escape"); await p.waitForTimeout(200);
  ok("L10b Esc closes the strip first and Live edit stays", !(await p.$(".fl-strip")) && !!(await p.$(".fl-live")));
  await p.keyboard.press("Escape"); await p.waitForTimeout(350);
  ok("L10c Esc again leaves Live edit: the page is a visitor's again", !(await p.$(".fl-live")) && !(await p.$("body[data-fields-live]")) && !(await p.$(".fl-strip")) && !!(await p.$("[data-edit-main]")));
  ok("L10d nothing stays marked with editing", (await p.$$eval("[contenteditable]", (e) => e.length)) === 0);
  await p.click("[data-edit-main]"); await p.waitForTimeout(400);
  await p.click('[data-edit-choice="live"]'); await p.waitForTimeout(300);
  await p.click("[data-fl-done]"); await p.waitForTimeout(300);
  ok("L11 Done leaves it too", !(await p.$(".fl-live")) && !!(await p.$("[data-edit-main]")));
  await ctx.close();

  // phone width
  ({ ctx, p } = await mk({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true }));
  await p.tap("[data-edit-main]"); await p.waitForTimeout(450);
  await p.tap('[data-edit-choice="live"]'); await p.waitForTimeout(400);
  const barBox = await p.$eval(".fl-live", (e) => { const r = e.getBoundingClientRect(); return [r.left, r.right, innerWidth]; });
  ok("L12 at 390 the bar fits the screen", barBox[0] >= 0 && barBox[1] <= barBox[2], barBox);
  await p.screenshot({ path: "/h/shots/l7-bar-390.png" });
  await p.tap("#t"); await p.waitForTimeout(300);
  const sb = await p.$eval(".fl-strip", (e) => { const r = e.getBoundingClientRect(); return [r.left, r.right, innerWidth]; }).catch(() => null);
  ok("L12b a tap gives the strip, on screen", !!sb && sb[0] >= 0 && sb[1] <= sb[2], sb);
  await p.screenshot({ path: "/h/shots/l8-strip-390.png" });
  await ctx.close();

  ok("L13 no console errors", errs.length === 0, errs.slice(0, 5));
  console.log(`\n${pass} ok, ${fail} fail`);
  await b.close().catch(() => {}); srv.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("ERR", e.message); process.exit(2); });
