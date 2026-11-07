// The ten hand-test steps of plan section 12, on the assembled page, by mouse and keyboard only. The page has no window.ed.
const { chromium } = require("playwright-core"); const http = require("http"), fs = require("fs");
const srv = http.createServer((q, r) => { r.writeHead(200, { "content-type": "text/html" }); r.end("<!doctype html><meta charset=utf-8>" + fs.readFileSync("/h/click-through-test.html")); });
const lines = []; const say = (s) => { lines.push(s); console.log(s); };
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) { pass++; say(`  ok   ${n}`); } else { fail++; say(`  FAIL ${n} ${x === undefined ? "" : JSON.stringify(x)}`); } };
(async () => {
  await new Promise((r) => srv.listen(8123, "127.0.0.1", r)); fs.mkdirSync("/h/shots", { recursive: true });
  const b = await chromium.connectOverCDP("http://127.0.0.1:9222"); const p = b.contexts()[0].pages()[0];
  p.setDefaultTimeout(12000); await p.setViewportSize({ width: 1500, height: 950 });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("dialog", (d) => { say(`  dialog: ${d.message()}`); d.accept().catch(() => {}); });
  await p.goto("http://127.0.0.1:8123/"); await p.waitForSelector(".de-vpanel .de-tabs"); await p.waitForTimeout(200);
  const shot = (n) => p.screenshot({ path: `/h/shots/walk-${n}.png` });
  const head = () => p.$eval(".de-vpanel .de-head b", (e) => e.textContent).catch(() => null);
  const node = (id) => p.locator(`#stage [data-tree-node="${id}"]`).first();
  const clickNode = async (id, dx = 0.5, dy = 0.3) => { const l = node(id); await l.scrollIntoViewIfNeeded(); await p.waitForTimeout(80); const bb = await l.boundingBox(); await p.mouse.move(bb.x + bb.width * dx, bb.y + bb.height * dy); await p.mouse.click(bb.x + bb.width * dx, bb.y + bb.height * dy); await p.waitForTimeout(60); };
  // Not a retry: a menu that fails to open still fails the walk, with what happened around it written to the log.
  const rightNode = async (id) => {
    const l = node(id); await l.scrollIntoViewIfNeeded(); await p.waitForTimeout(80); const bb = await l.boundingBox();
    const x = bb.x + Math.min(bb.width / 2, 400), y = bb.y + Math.min(bb.height / 2, 30);
    await p.evaluate(() => { const log = (window.__ev = []); const t0 = performance.now(); const at = () => Math.round(performance.now() - t0);
      if (window.__evOff) window.__evOff();
      const onScroll = (e) => log.push([at(), "scroll", e.target === document ? "document" : e.target.className]);
      const onMenu = (e) => log.push([at(), "contextmenu", e.target.tagName, e.target.closest?.("[data-tree-node]")?.dataset.treeNode ?? null, e.defaultPrevented]);
      const mo = new MutationObserver((rs) => { for (const r of rs) { for (const n of r.addedNodes) if (n.classList?.contains("de-menu")) log.push([at(), "menu added"]); for (const n of r.removedNodes) if (n.classList?.contains("de-menu")) log.push([at(), "menu removed"]); } });
      mo.observe(document.body, { childList: true, subtree: true });
      window.addEventListener("scroll", onScroll, true); window.addEventListener("contextmenu", onMenu, true);
      window.__evOff = () => { mo.disconnect(); window.removeEventListener("scroll", onScroll, true); window.removeEventListener("contextmenu", onMenu, true); }; });
    await p.mouse.click(x, y, { button: "right" });
    try { await p.waitForSelector(".de-menu", { timeout: 4000 }); }
    catch (e) {
      const state = await p.evaluate(() => ({ ev: window.__ev, scrollY: window.scrollY, html: document.documentElement.scrollTop, anim: document.getAnimations().length, smooth: getComputedStyle(document.documentElement).scrollBehavior, top: document.elementFromPoint(innerWidth / 2, 300)?.className }));
      say(`  MENU DID NOT OPEN on ${id} at ${Math.round(x)},${Math.round(y)} box ${JSON.stringify(bb)} ${JSON.stringify(state)}`);
      await shot(`menu-fail-${id}`); throw e;
    }
    await p.waitForTimeout(30);
    const ev = await p.evaluate(() => window.__ev); if (ev.some((x) => x[1] === "menu removed")) say(`  menu on ${id} opened and closed: ${JSON.stringify(ev)}`);
  };
  const addByLabel = async (anchor, label, picture) => {
    await rightNode(anchor); await p.click('.de-menu [data-open="add"]'); await p.waitForTimeout(40);
    const rows = p.locator('.de-menu [data-sub="add"] button[data-mi]'); const texts = (await rows.allInnerTexts()).map((t) => t.trim());
    const at = texts.indexOf(label);
    if (picture) await shot(picture);
    if (at < 0) { say(`  no Add row called "${label}"; rows: ${texts.join(" | ")}`); await p.keyboard.press("Escape"); return false; }
    await rows.nth(at).scrollIntoViewIfNeeded(); await rows.nth(at).click(); await p.waitForTimeout(90); return true;
  };
  const rowOff = (label) => p.locator(".de-menu button[data-mi]").filter({ hasText: label }).first().isDisabled();
  const rowLabels = (s) => p.$$eval(`.de-vpanel .de-sec[data-section="${s}"] .de-label`, (e) => e.map((x) => x.textContent));
  const field = (f) => `.de-vpanel [data-f="${f}"]`;
  const stageText = () => p.locator("#stage").innerText();
  const sectionsNow = () => p.$$eval(".de-vpanel .de-sec[data-section]", (e) => e.map((x) => x.dataset.section));

  say("Step 1: Right-click, Add, Feed");
  ok("Blocks is the tab shown", await p.$eval('.tt-tabs [data-v="blocks"]', (e) => e.getAttribute("aria-pressed") === "true"));
  await shot("0-open");
  ok("an Add row named Feed", await addByLabel("head", "Feed", "1-addmenu"));
  ok("draws sample rows", (await stageText()).includes("Morning Sadhana"));
  ok("right column says Sample rows. Not saved.", (await p.locator('.de-vpanel [data-f="notice"]').innerText().catch(() => "")) === "Sample rows. Not saved.");
  ok("the Feed is what is selected", (await head()) === "Feed", await head());
  const feedId = await p.$eval(".de-layers li.on", (e) => e.dataset.row);
  await shot("1-feed");

  say("Step 2: Hero, then the blue box");
  await clickNode("hero");
  ok("a click on the hero selects Hero banner", (await head()) === "Hero banner", await head());
  // Since stone 2 the panel is the root part: options first, in their order, then a box's sections.
  ok("sections: options first", (await sectionsNow())[0] === "content" && (await sectionsNow()).includes("layout"), await sectionsNow());
  ok("Content labels", (await rowLabels("content")).join() === "Title,Subtitle,Background image,Image description", await rowLabels("content"));
  ok("Layout labels: options first", (await rowLabels("layout")).slice(0, 2).join() === "Text position,Height", await rowLabels("layout"));
  await shot("2-hero");
  const metrics = (sel) => p.$eval(sel, (e) => { const r = e.closest(".de-row"), c = getComputedStyle(r).gridTemplateColumns.split(" "); return { label: c[0], aux: c[2], h: Math.round(e.getBoundingClientRect().height), row: Math.round(r.getBoundingClientRect().height) }; });
  const heroRow = await metrics(field("p-title"));
  await clickNode("box1", 0.9, 0.5);
  say(`  clicked lower box, panel heading: ${await head()}`);
  ok("the blue box is selected", /box|section|group|stack/i.test((await head()) ?? ""), await head());
  const boxRow = await metrics(field("attr-href"));
  ok("rows match a box's (label column, aux column, field height, row height)", JSON.stringify(heroRow) === JSON.stringify(boxRow), [heroRow, boxRow]);
  await shot("2-box");

  say("Step 3: Type in Title");
  await clickNode("hero");
  const title0 = await p.textContent("#stage .blk-hero-title");
  await p.click(field("p-title")); await p.keyboard.press("End");
  const seen = [];
  for (const ch of "xyz") { await p.keyboard.type(ch); await p.waitForTimeout(900); seen.push(await p.textContent("#stage .blk-hero-title")); }
  ok("hero changes per letter", seen.join("|") === [`${title0}x`, `${title0}xy`, `${title0}xyz`].join("|"), seen);
  ok("cursor stays", await p.$eval(field("p-title"), (e) => document.activeElement === e && e.selectionStart === e.value.length));
  await shot("3-typed");
  await p.click("[data-a=undo]"); await p.waitForTimeout(60);
  ok("Undo once: all of the typing goes back", (await p.textContent("#stage .blk-hero-title")) === title0, await p.textContent("#stage .blk-hero-title"));
  ok("the field shows it", (await p.inputValue(field("p-title"))) === title0);
  ok("the Feed is still there: one undo took one step", (await stageText()).includes("Morning Sadhana"));
  // Keys inside a field stay in the field.
  await p.click(field("p-title")); await p.keyboard.press("End"); await p.keyboard.press("Backspace"); await p.keyboard.press("Delete"); await p.waitForTimeout(40);
  ok("Backspace and Delete in a field do not delete the block", (await p.$$('#stage [data-tree-node="hero"]')).length === 1 && (await head()) === "Hero banner", await head());
  await p.keyboard.type("]["); await p.keyboard.press("Control+d"); await p.waitForTimeout(40);
  ok("[ ] and Ctrl+D in a field do not move or duplicate", (await p.$$('#stage .blk-hero')).length === 1 && (await p.inputValue(field("p-title"))).endsWith("]["), await p.inputValue(field("p-title")));
  await p.click("[data-a=undo]"); await p.waitForTimeout(60);
  ok("that typing undoes as one step too", (await p.textContent("#stage .blk-hero-title")) === title0, await p.textContent("#stage .blk-hero-title"));

  say("Step 4: Picture wall settings");
  await clickNode("wall", 0.5, 0.5);
  ok("a click on the wall selects Picture wall", (await head()) === "Picture wall", await head());
  await shot("4-wall");
  const secs = await sectionsNow(); say(`  sections: ${secs.join(" ")}; layout: ${(await rowLabels("layout")).join(", ")}; appearance: ${(await rowLabels("appearance")).join(", ")}`);
  const labelled = async (label) => (await p.$$eval(".de-vpanel .de-row", (rows, l) => rows.filter((r) => r.querySelector(".de-label")?.textContent === l).map((r) => r.dataset.sync.replace("row-", "")), label))[0];
  const gap = await labelled("Space between"), shape = await labelled("Shape"), colour = await labelled("Caption colour");
  ok("rows named Space between, Shape, Caption colour", gap && shape && colour, [gap, shape, colour]);
  if (gap) {
    const gapOpts = await p.$$eval(`${field(gap)} option`, (e) => e.map((x) => x.value)); await p.focus(field(gap)); await p.selectOption(field(gap), gapOpts[gapOpts.length - 1]); await p.waitForTimeout(60);
    const shapeOpts = await p.$$eval(`${field(shape)} option`, (e) => e.map((x) => x.value)); await p.focus(field(shape)); await p.selectOption(field(shape), shapeOpts[shapeOpts.length - 1]); await p.waitForTimeout(60);
    ok("Space between changes the wall", (await p.$eval("#stage .blk-wall", (e) => e.dataset.gap)) === JSON.parse(gapOpts[gapOpts.length - 1]), await p.$eval("#stage .blk-wall", (e) => e.dataset.gap));
    ok("Shape changes the wall", (await p.$eval("#stage .blk-wall", (e) => e.dataset.shape)) === JSON.parse(shapeOpts[shapeOpts.length - 1]), await p.$eval("#stage .blk-wall", (e) => e.dataset.shape));
  }
  await p.locator(`.de-vpanel [data-sync="row-${colour}"]`).scrollIntoViewIfNeeded();
  await p.click(field(`pop-${colour}`)); await p.waitForTimeout(60);
  const wallTabs = await p.$$eval(".de-colorpop .de-poptabs [data-ctab]", (e) => e.map((x) => x.textContent));
  await shot("4-colour");
  await p.click('[data-f="ctab-custom"]'); await p.waitForTimeout(40); await p.fill('[data-f="chex"]', "#aa2233"); await p.waitForTimeout(80);
  ok("custom colour reaches the captions", (await p.$eval("#stage .blk-wall-caption", (e) => getComputedStyle(e).color)) === "rgb(170, 34, 51)");
  ok("reset arrow appears", (await p.$$(`[data-f="reset-${colour}"]`)).length === 1);
  await p.click('[data-f="popclose"]'); await p.waitForTimeout(40);
  await shot("4-colour-set");
  await p.click(`[data-f="reset-${colour}"]`); await p.waitForTimeout(60);
  ok("reset arrow returns the default", (await p.$eval("#stage .blk-wall-caption", (e) => e.style.color)) === "" && (await p.$$(`[data-f="reset-${colour}"]`)).length === 0);
  await clickNode("box1", 0.9, 0.5);
  await p.click(field("pop-fill")); await p.waitForTimeout(60);
  const boxTabs = await p.$$eval(".de-colorpop .de-poptabs [data-ctab]", (e) => e.map((x) => x.textContent));
  await shot("4-box-fill");
  ok("same popover tabs as a box's Fill", wallTabs.join() === boxTabs.join() && wallTabs.length > 0, [wallTabs, boxTabs]);
  await p.keyboard.press("Escape"); await p.waitForTimeout(40);
  await clickNode("wall", 0.5, 0.5);
  const panelScroll = await p.$eval(".de-vpanel", (e) => { let m = 0; for (const x of [e, ...e.querySelectorAll("*")]) m = Math.max(m, x.scrollLeft); return m; });
  say(`  panel scrollLeft after the popovers: ${panelScroll}`);

  say("Step 5: Add, Picture wall");
  ok("an Add row named Picture wall", await addByLabel("head", "Picture wall"));
  const empty = p.locator("#stage [data-tree-empty]").filter({ hasText: "Picture wall" }).first();
  ok("a labelled empty box", (await empty.innerText().catch(() => "")) === "Picture wall: nothing to show yet", await empty.innerText().catch(() => null));
  const wall2 = await p.$eval(".de-layers li.on", (e) => e.dataset.row);
  const countRow = await p.$$eval(".de-vpanel .de-row", (rows) => rows.filter((r) => r.querySelector(".de-readout")).map((r) => [r.querySelector(".de-label")?.textContent, r.querySelector(".de-readout").textContent]));
  say(`  readout rows: ${JSON.stringify(countRow)}`);
  ok("its row says None yet", countRow.some(([, v]) => v === "None yet"), countRow);
  ok("the row is called Picture or Pictures", countRow.some(([l]) => /^Pictures?$/.test(l ?? "")), countRow);
  await empty.scrollIntoViewIfNeeded(); await p.waitForTimeout(80); await shot("5-empty");

  say("Step 6: Save, switch tab, come back");
  await clickNode("wall", 0.5, 0.5);
  const gapBefore = await p.$eval("#stage .blk-wall", (e) => e.dataset.gap), shapeBefore = await p.$eval("#stage .blk-wall", (e) => e.dataset.shape);
  await p.click("[data-a=save]"); await p.waitForFunction(() => document.querySelector(".de-editbar-hint")?.textContent.includes("Saved")); await p.waitForTimeout(60);
  ok("Save reports Saved", true);
  await p.click('.tt-tabs [data-v="tree"]'); await p.waitForTimeout(300);
  ok("the bar is hidden on another tab", await p.$eval("#tt-acts", (e) => getComputedStyle(e).display === "none"));
  await p.click('.tt-tabs [data-v="blocks"]'); await p.waitForTimeout(300);
  const walls = await p.$$eval("#stage .blk-wall", (e) => e.map((x) => [x.dataset.gap, x.dataset.shape]));
  ok("the settings are there", walls.some(([g, s]) => g === gapBefore && s === shapeBefore), walls);
  ok("the Feed and the second wall are there", (await stageText()).includes("Morning Sadhana") && (await p.$$(`#stage [data-tree-node="${wall2}"]`)).length === 1);
  await p.click('#tt-acts [data-tt="saved-doc"]'); await p.waitForSelector("#tt-show pre"); await p.waitForTimeout(80);
  const savedText = await p.$eval("#tt-show pre", (e) => e.textContent); const saved = JSON.parse(savedText);
  const feedNode = saved.content.find((n) => n.type === "thread-feed");
  ok("saved document has the Feed", !!feedNode);
  ok("the Feed holds no rows", feedNode && !("items" in feedNode.props) && !savedText.includes("Morning Sadhana"), feedNode && Object.keys(feedNode.props));
  await shot("6-saved");
  await p.click('#tt-show [data-tt="close"]'); await p.waitForTimeout(60);
  await p.click('#tt-acts [data-tt="published"]'); await p.waitForSelector("#tt-show .tt-show-page"); await p.waitForTimeout(150);
  const pub = await p.evaluate(() => { const s = document.querySelector("#tt-show"); return { text: s.innerText, marks: s.querySelectorAll("[data-tree-node],[data-tree-slot],[data-tree-wrap]").length, de: [...s.querySelectorAll("[class]")].filter((e) => [...e.classList].some((c) => c.startsWith("de-"))).length, wall: s.querySelectorAll(".blk-wall").length, hero: !!s.querySelector(".blk-hero") }; });
  ok("no editor marks", pub.marks === 0 && pub.de === 0, pub);
  ok("page drawn", pub.hero && pub.wall >= 1, pub);
  ok("an empty Feed: no sample rows", !pub.text.includes("Morning Sadhana"));
  await shot("6-published");
  await p.$eval("#tt-show .tt-show-body", (e) => { e.scrollTop = e.scrollHeight / 2; }); await p.waitForTimeout(60); await shot("6-published-2");
  const feedEls = await p.$$eval("#tt-show [class*=feed]", (e) => e.map((x) => [x.className, x.innerText.slice(0, 80)]));
  say(`  published feed elements: ${JSON.stringify(feedEls.slice(0, 4))}`);
  await p.click('#tt-show [data-tt="close"]'); await p.waitForTimeout(60);

  say("Step 7: Right-click the questions block");
  await rightNode("faq");
  ok("Reset style is grey", await rowOff("Reset style"));
  ok("Copy style is grey", await rowOff("Copy style"));
  await shot("7-menu");
  await p.keyboard.press("Escape"); await p.waitForTimeout(40);
  await clickNode("faq", 0.5, 0.1);
  ok("a click selects it", /question/i.test((await head()) ?? ""), await head());
  const look = await labelled("Look");
  ok("its Look setting stays", look && (await p.$eval(field(look), (e) => e.value)) === '"divided"', look && (await p.$eval(field(look), (e) => e.value)));
  ok("the block still draws it", (await p.$eval("#stage .blk-faq", (e) => e.dataset.look)) === "divided");

  say("Step 8: Detach");
  await clickNode(feedId, 0.5, 0.5);
  ok("Feed selected", (await head()) === "Feed", await head());
  ok("Detach is grey in the panel", await p.$eval('.de-vpanel [data-f="detach-block"]', (e) => e.disabled));
  const why = await p.locator('.de-vpanel [data-f="detach-why"]').innerText().catch(() => "");
  ok("with the reason", /sample rows/.test(why), why);
  await p.locator('.de-vpanel [data-f="detach-block"]').scrollIntoViewIfNeeded(); await p.waitForTimeout(50); await shot("8-feed");
  await rightNode(feedId); ok("Detach is grey in the menu", await rowOff("Detach")); await p.keyboard.press("Escape"); await p.waitForTimeout(40);
  await clickNode("hero");
  ok("Hero: Detach is on", await p.$eval('.de-vpanel [data-f="detach-block"]', (e) => !e.disabled));
  await p.locator('.de-vpanel [data-f="detach-block"]').scrollIntoViewIfNeeded(); await p.click('.de-vpanel [data-f="detach-block"]'); await p.waitForTimeout(120);
  ok("Hero: Detach works, the block is gone from the tree", (await p.$$('#stage [data-tree-node="hero"]')).length === 0, await head());
  ok("what it drew is still on the page", (await stageText()).includes("The Ambrosial Hours"));
  await shot("8-detached");
  await p.click("[data-a=undo]"); await p.waitForTimeout(100);
  ok("Undo brings it back", (await p.$$('#stage [data-tree-node="hero"]')).length === 1);

  say("Step 9: Code tab");
  await clickNode("hero");
  await p.click('.de-vpanel [data-tab="code"]'); await p.waitForTimeout(60);
  const code = await p.$eval(".de-vpanel .de-sheet-json", (e) => e.textContent).catch(() => null);
  ok("settings shown as JSON", !!code && !!JSON.parse(code).title, code && code.slice(0, 60));
  ok("read-only", (await p.$$(".de-vpanel .de-sheet textarea, .de-vpanel .de-sheet input")).length === 0);
  ok("the tree stays above", (await p.$$(".de-vpanel .de-layers li")).length > 3);
  await p.locator(".de-vpanel .de-sheet-json").scrollIntoViewIfNeeded(); await p.waitForTimeout(50); await shot("9-code");
  await clickNode(feedId, 0.5, 0.5); await p.waitForTimeout(40);
  const codeFeed = await p.$eval(".de-vpanel .de-sheet-json", (e) => e.textContent).catch(() => null);
  ok("on the Feed: no sample rows", !!codeFeed && !codeFeed.includes("Morning Sadhana"), codeFeed && codeFeed.slice(0, 60));
  await p.click('.de-vpanel [data-tab="props"]'); await p.waitForTimeout(40);

  say("Step 10: Add, Test: breaks on purpose");
  ok("an Add row with that name", await addByLabel("head", "Test: breaks on purpose"));
  const st = p.locator("#stage [data-tree-standin]");
  ok("a named box", (await st.innerText().catch(() => "")).startsWith("Test: breaks on purpose"), await st.innerText().catch(() => null));
  ok("the rest of the page stays", (await p.$$('#stage [data-tree-node="hero"], #stage [data-tree-node="wall"], #stage [data-tree-node="faq"], #stage [data-tree-node="box1"]')).length === 4);
  await st.scrollIntoViewIfNeeded(); await p.waitForTimeout(80); await shot("10-standin");

  ok("no page errors in the walk", errs.filter((e) => !/Minified React error|Broken on purpose/.test(e)).length === 0, errs.slice(0, 3));
  say(`page errors recorded: ${JSON.stringify(errs.slice(0, 3))}`);
  say(`pass ${pass} fail ${fail}`); fs.writeFileSync("/h/walk.log", lines.join("\n")); srv.close(); await b.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { say(`ERR ${e.message.slice(0, 500)} ${(e.stack || "").split("\n").find((l) => l.includes("walk.cjs")) ?? ""}`); fs.writeFileSync("/h/walk.log", lines.join("\n")); process.exit(2); });
