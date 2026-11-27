// In place (2026-11-23): see inplace.ts. Run with the same runner as drive17-resize (CDP chrome on 9222, harness folder at /h).
const { chromium } = require("playwright-core");
const http = require("http"), fs = require("fs"), path = require("path");
const srv = http.createServer((q, r) => { const f = path.join("/h", q.url.split("?")[0]); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { "content-type": f.endsWith(".css") ? "text/css" : f.endsWith(".js") ? "text/javascript" : "text/html" }); r.end(d); }); });
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else { fail++; console.log("FAIL", n, x === undefined ? "" : JSON.stringify(x)); } };

(async () => {
  await new Promise((r) => srv.listen(8125, "127.0.0.1", r));
  fs.mkdirSync("/h/shots", { recursive: true });
  const b = await chromium.connectOverCDP("http://127.0.0.1:9222"); const p = b.contexts()[0].pages()[0];
  p.setDefaultTimeout(8000); await p.setViewportSize({ width: 1500, height: 1500 });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message.slice(0, 300))); p.on("console", (m) => { if (m.type() === "error" && !/404/.test(m.text())) errs.push(m.text().slice(0, 300)); });
  const open = async (hash) => { await p.goto("about:blank"); await p.goto(`http://127.0.0.1:8125/inplace.html${hash}`); await p.waitForSelector(".de-vpanel", { state: "attached" }); await p.waitForTimeout(300); };
  const node = (id) => p.evaluate((i) => { let hit = null; const go = (l) => { for (const n of l ?? []) { if (n.props.id === i) hit = n; for (const v of Object.values(n.props)) if (Array.isArray(v) && v[0]?.type) go(v); } }; go(window.ed.doc().content); return hit; }, id);
  const head = () => p.$eval(".de-vpanel .de-head b", (e) => e.textContent).catch(() => null);
  const sub = () => p.$eval(".de-vpanel .de-head span", (e) => e.textContent).catch(() => null);
  const notice = () => p.$eval('.de-vpanel [data-f="notice"]', (e) => e.textContent).catch(() => null);
  const hint = () => p.$eval(".de-editbar-hint", (e) => e.textContent).catch(() => "");
  const has = (s) => p.$(s).then((e) => !!e);
  const rect = (s) => p.$eval(s, (e) => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top + scrollY), Math.round(r.width), Math.round(r.height)]; });
  const still = async () => { await p.mouse.move(2, 400); await p.waitForTimeout(80); };
  const scrollTo = async (s) => { await p.evaluate((q) => document.querySelector(q).scrollIntoView({ block: "center" }), s); await p.waitForTimeout(120); };
  const dbl = async (s, n = 0) => { const l = p.locator(s).nth(n); await l.scrollIntoViewIfNeeded(); await p.waitForTimeout(80); await l.dblclick(); await p.waitForTimeout(220); };
  const click = async (s, n = 0) => { const l = p.locator(s).nth(n); await l.scrollIntoViewIfNeeded(); await p.waitForTimeout(80); await l.click(); await p.waitForTimeout(200); };
  const esc = async () => { await p.keyboard.press("Escape"); await p.waitForTimeout(160); };
  const T = '[data-tree-node="tl"] .tl-title';
  const PTITLE = '[data-tree-node="ptb"] h1, [data-tree-node="ptb"] h2';

  // ============================================================ popup off (the house editor's setting)
  await open("");
  const before = { block: await rect('[data-tree-node="tl"]'), h: await p.evaluate(() => document.documentElement.scrollHeight) };
  await scrollTo('[data-tree-node="tl"]');
  await dbl(T);
  ok("IP1 a double-click on a card title opens no popup", !(await has(".de-popup")));
  ok("IP2 it selects the part under the pointer, in the same window", (await head()) === "Card title" && (await sub()) === "Tour list", [await head(), await sub()]);
  ok("IP3 the panel says it applies to every one, in the part's own words", /Card title: applies to every card title in this block/.test((await notice()) ?? ""), await notice());
  ok("IP4 the rest of the page goes quieter (a veil on the sheet)", await has(".de-veil"));
  await p.screenshot({ path: "/h/shots/ip-1-entered.png" });
  ok("IP5 nothing moved: the block's box and the page height are as before", JSON.stringify(await rect('[data-tree-node="tl"]')) === JSON.stringify(before.block) && (await p.evaluate(() => document.documentElement.scrollHeight)) === before.h, [await rect('[data-tree-node="tl"]'), before.block]);
  ok("IP6 the hint names this part in plain words", /Card title/.test(await hint()) && /Double-click to change its words where they are kept/.test(await hint()) && /Esc goes out to the block/.test(await hint()), await hint());
  ok("IP6b no em dash in the hint or the notice", !/—/.test((await hint()) + ((await notice()) ?? "")));

  // another part of the same block: one click selects it directly
  await click('[data-tree-node="tl"] .tl-kicker', 1);
  ok("IP7 one click on another part of the entered block selects it directly", (await head()) === "Card kicker", await head());
  ok("IP7b and the block stays entered", await has(".de-veil"));
  await click('[data-tree-node="tl"] .tl-title', 2);
  ok("IP8 and back to a title (any card)", (await head()) === "Card title", await head());

  // a look on the title applies to every card's title, stored once
  const colorField = (await has('.de-vpanel [data-f="color"]')) ? "color" : null;
  ok("IP9 the part panel offers the text colour", !!colorField);
  if (colorField) {
    await p.fill(`.de-vpanel [data-f="${colorField}"]`, "#cc2200"); await p.waitForTimeout(80); await p.$eval(`.de-vpanel [data-f="${colorField}"]`, (e) => e.blur()); await p.waitForTimeout(120);
    const cols = await p.$$eval(T, (els) => els.map((e) => getComputedStyle(e).color));
    ok("IP9 every card's title took the colour", cols.length === 3 && cols.every((c) => c === "rgb(204, 34, 0)"), cols);
    const n = await node("tl");
    ok("IP9 stored once, under the part's name", !!n?.props.morph?.parts?.title?.color && Object.keys(n.props.morph.parts).join() === "title", n?.props.morph);
    ok("IP9 other parts untouched", (await p.$eval('[data-tree-node="tl"] .tl-kicker', (e) => getComputedStyle(e).color)) !== "rgb(204, 34, 0)");
  }

  // Esc: one level out at a time
  await esc();
  ok("IP10 Esc from a part selects its block", (await head()) === "Tour list", await head());
  ok("IP10b the veil is gone with the part", !(await has(".de-veil")));
  await esc();
  ok("IP11 Esc from the block selects nothing", (await head()) !== "Tour list" && (await head()) !== "Card title", await head());
  await still();
  ok("IP11b no selection box on the page", (await p.$$eval(".de-layer-sheet .de-box:not(.hov):not(.kid)", (e) => e.length)) === 0);

  // double-click on a part: in, then on its words
  await dbl(T, 0);
  ok("IP12 a double-click goes in (the part under the pointer is selected)", (await head()) === "Card title", await head());
  ok("IP12b it has not opened the record yet", (await p.evaluate(() => window.opened.length)) === 0);
  await dbl(T, 0);
  const opened = await p.evaluate(() => window.opened);
  ok("IP13 a double-click on the selected title opens the record's field", opened.length === 1 && opened[0] === "record:tour:t1:title", opened);
  // the Fields lens's own panel, where the title stands: its warning line, its load, its save
  await p.waitForSelector('.fl-record-host [data-fl-input="title"]', { timeout: 5000 }).catch(() => {});
  ok("IP13b the lens's record panel is open", await has(".fl-record-host .fl-panel"));
  const warn = await p.$eval(".fl-record-host .fl-msg--shared", (e) => e.textContent).catch(() => null);
  ok("IP13c it carries the warning line: this changes the tour itself, everywhere", /changes the tour itself, everywhere it appears/.test(warn ?? ""), warn);
  ok("IP13d it holds the tour's own title, loaded through the lens's load", (await p.$eval('.fl-record-host [data-fl-input="title"]', (e) => e.value).catch(() => null)) === "Paris by night" && (await p.evaluate(() => window.loads)).some((a) => a.kind === "tour" && a.id === "t1"), await p.evaluate(() => window.loads));
  ok("IP13e the panel sits above the canvas's own panel", await p.evaluate(() => { const a = document.querySelector(".fl-record-host .fl-panel"), c = document.querySelector(".de-vpanel"); return !!a && !!c && +getComputedStyle(a).zIndex > +getComputedStyle(c).zIndex; }));
  await p.fill('.fl-record-host [data-fl-input="title"]', "Paris by night (test)");
  await p.click(".fl-record-host .fl-btn--primary"); await p.waitForTimeout(400);
  const saves = await p.evaluate(() => window.saves);
  ok("IP13f Save goes through the lens's save with the tour and the typed words", saves.length === 1 && saves[0].kind === "tour" && saves[0].id === "t1" && saves[0].values.title === "Paris by night (test)", saves);
  ok("IP13g a refused save says so and the page's own document is untouched", /Not saved/.test(await p.$eval(".fl-record-host .fl-bar", (e) => e.textContent).catch(() => "")) && JSON.stringify((await node("tl")).props).indexOf("test") < 0);
  await p.screenshot({ path: "/h/shots/ip-3-record-panel.png" });
  p.once("dialog", (d) => d.accept().catch(() => {}));
  await p.click(".fl-record-host .fl-panel__actions .fl-btn:not(.fl-btn--primary)"); await p.waitForTimeout(500);
  ok("IP13h Cancel closes it", !(await has(".fl-record-host .fl-panel")));
  await esc(); await esc(); await esc();
  // a part with no record: a plain reason, never nothing
  await dbl('[data-tree-node="tl"] .tl-price', 0);
  await dbl('[data-tree-node="tl"] .tl-price', 0);
  ok("IP14 words with no record behind them say why (one line)", /no words|does not say which record|drawn by the block/.test(await hint()) && !/—/.test(await hint()), await hint());
  ok("IP14b and open nothing", (await p.evaluate(() => window.opened.length)) === 1);
  await esc(); await esc(); await esc();
  // on the block's own padding: a line, not silence
  const bb = await (await p.$('[data-tree-node="tl"]')).boundingBox();
  await p.mouse.dblclick(bb.x + 6, bb.y + 6); await p.waitForTimeout(250);
  ok("IP15 a double-click where no part sits says so", /no part under the pointer/.test(await hint()), await hint());

  // the menu offers no popup
  await esc(); await esc(); await esc();
  await p.locator('[data-tree-node="tl"]').first().click({ button: "right", position: { x: 6, y: 6 } }); await p.waitForTimeout(200);
  const menu = await p.$$eval(".de-menu [role=menuitem]", (e) => e.map((x) => x.textContent)).catch(() => []);
  ok("IP16 the right-click menu has no way to open a large view", menu.length > 0 && !menu.some((t) => /large/i.test(t)), menu);
  await esc();
  ok("IP17 no popup element exists anywhere in the page", !(await has(".de-popup")));

  // words typed in the block's own settings: type in place (the first double-click goes in, the next types)
  await esc(); await esc();
  await scrollTo('[data-tree-node="ptb"]');
  await dbl(PTITLE, 0);
  const inHead = await head();
  ok("IP18 a typed heading: the first double-click goes in", /title/i.test(inHead ?? ""), inHead);
  await dbl(PTITLE, 0);
  ok("IP19 the next one types in place", await p.evaluate(() => !!document.querySelector('[data-tree-node="ptb"] [contenteditable]')));
  await p.keyboard.press("Control+A"); await p.keyboard.type("Rock and breath"); await p.keyboard.press("Enter"); await p.waitForTimeout(250);
  ok("IP19b Enter writes the setting", (await node("ptb")).props.title === "Rock and breath", (await node("ptb")).props.title);
  await dbl(PTITLE, 0);
  await p.keyboard.type("zzz"); await esc();
  ok("IP20 Esc while typing puts the words back and stays on the part", (await node("ptb")).props.title === "Rock and breath" && /title/i.test((await head()) ?? "") && !(await p.evaluate(() => !!document.querySelector('[data-tree-node="ptb"] [contenteditable]'))), [(await node("ptb")).props.title, await head()]);
  await esc();
  ok("IP20b the next Esc goes to the block", /Banner/i.test((await head()) ?? ""), await head());
  ok("IP21 no console errors", errs.length === 0, errs);

  // ============================================================ the off switch turned on again
  await open("#large");
  await scrollTo('[data-tree-node="tl"]');
  await dbl(T);
  ok("IP22 with largeView on, the popup is back (the switch is real)", await has(".de-popup"));
  await p.screenshot({ path: "/h/shots/ip-2-large.png" });

  // phone width: the editor still opens and a double-click still goes in, with no popup
  await p.setViewportSize({ width: 390, height: 844 });
  await open("");
  ok("IP23 the phone-width editor opens (canvas bar and panel attached)", (await has(".de-editbar")) && (await has(".de-vpanel")));
  await scrollTo('[data-tree-node="tl"]');
  await dbl(T);
  ok("IP24 on a phone a double-click goes in too, and opens no popup", /Card title/.test((await head()) ?? "") && !(await has(".de-popup")), await head());
  await p.screenshot({ path: "/h/shots/ip-4-phone.png" });
  ok("IP25 no console errors on the phone run", errs.length === 0, errs);

  console.log(`pass ${pass} fail ${fail}`);
  srv.close(); await b.close().catch(() => {}); process.exit(0);
})().catch((e) => { console.log("ERR", e.message); process.exit(1); });
