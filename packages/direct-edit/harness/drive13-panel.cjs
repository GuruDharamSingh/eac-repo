// Stone 1, right column and editor: checks P1 to P16 of the build plan, section 9.
// Loaded by drive13.cjs. Each group starts from a fresh page.
module.exports = async ({ p, ok, errs, open, pick, rowFor, menu }) => {
  // A dirty editor warns on leaving; the next group's fresh page is that leaving.
  p.on("dialog", (d) => d.accept().catch(() => {}));

  const sel = async (id) => { await p.evaluate((i) => window.ed.select(i), id); await p.waitForTimeout(40); };
  const doc = () => p.evaluate(() => window.ed.doc());
  const nodeIn = (d, id) => {
    let hit = null;
    const go = (list) => { for (const n of list ?? []) { if (n.props.id === id) hit = n; for (const v of Object.values(n.props)) if (Array.isArray(v) && v[0]?.type) go(v); } };
    go(d.content);
    return hit;
  };
  const prop = async (id, name) => nodeIn(await doc(), id)?.props[name];
  const field = (name) => `.de-vpanel [data-f="p-${name}"]`;
  const row = (name) => `.de-vpanel [data-sync="row-p-${name}"]`;
  const sections = () => p.$$eval(".de-vpanel .de-sec[data-section]", (e) => e.map((x) => x.dataset.section));
  const undo = async () => { await p.click("[data-a=undo]"); await p.waitForTimeout(50); };
  const redo = async () => { await p.click("[data-a=redo]"); await p.waitForTimeout(50); };
  const active = () => p.evaluate(() => document.activeElement?.dataset?.f ?? null);
  const hint = () => p.textContent(".de-editbar-hint");
  const choose = async (name, value) => { await p.focus(field(name)); await p.selectOption(field(name), JSON.stringify(value)); await p.waitForTimeout(50); };
  const blur = async (name) => { await p.$eval(field(name), (e) => e.blur()); await p.waitForTimeout(40); };
  /** Scroll first and let it land: a scroll event closes an open menu, and menu() scrolls just before it clicks. */
  const settle = async (selector) => { await p.locator(selector).first().scrollIntoViewIfNeeded(); await p.waitForTimeout(80); };
  /** Right-click, Add, the block. Resolves to the new node's id. */
  const add = async (anchor, type) => {
    const before = await doc();
    await settle(`[data-tree-node="${anchor}"]`);
    await menu(`[data-tree-node="${anchor}"]`);
    await p.click('.de-menu [data-open="add"]');
    await p.click(`.de-menu [data-mi="add:${type}"]`);
    await p.waitForTimeout(80);
    const known = new Set(); const walk = (list) => { for (const n of list ?? []) { known.add(n.props.id); for (const v of Object.values(n.props)) if (Array.isArray(v) && v[0]?.type) walk(v); } };
    walk(before.content);
    let id = null; const find = (list) => { for (const n of list ?? []) { if (n.type === type && !known.has(n.props.id)) id = n.props.id; for (const v of Object.values(n.props)) if (Array.isArray(v) && v[0]?.type) find(v); } };
    find((await doc()).content);
    return id;
  };
  const menuRow = (id) => p.$eval(`.de-menu [data-mi="${id}"]`, (e) => e.disabled);
  const closeMenu = async () => { await p.keyboard.press("Escape"); await p.waitForTimeout(30); };
  const nodeSel = (id) => `[data-tree-node="${id}"]`;
  const menuOn = async (id) => { await settle(nodeSel(id)); await menu(nodeSel(id)); };

  // ------------------------------------------------------------------ P1
  await sel("hero");
  // Since stone 2 a sealed node's panel is its root part: its options first, in their order, then a box's sections.
  const heroSecs = await sections();
  ok("P1 hero sections: options first", heroSecs[0] === "content" && heroSecs.includes("layout") && heroSecs.includes("appearance"), heroSecs);
  const labels = (s) => p.$$eval(`.de-vpanel .de-sec[data-section="${s}"] .de-label`, (e) => e.map((x) => x.textContent));
  ok("P1 content labels", (await labels("content")).join() === "Title,Subtitle,Background image,Image description", await labels("content"));
  ok("P1 layout labels: options first", (await labels("layout")).slice(0, 2).join() === "Text position,Height", await labels("layout"));
  ok("P1 heading is the block's label", (await p.textContent(".de-vpanel .de-head b")) === "Hero banner", await p.textContent(".de-vpanel .de-head b"));
  ok("P1 hint on a label", (await p.getAttribute(`${row("subtitle")} .de-label`, "title"))?.startsWith("One line under the title"));
  // The middle column is what is left, which a scrollbar in a longer panel narrows; the label and reset columns are the row's grid.
  const metric = (selector) => p.$eval(selector, (e) => { const r = e.closest(".de-row"), c = getComputedStyle(r).gridTemplateColumns.split(" "); return { cols: `${c[0]} ${c[2]}`, h: Math.round(e.getBoundingClientRect().height), row: Math.round(r.getBoundingClientRect().height) }; });
  const heroText = await metric(field("title")), heroSelect = await metric(field("align")), heroNum = await metric(`${row("height")} .de-num`);
  await p.screenshot({ path: "/h/shots/s13-hero.png" });
  await sel("box1");
  const boxText = await metric('.de-vpanel [data-f="attr-href"]'), boxSelect = await metric('.de-vpanel [data-f="tag"]'), boxNum = await metric('.de-vpanel [data-sync="row-padding"] .de-num');
  ok("P1 text row as a box's", heroText.cols === boxText.cols && heroText.h === boxText.h && heroText.row === boxText.row, [heroText, boxText]);
  ok("P1 select row as a box's", heroSelect.cols === boxSelect.cols && heroSelect.h === boxSelect.h && heroSelect.row === boxSelect.row, [heroSelect, boxSelect]);
  ok("P1 number row as a box's", heroNum.cols === boxNum.cols && heroNum.h === boxNum.h, [heroNum, boxNum]);

  // ------------------------------------------------------------------ P2
  await open(); await sel("hero");
  const title0 = await p.textContent(".blk-hero-title");
  await p.click(field("title")); await p.keyboard.press("End");
  await p.keyboard.type("!"); await p.waitForTimeout(30);
  ok("P2 first letter draws", (await p.textContent(".blk-hero-title")) === `${title0}!`, await p.textContent(".blk-hero-title"));
  await p.waitForTimeout(900);
  await p.keyboard.type("?"); await p.waitForTimeout(30);
  ok("P2 second letter draws after a pause", (await p.textContent(".blk-hero-title")) === `${title0}!?`, await p.textContent(".blk-hero-title"));
  ok("P2 focus stays", (await active()) === "p-title", await active());
  ok("P2 caret at the end", await p.$eval(field("title"), (e) => e.selectionStart === e.value.length));
  await undo();
  ok("P2 one undo returns the original", (await p.textContent(".blk-hero-title")) === title0, await p.textContent(".blk-hero-title"));
  ok("P2 one undo is all there is", await p.$eval("[data-a=undo]", (e) => e.disabled));
  ok("P2 field shows the original", (await p.inputValue(field("title"))) === title0);
  await redo();
  ok("P2 redo restores it", (await p.textContent(".blk-hero-title")) === `${title0}!?`);
  ok("P2 field shows the redone text", (await p.inputValue(field("title"))) === `${title0}!?`);
  await p.keyboard.press("Control+z"); await p.waitForTimeout(50);
  ok("P2 Ctrl+Z outside the field", (await p.textContent(".blk-hero-title")) === title0, await p.textContent(".blk-hero-title"));
  await p.click(field("title")); await p.keyboard.press("End"); await p.keyboard.type("A"); await p.waitForTimeout(30);
  await p.click(field("subtitle")); await p.keyboard.press("End"); await p.keyboard.type("B"); await p.waitForTimeout(30);
  await undo();
  ok("P2 leaving a field starts a new step", (await prop("hero", "subtitle")) === "Rise with the sun" && (await prop("hero", "title")) === `${title0}A`, [await prop("hero", "subtitle"), await prop("hero", "title")]);

  // ------------------------------------------------------------------ P3
  await open(); await sel("hero");
  await choose("align", "left");
  ok("P3 hero align moves the copy", (await p.$eval(".blk-hero-copy", (e) => e.style.textAlign)) === "left");
  ok("P3 focus returns to the select", (await active()) === "p-align", await active());
  ok("P3 stored", (await prop("hero", "align")) === "left");
  await sel("wall");
  await choose("gap", "loose");
  ok("P3 wall gap", (await p.$eval(".blk-wall", (e) => e.dataset.gap)) === "loose");
  ok("P3 focus returns after gap", (await active()) === "p-gap", await active());
  await choose("shape", "square");
  ok("P3 wall shape", (await p.$eval(".blk-wall", (e) => e.dataset.shape)) === "square");
  await sel("faq");
  await choose("look", "boxed");
  ok("P3 faq look", (await p.$eval(".blk-faq", (e) => e.dataset.look)) === "boxed");
  ok("P3 faq look is a setting, in its own row", (await prop("faq", "look")) === "boxed");

  // ------------------------------------------------------------------ P4
  await open(); await sel("box1");
  await p.click('.de-vpanel [data-f="pop-fill"]'); await p.waitForTimeout(40);
  const boxTabs = await p.$$eval(".de-colorpop .de-poptabs [data-ctab]", (e) => e.map((x) => x.textContent));
  await p.keyboard.press("Escape"); await p.waitForTimeout(30);
  await sel("wall");
  ok("P4 caption colour is in Appearance", (await p.$$(`.de-vpanel .de-sec[data-section="appearance"] [data-sync="row-p-captionColor"]`)).length === 1);
  ok("P4 no reset arrow at first", (await p.$$('[data-f="reset-p-captionColor"]')).length === 0);
  await p.click('.de-vpanel [data-f="pop-p-captionColor"]'); await p.waitForTimeout(40);
  ok("P4 colour popover opens", (await p.$$(".de-colorpop")).length === 1);
  const wallTabs = await p.$$eval(".de-colorpop .de-poptabs [data-ctab]", (e) => e.map((x) => x.textContent));
  ok("P4 same tabs as a box's Fill", wallTabs.join() === "Palette,Custom" && wallTabs.join() === boxTabs.join(), [wallTabs, boxTabs]);
  await p.screenshot({ path: "/h/shots/s13-colour.png" });
  await p.click('[data-f="ctab-custom"]'); await p.waitForTimeout(30);
  await p.fill('[data-f="chex"]', "#aa2233"); await p.waitForTimeout(60);
  ok("P4 custom hex colours the captions", (await p.$eval(".blk-wall-caption", (e) => getComputedStyle(e).color)) === "rgb(170, 34, 51)", await p.$eval(".blk-wall-caption", (e) => getComputedStyle(e).color));
  ok("P4 stored", (await prop("wall", "captionColor")) === "#aa2233");
  ok("P4 reset arrow appears", (await p.$$('[data-f="reset-p-captionColor"]')).length === 1);
  await p.click('[data-f="popclose"]'); await p.waitForTimeout(30);
  await p.click('[data-f="reset-p-captionColor"]'); await p.waitForTimeout(50);
  ok("P4 reset returns to empty", (await prop("wall", "captionColor")) === "");
  ok("P4 inline colour is gone", (await p.$eval(".blk-wall-caption", (e) => e.style.color)) === "");
  ok("P4 arrow gone after reset", (await p.$$('[data-f="reset-p-captionColor"]')).length === 0);

  // ------------------------------------------------------------------ P5
  await open(); await sel("hero");
  await p.fill(field("height"), "99999"); await p.waitForTimeout(40);
  ok("P5 typing past the top stores the top", (await prop("hero", "height")) === 1200, await prop("hero", "height"));
  await blur("height");
  ok("P5 field shows what is stored after leaving", (await p.inputValue(field("height"))) === "1200", await p.inputValue(field("height")));
  await p.fill(field("height"), "300"); await p.waitForTimeout(30);
  await p.press(field("height"), "ArrowUp"); await p.waitForTimeout(30);
  ok("P5 ArrowUp steps 10", (await prop("hero", "height")) === 310, await prop("hero", "height"));
  ok("P5 min-height applied", (await p.$eval(".blk-hero", (e) => e.style.minHeight)) === "310px", await p.$eval(".blk-hero", (e) => e.style.minHeight));
  ok("P5 unit in the field", (await p.textContent(`${row("height")} .de-unit`)) === "px");

  // ------------------------------------------------------------------ P6
  await open(); await sel("faq");
  const firstOpen = () => p.$eval(".blk-faq details", (e) => e.open);
  ok("P6 starts open", await firstOpen());
  ok("P6 On is the pressed chip", await p.$eval('[data-f="p-openFirst=true"]', (e) => e.getAttribute("aria-pressed") === "true"));
  await p.click('[data-f="p-openFirst=false"]'); await p.waitForTimeout(40);
  ok("P6 Off closes the first", !(await firstOpen()));
  ok("P6 stored false", (await prop("faq", "openFirst")) === false);
  await p.click('[data-f="p-openFirst=true"]'); await p.waitForTimeout(40);
  ok("P6 On opens it", await firstOpen());
  ok("P6 chip labels", (await p.$$eval(`${row("openFirst")} .de-seg button`, (e) => e.map((x) => x.textContent))).join() === "Off,On");

  // ------------------------------------------------------------------ P7
  await open(); await sel("wall");
  ok("P7 wall row reads 6 rows", (await p.textContent(`${row("pictures")} .de-readout`)) === "6 rows", await p.textContent(`${row("pictures")} .de-readout`));
  ok("P7 no input on the row", (await p.$$(`${row("pictures")} input, ${row("pictures")} textarea, ${row("pictures")} select`)).length === 0);
  ok("P7 says rows cannot change here yet", (await p.textContent('.de-vpanel .de-sec[data-section="content"]')).includes("Rows cannot be changed here yet."));
  await p.evaluate(() => { document.querySelector(".de-vpanel .de-sec[data-section='content']")?.scrollIntoView({ block: "start" }); });
  await p.screenshot({ path: "/h/shots/s13-wall.png" });
  const wall2 = await add("wall", "picture-wall");
  ok("P7 empty wall selected", (await p.textContent(".de-vpanel .de-head b")) === "Picture wall" && !!wall2);
  ok("P7 empty wall reads None yet", (await p.textContent(`${row("pictures")} .de-readout`)) === "None yet", await p.textContent(`${row("pictures")} .de-readout`));
  ok("P7 still no input", (await p.$$(`${row("pictures")} input, ${row("pictures")} textarea, ${row("pictures")} select`)).length === 0);

  // ------------------------------------------------------------------ P8
  await open();
  const textId = await add("head", "prose");
  const isEmpty = () => p.$$eval(`${nodeSel(textId)}[data-tree-empty]`, (e) => e.length === 1);
  ok("P8 a new Text shows the empty label", await isEmpty());
  await p.click(field("body")); await p.keyboard.type("Words"); await p.waitForTimeout(50);
  ok("P8 label goes", (await p.$$(`[data-tree-wrap="${textId}"] [data-tree-empty]`)).length === 0);
  ok("P8 the block draws", (await p.textContent(nodeSel(textId))).includes("Words"), await p.textContent(nodeSel(textId)));
  ok("P8 selection holds", (await p.$eval(".de-layers li.on", (e) => e.dataset.row)) === textId && (await p.textContent(".de-vpanel .de-head b")) === "Text");
  ok("P8 field keeps focus", (await active()) === "p-body", await active());
  await p.fill(field("body"), ""); await p.waitForTimeout(50);
  ok("P8 clearing brings the label back", await isEmpty());
  ok("P8 selection still holds", (await p.$eval(".de-layers li.on", (e) => e.dataset.row)) === textId);
  ok("P8 no label text in the document", !JSON.stringify(await doc()).includes("nothing to show yet"));

  // ------------------------------------------------------------------ P9
  await open();
  await menuOn("faq");
  ok("P9 faq: Copy style off", await menuRow("copy-style"));
  ok("P9 faq: Reset style off", await menuRow("reset"));
  ok("P9 faq: Hide off", await menuRow("hide"));
  ok("P9 rows stay listed", (await p.$$('.de-menu [data-mi="reset"], .de-menu [data-mi="copy-style"], .de-menu [data-mi="detach"]')).length === 3);
  await p.screenshot({ path: "/h/shots/s13-faq-menu.png" });
  await closeMenu();
  ok("P9 faq look kept", (await prop("faq", "look")) === "divided");
  await sel(null);
  await menuOn("box1");
  ok("P9 box: Copy style on", !(await menuRow("copy-style")));
  ok("P9 box: Reset style on", !(await menuRow("reset")));
  ok("P9 box: Hide on", !(await menuRow("hide")));
  await closeMenu();

  // ------------------------------------------------------------------ P10
  await open();
  const feed = await add("hero", "thread-feed");
  ok("P10 feed notice", (await p.textContent('.de-vpanel [data-f="notice"]')) === "Sample rows. Not saved.", await p.$eval(".de-vpanel .de-body", (e) => e.textContent.slice(0, 200)));
  ok("P10 detach off in the panel", await p.$eval('[data-tree-act="detach"]', (e) => e.disabled));
  ok("P10 the panel says why", (await p.textContent('[data-f="detach-why"]')).includes("sample rows"));
  const before10 = JSON.stringify(await doc());
  await menuOn(feed);
  ok("P10 detach off in the menu", await menuRow("detach"));
  await closeMenu();
  ok("P10 document unchanged", JSON.stringify(await doc()) === before10);
  await sel("hero");
  ok("P10 hero has no notice", (await p.$$('.de-vpanel [data-f="notice"]')).length === 0);
  await p.click('[data-tree-act="detach"]'); await p.waitForTimeout(80);
  ok("P10 hero detaches", (await doc()).content[0].type === "box", (await doc()).content[0].type);
  await undo();
  ok("P10 undo brings the hero back", (await doc()).content[0].type === "hero-banner");

  // ------------------------------------------------------------------ P11
  await open();
  const emptyWall = await add("head", "picture-wall");
  ok("P11 empty wall: detach off in the panel", await p.$eval('[data-tree-act="detach"]', (e) => e.disabled));
  await menuOn(emptyWall);
  ok("P11 empty wall: detach off in the menu", await menuRow("detach"));
  await closeMenu();
  const broken = await add("head", "test-throw");
  ok("P11 stand-in drawn", (await p.$$(`${nodeSel(broken)}[data-tree-standin]`)).length === 1);
  ok("P11 stand-in: detach off in the panel", await p.$eval('[data-tree-act="detach"]', (e) => e.disabled));
  await menuOn(broken);
  ok("P11 stand-in: detach off in the menu", await menuRow("detach"));
  await closeMenu();
  ok("P11 no stand-in or label text in the document", !/nothing to show yet|cannot draw here/.test(JSON.stringify(await doc())));

  // ------------------------------------------------------------------ P17, from the review
  // A select with nothing stored and no default must not read as chosen, and its first real option must store.
  await open();
  const badge = await add("head", "cycle-badge");
  const optionTexts = (name) => p.$eval(field(name), (e) => [...e.options].map((o) => o.textContent));
  const shownOption = (name) => p.$eval(field(name), (e) => e.options[e.selectedIndex]?.textContent);
  const emptyLabel = (id) => p.$$(`[data-tree-wrap="${id}"] [data-tree-empty]`);
  ok("P17 nothing stored", (await prop(badge, "status")) === undefined, await prop(badge, "status"));
  ok("P17 reads Choose…", (await shownOption("status")) === "Choose…", await shownOption("status"));
  ok("P17 the placeholder is not an option to pick", await p.$eval(field("status"), (e) => e.options[0].disabled));
  ok("P17 the real options follow it", (await optionTexts("status")).join() === "Choose…,Confirmed,Cancelled,Not yet confirmed", await optionTexts("status"));
  ok("P17 no reset arrow yet", (await p.$$('.de-vpanel [data-f="reset-p-status"]')).length === 0);
  await p.screenshot({ path: "/h/shots/s13-badge.png" });
  await choose("status", "confirmed");
  ok("P17 the first real option stores", (await prop(badge, "status")) === "confirmed", await prop(badge, "status"));
  ok("P17 the block draws it", (await emptyLabel(badge)).length === 0);
  ok("P17 the placeholder goes", !(await optionTexts("status")).includes("Choose…"), await optionTexts("status"));
  ok("P17 focus returns to the select", (await active()) === "p-status", await active());
  await p.click('.de-vpanel [data-f="reset-p-status"]'); await p.waitForTimeout(50);
  ok("P17 reset stores nothing", (await prop(badge, "status")) === undefined, await prop(badge, "status"));
  ok("P17 and reads Choose… again", (await shownOption("status")) === "Choose…", await shownOption("status"));
  await undo();
  ok("P17 undo brings the choice back", (await prop(badge, "status")) === "confirmed" && (await shownOption("status")) === "Confirmed");
  await sel("faq");
  ok("P17 a select with a value has no placeholder", !(await optionTexts("look")).includes("Choose…"), await optionTexts("look"));
  await sel("box1");
  ok("P17 a box's select has no placeholder", !(await p.$$eval(".de-vpanel select option", (e) => e.some((o) => o.textContent === "Choose…"))));

  // ------------------------------------------------------------------ P18, from the review
  // Detach and its reason follow what the block draws while a field holds focus.
  await open();
  const detachNow = () => p.evaluate(() => { const b = document.querySelector('[data-tree-act="detach"]'), w = document.querySelector('[data-f="detach-why"]'); return { off: b.disabled, why: w ? w.textContent : null }; });
  const typed = await add("head", "prose");
  let d18 = await detachNow();
  ok("P18 empty: off, with the reason", d18.off && /drawn nothing/.test(d18.why), d18);
  await p.click(field("body")); await p.keyboard.type("Words"); await p.waitForTimeout(40);
  d18 = await detachNow();
  ok("P18 typed: on, no reason", !d18.off && d18.why === null, d18);
  ok("P18 typed: the field keeps focus", (await active()) === "p-body", await active());
  await p.keyboard.press("Tab"); await p.waitForTimeout(30);
  ok("P18 still on after Tab", !(await detachNow()).off);
  await p.fill(field("body"), ""); await p.waitForTimeout(40);
  d18 = await detachNow();
  ok("P18 cleared: off, with the reason", d18.off && /drawn nothing/.test(d18.why), d18);
  ok("P18 cleared: the field keeps focus", (await active()) === "p-body", await active());
  await p.keyboard.type("Again"); await p.waitForTimeout(40);
  await p.click('[data-tree-act="detach"]'); await p.waitForTimeout(80);
  ok("P18 a button that came on works", !nodeIn(await doc(), typed), JSON.stringify(nodeIn(await doc(), typed)));
  await undo();
  ok("P18 undo brings the block back", !!nodeIn(await doc(), typed));
  const standinNode = await add("head", "test-throw");
  d18 = await detachNow();
  ok("P18 stand-in: off, with the reason", d18.off && /cannot draw/.test(d18.why), d18);
  await p.click(field("word")); await p.keyboard.type("heal"); await p.waitForTimeout(40);
  d18 = await detachNow();
  ok("P18 it draws: on, no reason", !d18.off && d18.why === null && (await p.$$(`${nodeSel(standinNode)}[data-tree-standin]`)).length === 0, d18);
  await p.keyboard.press("Backspace"); await p.waitForTimeout(40);
  d18 = await detachNow();
  ok("P18 it fails again: off, with the reason", d18.off && /cannot draw/.test(d18.why), d18);
  ok("P18 the stand-in is back and the field keeps focus", (await p.$$(`${nodeSel(standinNode)}[data-tree-standin]`)).length === 1 && (await active()) === "p-word", await active());
  ok("P18 the wrapper draws no box of its own", (await p.$eval('[data-sync="block-actions"]', (e) => getComputedStyle(e).display)) === "contents");

  // ------------------------------------------------------------------ P19, from the review
  // A sample with an empty list draws the block's own message: no "Sample rows", and still nothing Detach may copy.
  await open();
  const gallery = await add("head", "gallery-grid");
  ok("P19 no notice", (await p.$$('.de-vpanel [data-f="notice"]')).length === 0);
  ok("P19 the block draws its own message", (await p.textContent(nodeSel(gallery))).includes("This gallery is empty"), await p.textContent(nodeSel(gallery)));
  const d19 = await detachNow();
  ok("P19 detach off, with a reason that fits", d19.off && /no rows to show/.test(d19.why) && !/sample rows/i.test(d19.why), d19);
  await p.screenshot({ path: "/h/shots/s13-gallery.png" });
  await menuOn(gallery);
  ok("P19 detach off in the menu", await menuRow("detach"));
  await closeMenu();
  const noRows = await p.evaluate(() => Object.values(window.kit.contract).filter((b) => Object.keys(b.sample).length && !Object.values(b.sample).some((v) => Array.isArray(v) && v.length)).map((b) => b.id));
  ok("P19 gallery-grid is the only sample with no rows", noRows.join() === "gallery-grid", noRows);

  // ------------------------------------------------------------------ P12
  await open(); await sel("hero");
  await p.click(field("imageUrl"));
  await p.keyboard.type("javascript:alert(1)"); await p.waitForTimeout(30);
  ok("P12 script address not stored", ((await prop("hero", "imageUrl")) ?? "") === "", await prop("hero", "imageUrl"));
  ok("P12 field keeps what was typed", (await p.inputValue(field("imageUrl"))) === "javascript:alert(1)");
  await blur("imageUrl");
  ok("P12 blur says why", (await hint()).includes("picture address"), await hint());
  ok("P12 blur shows what is stored", (await p.inputValue(field("imageUrl"))) === "");
  await p.fill(field("imageUrl"), "/api/media/x/Private/a.jpg"); await p.waitForTimeout(30);
  ok("P12 private picture not stored", ((await prop("hero", "imageUrl")) ?? "") === "", await prop("hero", "imageUrl"));
  await blur("imageUrl");
  ok("P12 blur says it is private", (await hint()).includes("private"), await hint());
  await p.fill(field("imageUrl"), "/pic.png"); await p.waitForTimeout(40);
  ok("P12 a public picture is stored", (await prop("hero", "imageUrl")) === "/pic.png", await prop("hero", "imageUrl"));
  await blur("imageUrl");
  await p.fill(field("imageUrl"), "javascript:alert(1)"); await p.waitForTimeout(30);
  ok("P12 a refusal leaves the stored picture", (await prop("hero", "imageUrl")) === "/pic.png");
  await rowFor("Picture wall").locator(".de-layer").click(); await p.waitForTimeout(50);
  ok("P12 the note survives the click that left the field", (await hint()).includes("picture address"), await hint());
  await sel("hero");
  ok("P12 stored picture shown on return", (await p.inputValue(field("imageUrl"))) === "/pic.png");
  const button = await add("hero", "link-button");
  await p.fill(field("href"), "javascript:x"); await p.waitForTimeout(30);
  ok("P12 script link not stored", !(await prop(button, "href")), await prop(button, "href"));
  await p.fill(field("href"), "#top"); await p.waitForTimeout(30);
  ok("P12 anchor stored", (await prop(button, "href")) === "#top", await prop(button, "href"));

  // ------------------------------------------------------------------ P13
  await open();
  const feed13 = await add("hero", "thread-feed");
  await sel("hero");
  await p.click('.de-vpanel [data-tab="code"]'); await p.waitForTimeout(40);
  ok("P13 hero: tree above", (await p.$$(".de-vpanel .de-layers")).length === 1 && (await p.locator(".de-vpanel .de-layers").boundingBox()).y < (await p.locator(".de-sheet-json").boundingBox()).y);
  ok("P13 hero: tag line", (await p.textContent(".de-sheet-tag")).includes("<hero-banner>"), await p.textContent(".de-sheet-tag"));
  ok('P13 hero: JSON holds "title"', (await p.textContent(".de-sheet-json")).includes('"title"'));
  ok("P13 hero: JSON has no id", !(await p.textContent(".de-sheet-json")).includes('"id"'));
  ok("P13 hero: read-only", (await p.$$(".de-vpanel .de-sheet textarea, .de-vpanel .de-code textarea")).length === 0);
  await p.screenshot({ path: "/h/shots/s13-code.png" });
  await sel(feed13);
  ok("P13 feed: no sample rows", !(await p.textContent(".de-sheet-json")).includes("Morning Sadhana") && !(await p.textContent(".de-vpanel")).includes("Morning Sadhana"));
  await sel("box1");
  ok("P13 box: the editable sheet", (await p.$$(".de-vpanel textarea.de-sheet-css")).length === 1 && (await p.$$(".de-sheet-json")).length === 0);
  await p.click('.de-vpanel [data-tab="props"]'); await p.waitForTimeout(30);

  // ------------------------------------------------------------------ P14
  await open(); await sel("box1");
  const boxSecs = await sections();
  ok("P14 box has no content or behaviour", !boxSecs.includes("content") && !boxSecs.includes("behaviour") && boxSecs.includes("appearance"), boxSecs);
  await p.fill('.de-vpanel [data-f="fill"]', "#112233"); await p.waitForTimeout(50);
  ok("P14 fill still writes look", (await prop("box1", "look"))?.fill === "#112233", await prop("box1", "look"));
  ok("P14 no prop written", (await prop("box1", "p:fill")) === undefined && (await prop("box1", "fill")) === undefined);

  // ------------------------------------------------------------------ P15
  await open(); await sel("hero");
  await p.fill(field("title"), "Kept across a remount"); await p.waitForTimeout(30);
  await sel("wall");
  await choose("gap", "tight");
  await p.click('.de-vpanel [data-f="pop-p-captionColor"]'); await p.click('[data-f="ctab-custom"]'); await p.fill('[data-f="chex"]', "#335577"); await p.waitForTimeout(40);
  await p.click('[data-f="popclose"]'); await p.waitForTimeout(30);
  await sel("faq");
  await choose("look", "plain");
  await p.click("[data-a=save]"); await p.waitForTimeout(80);
  const lastSaved = await p.evaluate(() => window.saved[window.saved.length - 1]);
  ok("P15 saved holds the settings", nodeIn(lastSaved, "hero")?.props.title === "Kept across a remount" && nodeIn(lastSaved, "faq")?.props.look === "plain");
  await p.evaluate(() => window.remount()); await p.waitForSelector(".de-vpanel .de-tabs"); await p.waitForTimeout(120);
  ok("P15 hero title", (await p.textContent(".blk-hero-title")) === "Kept across a remount");
  ok("P15 wall gap", (await p.$eval(".blk-wall", (e) => e.dataset.gap)) === "tight");
  ok("P15 caption colour", (await p.$eval(".blk-wall-caption", (e) => getComputedStyle(e).color)) === "rgb(51, 85, 119)");
  ok("P15 faq look", (await p.$eval(".blk-faq", (e) => e.dataset.look)) === "plain");
  await sel("wall");
  ok("P15 the row shows it", (await p.inputValue(field("captionColor"))).toLowerCase() === "#335577");

  // ------------------------------------------------------------------ P16
  await open("#classifieds", "tree.html");
  ok("P16 classifieds has no content section at rest", (await p.$$('.de-vpanel [data-section="content"]')).length === 0);
  await pick("Column “Vol."); await pick("Row “Vol.");
  const rowSecs = await sections();
  // Measured on the bundle built before this stone's edits.
  ok("P16 a Row's sections are as before", rowSecs.join() === "size,layout,link,text,appearance,effects", rowSecs);
  ok("P17 no placeholder on a host with no contract", !(await p.$$eval(".de-vpanel select option", (e) => e.some((o) => o.textContent === "Choose…"))));
};
