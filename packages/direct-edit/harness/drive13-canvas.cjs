// Stone 1, canvas checks C1 to C11 (plan section 9), C12 and C13 (from integration and review): sample rows, the stand-in, the empty label, and the test bar.
// Run through drive13.cjs: S=$S bash $S/h3/runall.sh drive13.cjs, with ONLY=canvas for this set alone.
module.exports = async ({ p, ok, errs, open, pick, menu }) => {
  const HOST = "#host";
  const FEED = "Morning Sadhana";
  const doc = () => p.evaluate(() => window.ed.doc());
  const docText = async () => JSON.stringify(await doc());
  const nodes = () => p.$$eval(`${HOST} [data-tree-node]`, (e) => e.length);
  const standins = () => p.$$eval(`${HOST} [data-tree-standin]`, (e) => e.length);
  const empties = () => p.$$eval(`${HOST} [data-tree-empty]`, (e) => e.length);
  const hostText = () => p.locator(HOST).innerText();
  const selected = () => p.$eval(".de-layers li.on", (e) => e.dataset.row).catch(() => null);
  const ofType = (d, type) => { const out = []; const go = (l) => { for (const n of l ?? []) { if (n.type === type) out.push(n); for (const v of Object.values(n.props ?? {})) if (Array.isArray(v) && v.some((x) => x && x.type && x.props)) go(v); } }; go(d.content); return out; };
  const undo = async () => { await p.click("[data-a=undo]"); await p.waitForTimeout(40); };
  const add = async (type, at = '[data-tree-node="head"]') => {
    await menu(at);
    await p.click('.de-menu [data-open="add"]'); await p.waitForTimeout(20);
    await p.click(`.de-menu [data-sub="add"] [data-mi="add:${type}"]`); await p.waitForTimeout(50);
  };
  const addRows = async () => {
    await menu('[data-tree-node="head"]');
    await p.click('.de-menu [data-open="add"]'); await p.waitForTimeout(20);
    const rows = await p.$$eval('.de-menu [data-sub="add"] button[data-mi]', (e) => e.map((b) => b.dataset.mi));
    await p.keyboard.press("Escape"); await p.waitForTimeout(20);
    return rows;
  };
  const save = async () => { await p.click("[data-a=save]"); await p.waitForFunction(() => document.querySelector(".de-editbar-hint")?.textContent.includes("Saved")); };
  const bar = async (tt) => { await p.click(`#tt-acts [data-tt="${tt}"]`); await p.waitForSelector("#tt-show"); await p.waitForTimeout(100); };
  const closeShow = async () => { await p.click('#tt-show [data-tt="close"]'); await p.waitForTimeout(40); };

  // C11: what the contract says, before anything is drawn from it.
  const c = await p.evaluate(() => {
    const k = window.kit.contract, prop = (b, n) => k[b].props.find((x) => x.name === n);
    return { items: k["thread-feed"].sample.items?.length, colour: prop("picture-wall", "captionColor").group, look: prop("faq", "look").group, slot: prop("grid", "items").group, hero: Object.keys(k["hero-banner"].sample).length };
  });
  ok("C11 thread-feed has two sample rows", c.items === 2, c.items);
  ok("C11 caption colour is in look", c.colour === "look", c.colour);
  ok("C11 faq look is in layout", c.look === "layout", c.look);
  ok("C11 a slot has no group", c.slot === null, c.slot);
  ok("C11 hero-banner has no sample", c.hero === 0, c.hero);

  // C1: the seed draws and every node is marked.
  for (const id of ["hero", "head", "wall", "faq", "grid1", "prose1", "box1"]) ok(`C1 ${id} carries the mark`, (await p.$$(`[data-tree-node="${id}"]`)).length === 1);
  const wall = await p.$$eval(".blk-wall-img", (e) => e.map((i) => i.naturalWidth));
  ok("C1 six wall pictures loaded", wall.length === 6 && wall.every((w) => w > 0), wall);

  // C4: every row of Add, one at a time, each undone before the next.
  const seedText = await docText();
  const rows = await addRows();
  console.log(`TRACE C4 rows ${rows.length}`);
  ok("C4 own rows and the test block are offered", ["add:box", "add:words", "add:picture", "add:test-throw"].every((m) => rows.includes(m)), rows);
  ok("C4 34 rows: 29 shared, pt-banner, 3 own, 1 test", rows.length === 34, rows.length);
  const drewEmpty = [], brokenPictures = new Set();
  // A profile block's sample rows name /api/media/sample/... pictures, which this page does not serve (plan section 14).
  // Answered here so they are listed, not counted as page errors.
  let adding = "";
  const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==", "base64");
  await p.route("**/api/media/sample/**", (r) => { brokenPictures.add(adding); return r.fulfill({ status: 200, contentType: "image/png", body: PNG }); });
  for (const mi of rows) {
    const type = mi.slice(4), before = await nodes(), errsBefore = errs.length;
    adding = type;
    await add(type);
    const after = await nodes();
    ok(`C4 ${type}: node count rises`, after > before, [before, after]);
    ok(`C4 ${type}: no error`, errs.length === errsBefore, errs.slice(errsBefore, errsBefore + 2));
    ok(`C4 ${type}: panel present`, (await p.$$(".de-vpanel .de-tabs")).length === 1);
    ok(`C4 ${type}: stand-in only on the test block`, (await standins()) === (type === "test-throw" ? 1 : 0), await standins());
    if ((await empties()) > 0) drewEmpty.push(type);
    // New words open for typing; undo works once that has ended.
    if (type === "words") { await p.keyboard.press("Escape"); await p.waitForTimeout(30); }
    await undo();
    ok(`C4 ${type}: undo returns the page`, (await docText()) === seedText);
  }
  await p.unroute("**/api/media/sample/**");
  console.log(`TRACE C4 drew an empty label: ${drewEmpty.join(" ")}`);
  console.log(`TRACE C4 sample pictures this page cannot serve: ${[...brokenPictures].join(" ")}`);

  // C2: Feed draws sample rows, and they stay out of the document.
  await add("thread-feed");
  ok("C2 sample row is drawn", (await hostText()).includes(FEED));
  const afterFeed = await doc();
  const feed = ofType(afterFeed, "thread-feed")[0];
  ok("C2 the document has the Feed", !!feed);
  ok("C2 no sample row text in the document", !JSON.stringify(afterFeed).includes(FEED));
  ok("C2 no items on the new node", !!feed && !("items" in feed.props), feed && Object.keys(feed.props));
  await p.screenshot({ path: "/h/shots/s13-feed.png" });

  // C3: nor in what is saved.
  await save();
  const saved = await p.evaluate(() => JSON.stringify(window.saved.at(-1)));
  ok("C3 saved holds no sample row text", !saved.includes(FEED));
  ok("C3 saved holds no sample id", !saved.includes("sample-1"));
  ok("C3 saved holds the Feed", saved.includes('"thread-feed"'));

  // C5: a block that throws stays in its own box.
  await add("test-throw");
  const standinText = await p.locator(`${HOST} [data-tree-standin]`).innerText();
  ok("C5 stand-in names the block", standinText === "Test: breaks on purpose: this block cannot draw here. It runs on the real site.", standinText);
  ok("C5 stand-in carries the mark", await p.$eval(`${HOST} [data-tree-standin]`, (e) => e.dataset.treeType === "test-throw" && !!e.dataset.treeNode));
  for (const id of ["hero", "head", "wall", "faq"]) ok(`C5 ${id} still drawn`, (await p.$$(`[data-tree-node="${id}"]`)).length === 1);
  await p.locator(`${HOST} [data-tree-standin]`).scrollIntoViewIfNeeded();
  await p.screenshot({ path: "/h/shots/s13-standin.png" });
  const throwId = await p.$eval(`${HOST} [data-tree-standin]`, (e) => e.dataset.treeNode);
  await pick("Hero banner");
  ok("C5 another block selected first", (await selected()) === "hero", await selected());
  await p.locator(`${HOST} [data-tree-standin]`).scrollIntoViewIfNeeded();
  await p.click(`${HOST} [data-tree-standin]`); await p.waitForTimeout(40);
  ok("C5 click selects it", (await selected()) === throwId, await selected());
  await p.keyboard.press("Delete"); await p.waitForTimeout(40);
  ok("C5 Delete removes it", (await standins()) === 0 && ofType(await doc(), "test-throw").length === 0);
  await undo();
  ok("C5 Undo returns it", (await standins()) === 1 && ofType(await doc(), "test-throw").length === 1);

  // C7: a later draw tries the failed block again, and the block that recovers can be selected.
  const edit = async () => { await pick("Hero banner"); await p.keyboard.press("Control+d"); await p.waitForTimeout(60); };
  await p.evaluate(() => { globalThis.__healed = true; });
  await edit();
  ok("C7 no stand-in after a later draw", (await standins()) === 0, await standins());
  ok("C7 the block draws", (await hostText()).includes("Healed"));
  ok("C7 what it draws now is marked", (await p.$$(`[data-tree-node="${throwId}"]`)).length === 1 && await p.$eval(`[data-tree-node="${throwId}"]`, (e) => e.textContent === "Healed"));
  await p.evaluate(() => { globalThis.__healed = false; });
  await edit();
  ok("C7 and fails again if it throws again", (await standins()) === 1, await standins());
  await undo(); await undo();
  ok("C7 undone to one stand-in", (await standins()) === 1 && ofType(await doc(), "hero-banner").length === 1);

  // C9, part: with the test block on the page, the overlay says so instead of going blank.
  await bar("published");
  ok("C9 a throw in the published view is named", (await p.locator("#tt-show .tt-show-body").innerText()).includes("Broken on purpose"));
  await closeShow();
  await p.locator(`${HOST} [data-tree-standin]`).scrollIntoViewIfNeeded();
  await p.click(`${HOST} [data-tree-standin]`); await p.waitForTimeout(40);
  await p.keyboard.press("Delete"); await p.waitForTimeout(40);
  ok("C5 test block gone for the rest of the run", (await standins()) === 0);

  // C6: a block with nothing to show is a labelled box that can be selected.
  const emptiesBefore = await empties();
  await add("picture-wall");
  const label = p.locator(`${HOST} [data-tree-empty]`).last();
  ok("C6 one more empty label", (await empties()) === emptiesBefore + 1, await empties());
  ok("C6 label text", (await label.innerText()) === "Picture wall: nothing to show yet", await label.innerText());
  await label.scrollIntoViewIfNeeded();
  await p.screenshot({ path: "/h/shots/s13-empty.png" });
  const emptyId = await selected();
  await pick("Hero banner");
  await label.scrollIntoViewIfNeeded();
  await label.click(); await p.waitForTimeout(40);
  ok("C6 can be selected", (await selected()) === emptyId && !!emptyId, [emptyId, await selected()]);
  await undo();
  ok("C6 undone", (await empties()) === emptiesBefore);

  // C9: as published. No editor marks, no sample rows, and the document is not touched.
  const beforeShow = await docText();
  await bar("published");
  const show = await p.evaluate(() => {
    const s = document.querySelector("#tt-show");
    const deClass = [...s.querySelectorAll("[class]")].filter((e) => [...e.classList].some((c) => c.startsWith("de-"))).map((e) => e.className);
    return { hasUi: s.hasAttribute("data-de-ui") && s.hasAttribute("data-de-menu"), text: s.innerText, wall: s.querySelectorAll(".blk-wall").length, marks: s.querySelectorAll("[data-tree-node],[data-tree-slot],[data-tree-wrap]").length, deClass, focus: document.activeElement?.dataset?.tt };
  });
  ok("C9 overlay attributes", show.hasUi);
  ok("C9 hero title", show.text.includes("The Ambrosial Hours"));
  ok("C9 wall", show.wall === 1, show.wall);
  ok("C9 no tree marks", show.marks === 0, show.marks);
  ok("C9 no editor class", show.deClass.length === 0, show.deClass.slice(0, 4));
  ok("C9 no sample rows", !show.text.includes(FEED));
  ok("C9 focus on close", show.focus === "close", show.focus);
  ok("C9 selection cleared", (await selected()) === null, await selected());
  await p.screenshot({ path: "/h/shots/s13-published.png" });
  await p.keyboard.press("Control+z"); await p.keyboard.press("Delete"); await p.waitForTimeout(40);
  ok("C9 editor keys do not reach behind the overlay", (await docText()) === beforeShow);
  await closeShow();
  ok("C9 overlay closes", (await p.$$("#tt-show")).length === 0);
  ok("C9 focus returns to the button", await p.evaluate(() => document.activeElement?.dataset?.tt === "published"));
  ok("C9 document unchanged", (await docText()) === beforeShow);
  ok("C9 editor still answers", (await pick("Hero banner"), (await selected()) === "hero"));
  await bar("published");
  await p.keyboard.press("Escape"); await p.waitForTimeout(40);
  ok("C9 Escape closes", (await p.$$("#tt-show")).length === 0);

  // C10: the saved document, and a reopened editor, hold the Feed without rows.
  await bar("saved-doc");
  const shownJson = await p.$eval("#tt-show pre", (e) => e.textContent);
  const shown = JSON.parse(shownJson);
  const shownFeed = ofType(shown, "thread-feed")[0];
  ok("C10 indented JSON", shownJson.includes('\n  "content"'));
  ok("C10 holds the Feed", !!shownFeed);
  ok("C10 no rows on the Feed", !!shownFeed && !("items" in shownFeed.props) && !shownJson.includes(FEED), shownFeed && Object.keys(shownFeed.props));
  await closeShow();
  await p.evaluate(() => window.remount()); await p.waitForTimeout(200);
  const again = await doc();
  ok("C10 remount keeps the Feed", ofType(again, "thread-feed").length === 1);
  ok("C10 remount has no rows in the document", !JSON.stringify(again).includes(FEED));
  ok("C10 remount draws the sample rows", (await hostText()).includes(FEED));
  await bar("saved-doc");
  ok("C10 the bar still works after remount", (await p.$$("#tt-show pre")).length === 1);
  await closeShow();

  // C12: a right-click selects, and the rebuilt panel writes its old scroll back (panel.ts:225), which fires a scroll event if it too overflows.
  // Hand test steps 4 to 5 go this way in a short window. It must not close the menu; a page scroll still does.
  await p.setViewportSize({ width: 1500, height: 600 }); await p.waitForTimeout(60);
  await pick("Picture wall");
  const clamped = await p.evaluate(() => { const b = document.querySelector(".de-vpanel .de-body"); b.scrollTop = b.scrollHeight; return b.scrollTop; });
  ok("C12 the wall's panel is scrolled", clamped > 0, clamped);
  // Let the page land first: menu() scrolls just before it clicks, and a page scroll closes a menu by design.
  await p.locator('[data-tree-node="head"]').first().scrollIntoViewIfNeeded(); await p.waitForTimeout(150);
  await p.evaluate(() => { window.__scrolls = []; window.addEventListener("scroll", (e) => window.__scrolls.push(e.target === document ? "document" : e.target.className), { capture: true }); });
  await menu('[data-tree-node="head"]'); await p.waitForTimeout(120);
  ok("C12 the new panel took a scroll position of its own", (await p.$eval(".de-vpanel .de-body", (b) => b.scrollTop)) > 0);
  ok("C12 the panel's scroll fired while the menu was open", (await p.evaluate(() => window.__scrolls)).includes("de-body"), await p.evaluate(() => window.__scrolls));
  ok("C12 the menu stays open", (await p.$$(".de-menu")).length === 1, await p.evaluate(() => window.__scrolls));
  await p.evaluate(() => window.scrollBy({ top: 30, behavior: "instant" })); await p.waitForTimeout(60);
  ok("C12 a page scroll still closes it", (await p.$$(".de-menu")).length === 0);
  await p.setViewportSize({ width: 1500, height: 950 }); await p.waitForTimeout(60);

  // C13: a block that throws after it mounted fails the boundary alone, and NodeMark's effect does not run. The stand-in must carry the mark itself.
  const STANDIN = `${HOST} [data-tree-standin]`;
  const settleOn = async (selector) => { await p.locator(selector).first().scrollIntoViewIfNeeded(); await p.waitForTimeout(100); };
  const lateMark = () => p.$eval(STANDIN, (e) => ({ node: e.dataset.treeNode ?? null, type: e.dataset.treeType ?? null, sealed: e.dataset.treeSealed ?? null }));
  await p.evaluate(() => { globalThis.__healed = true; globalThis.__lateThrow = true; });
  const standinsBefore = await standins();
  await add("test-throw");
  await p.waitForSelector(STANDIN); await p.waitForTimeout(30);
  const late = await lateMark();
  ok("C13 one stand-in", (await standins()) === standinsBefore + 1, await standins());
  ok("C13 the stand-in carries the mark", !!late.node && late.type === "test-throw" && late.sealed === "", late);
  ok("C13 only it carries the mark", (await p.$$(`[data-tree-node="${late.node}"]`)).length === 1);
  await pick("Hero banner");
  await settleOn(STANDIN);
  await p.click(STANDIN); await p.waitForTimeout(40);
  ok("C13 click selects it", (await selected()) === late.node, await selected());
  await menu(STANDIN);
  ok("C13 right-click opens the menu", (await p.$$(".de-menu")).length === 1);
  ok("C13 Detach is off in the menu", await p.$eval('.de-menu [data-mi="detach"]', (e) => e.disabled));
  await p.keyboard.press("Escape"); await p.waitForTimeout(20);
  // A later draw mounts it again; it draws, throws again, and is marked again.
  await pick("Hero banner"); await p.keyboard.press("Control+d"); await p.waitForTimeout(250);
  const lateAgain = await lateMark();
  ok("C13 marked again after a later draw", lateAgain.node === late.node && lateAgain.type === "test-throw", lateAgain);
  await undo(); await p.waitForTimeout(150);
  await settleOn(STANDIN);
  await p.click(STANDIN); await p.waitForTimeout(40);
  await p.keyboard.press("Delete"); await p.waitForTimeout(40);
  ok("C13 Delete removes it", (await standins()) === standinsBefore && !(await docText()).includes(`"id":"${late.node}"`), await standins());
  await p.evaluate(() => { globalThis.__healed = false; globalThis.__lateThrow = false; });

  // C8: a host with no contract, which is every real host today.
  await p.evaluate(() => window.ed.dispose()); await p.waitForTimeout(20);
  await open("", "tree.html");
  ok("C8 no contract", await p.evaluate(() => !("contract" in window.kit)));
  await add("thread-feed");
  ok("C8 Feed draws no sample rows", !(await hostText()).includes(FEED));
  ok("C8 no Content section", (await p.$$('.de-vpanel [data-section="content"]')).length === 0);
  ok("C8 the old note", (await p.locator(".de-vpanel").innerText()).includes("A block. Drag it into any box. Its settings still shape it"));
  await add("picture-wall");
  const plain = await p.locator(`${HOST} [data-tree-empty]`).last().innerText();
  ok("C8 the empty label as before", plain === "Picture wall", plain);
  // The refusals and the look guards belong to a contract. With none, these rows are as the baseline bundle has them.
  ok("C8 Detach not refused on an empty label", await p.$eval('.de-vpanel [data-f="detach-block"]', (e) => !e.disabled) && (await p.$$('.de-vpanel [data-f="detach-why"]')).length === 0);
  await add("faq");
  await menu(`[data-tree-node="${await selected()}"]`);
  const rowOn = (id) => p.$eval(`.de-menu [data-mi="${id}"]`, (e) => !e.disabled);
  ok("C8 a sealed block with a look still offers Copy style", await rowOn("copy-style"));
  ok("C8 and Reset style", await rowOn("reset"));
  ok("C8 and Detach", await rowOn("detach"));
  await p.keyboard.press("Escape"); await p.waitForTimeout(20);
  await p.evaluate(() => window.ed.dispose()); await p.waitForTimeout(20);
};
