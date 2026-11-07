// B1 to B7 of the stone 2 plan: references, layers, where a look is written, the panel, the tree, Tweaks, tools on a part.
module.exports = async ({ p, ok, h, open }) => {
  const TITLE = "#host .blk-hero-title", SUB = "#host .blk-hero-sub", CAP = "#host .blk-wall-caption";
  const field = (f) => `.de-vpanel [data-f="${f}"]`;

  // ------------------------------------------------------------------ B1
  await h.sel("hero~p:title");
  ok("B1 a part ref selects", (await h.head()) === "Title");
  await h.row("Subtitle").locator(".de-layer").click(); await h.pause(40);
  ok("B1 a part's row keeps its ref", (await h.head()) === "Subtitle" && (await p.$eval(".de-layers li.on", (e) => e.dataset.row)) === "hero~p:subtitle", await p.$eval(".de-layers li.on", (e) => e.dataset.row));
  // A prop emptied: the part stops drawing, the selection goes to its node, not to nothing.
  await p.click(field("p-subtitle")); await p.fill(field("p-subtitle"), ""); await h.pause(60);
  ok("B1 the part has stopped drawing", (await p.$$(SUB)).length === 0);
  ok("B1 selection falls back to its node", (await h.head()) === "Hero banner", await h.head());
  ok("B1 focus and the field are still there", await p.$eval(field("p-subtitle"), (e) => document.activeElement === e && e.value === ""));
  ok("B1 no row for a part not drawn", !(await h.rows()).some((r) => r.startsWith("Subtitle")), await h.rows());
  await p.keyboard.type("Back again"); await h.pause(60);
  ok("B1 its row comes back with it", (await h.rows()).some((r) => r.startsWith("Subtitle")), await h.rows());
  await p.$eval(field("p-subtitle"), (e) => e.blur());
  // An instance past the end, after an undo took a paragraph away: the part's first one, not nothing.
  await h.sel("prose1");
  await p.fill(field("p-body"), "One\n\nTwo"); await h.pause(50); await p.$eval(field("p-body"), (e) => e.blur());
  await h.sel("prose1~p:paragraph:1");
  ok("B1 the second paragraph is selected", (await h.head()) === "Paragraphs" && (await p.$$('#host [data-tree-node="prose1"] p')).length === 2, await h.head());
  await h.undo();
  ok("B1 gone: the part's first instance", (await p.$eval(".de-layers li.on", (e) => e.dataset.row)) === "prose1~p:paragraph" && (await h.head()) === "Paragraphs", await h.head());

  // ------------------------------------------------------------------ B2
  await open();
  await h.click(TITLE); await h.click(TITLE); await h.click(TITLE);
  ok("B2 three clicks reach Title", (await h.head()) === "Title");
  await p.keyboard.press("Escape"); await h.pause(30);
  ok("B2 Esc walks out: Words", (await h.head()) === "Words");
  await p.keyboard.press("Enter"); await h.pause(30);
  ok("B2 Enter goes in: Title", (await h.head()) === "Title", await h.head());
  await p.keyboard.press("Escape"); await p.keyboard.press("Escape"); await h.pause(30);
  ok("B2 Esc again: Hero banner", (await h.head()) === "Hero banner");
  await p.keyboard.press("Escape"); await h.pause(30);
  ok("B2 Esc again: the page", (await h.head()) === "Page", await h.head());
  await h.sel(null);
  const hov = await p.locator(TITLE).boundingBox(); await p.mouse.move(hov.x + hov.width / 2, hov.y + hov.height / 2); await h.pause(40);
  ok("B2 hover outlines what a click would select", (await p.$eval(".de-layer-sheet .de-box.hov .de-tag", (e) => e.textContent)) === "Hero banner", await p.$eval(".de-layer-sheet .de-box.hov .de-tag", (e) => e.textContent).catch(() => null));
  // Alt+click goes straight to the deepest part.
  await open();
  await p.keyboard.down("Alt"); await h.click(TITLE); await p.keyboard.up("Alt"); await h.pause(30);
  ok("B2 Alt+click: the deepest part", (await h.head()) === "Title", await h.head());
  // The Layers list in the menu names the parts.
  await h.right(TITLE);
  await p.click('.de-menu [data-open="layers"]'); await h.pause(30);
  const layerRows = await p.$$eval('.de-menu [data-sub="layers"] button', (e) => e.map((x) => x.innerText.replace(/\s+/g, " ").trim()));
  ok("B2 the menu's Layers lists them", layerRows.length === 3 && layerRows[0].includes("Hero banner") && layerRows[1].includes("Words") && layerRows[2].includes("Title"), layerRows);
  await h.closeMenu();
  // A sealed block holding others: the nodes first, as before, then the innermost node's parts.
  await open();
  const PARA = '#host [data-tree-node="prose1"] p';
  await h.click(PARA);
  ok("B2 first click: the grid", (await h.head()) === "Grid", await h.head());
  await h.click(PARA);
  ok("B2 second click: the Text block in it", (await h.head()) === "Text", await h.head());
  await h.click(PARA);
  ok("B2 third click: its paragraph", (await h.head()) === "Paragraphs", await h.head());
  await p.keyboard.press("Escape"); await h.pause(30);
  ok("B2 Esc: the Text block", (await h.head()) === "Text", await h.head());

  // ------------------------------------------------------------------ B3
  await open();
  await h.sel("hero~p:title");
  await p.fill(field("size"), "50"); await h.pause(50); await p.$eval(field("size"), (e) => e.blur());
  ok("B3 a part writes morph.parts", (await h.morph("hero")).parts.title.size === 50, await h.morph("hero"));
  ok("B3 no look on the node", (await h.node("hero")).props.look === undefined);
  await h.sel("hero");
  await p.fill(field("opacity"), "0.5"); await h.pause(50); await p.$eval(field("opacity"), (e) => e.blur());
  ok("B3 a sealed node writes morph.parts.root", (await h.morph("hero")).parts.root?.opacity === 0.5, await h.morph("hero"));
  ok("B3 the root part draws", (await h.css("#host .blk-hero", "opacity")) === "0.5");
  ok("B3 still no look on the node", (await h.node("hero")).props.look === undefined);
  await h.sel("faq");
  await p.fill(field("opacity"), "0.75"); await h.pause(50); await p.$eval(field("opacity"), (e) => e.blur());
  ok("B3 faq's look setting is untouched", (await h.node("faq")).props.look === "divided" && (await h.morph("faq")).parts.root.opacity === 0.75, await h.node("faq"));
  await h.sel("box1");
  await p.fill(field("opacity"), "0.9"); await h.pause(50); await p.$eval(field("opacity"), (e) => e.blur());
  ok("B3 an own node still writes look", (await h.node("box1")).props.look.opacity === 0.9 && (await h.node("box1")).props.morph === undefined);
  // The thin bar on a part.
  await h.sel("hero~p:title");
  const bar = (m) => `.de-mb [data-mb="${m}"]`;
  await p.click(bar("color")); await h.pause(40);
  await p.click('.de-mb [data-mb-tab="custom"]'); await h.pause(40);
  await p.fill(".de-mb [data-mb-hex]", "#334455"); await h.pause(60);
  ok("B3 the bar's colour writes the part", (await h.morph("hero")).parts.title.color === "#334455", await h.morph("hero"));
  await p.mouse.click(10, 500); await h.sel("hero~p:title");
  await p.click(bar("style")); await h.pause(40);
  await p.click('.de-mb [data-mb-tab="custom"]'); await h.pause(40);
  await p.fill('.de-mb [data-mb-c="size"]', "33"); await h.pause(60);
  ok("B3 the bar's size writes the part", (await h.morph("hero")).parts.title.size === 33, await h.morph("hero"));
  await p.$eval('.de-mb [data-mb-c="size"]', (e) => e.blur()); await p.mouse.click(10, 500); await h.sel("hero~p:title");
  const alignBefore = await h.css(TITLE, "textAlign");
  await p.click(bar("align")); await h.pause(60);
  ok("B3 the bar's align writes the part", !!(await h.morph("hero")).parts.title.align && (await h.css(TITLE, "textAlign")) !== alignBefore, [await h.morph("hero"), alignBefore]);
  // The menu: hide, copy, paste, reset. Copy from the title, paste on the subtitle and on the blue box.
  await h.right(TITLE); await p.click('.de-menu [data-mi="copy-style"]'); await h.pause(40);
  await h.sel("hero~p:subtitle");
  await h.right(SUB); await p.click('.de-menu [data-mi="paste-style"]'); await h.pause(40);
  ok("B3 paste on a part", (await h.morph("hero")).parts.subtitle?.color === "#334455", await h.morph("hero"));
  await h.sel("box1");
  await h.right('#host [data-tree-node="box1"]'); await p.click('.de-menu [data-mi="paste-style"]'); await h.pause(40);
  ok("B3 paste on an own box writes its look", (await h.node("box1")).props.look.color === "#334455", (await h.node("box1")).props.look);
  await h.sel("head");
  await h.right('#host [data-tree-node="head"]'); await p.click('.de-menu [data-mi="paste-style"]'); await h.pause(40);
  ok("B3 paste on a sealed node writes its root part", (await h.morph("head")).parts.root.color === "#334455", await h.morph("head"));
  await h.sel("hero~p:subtitle");
  await h.right(SUB); await p.click('.de-menu [data-mi="hide"]'); await h.pause(40);
  ok("B3 menu's Hide on a part", (await h.morph("hero")).parts.subtitle.hide === true);
  await h.right(SUB);
  ok("B3 it now says Show", (await p.textContent('.de-menu [data-mi="hide"]')).trim().startsWith("Show"));
  await p.click('.de-menu [data-mi="reset"]'); await h.pause(40);
  ok("B3 Reset style on a part clears that part only", (await h.morph("hero")).parts.subtitle === undefined && !!(await h.morph("hero")).parts.title, await h.morph("hero"));
  // Reset style on a sealed node clears all of its morph.
  await h.sel("hero");
  await h.right("#host .blk-hero");
  ok("B7 Hide is not offered on a block's root", await h.menuOff("hide"));
  ok("B7 Reset style live on a block with a morph", !(await h.menuOff("reset")));
  await p.click('.de-menu [data-mi="reset"]'); await h.pause(50);
  ok("B7 Reset style clears its morph", (await h.morph("hero")) === undefined);
  await h.right("#host .blk-hero");
  ok("B7 and stays grey with none", (await h.menuOff("reset")) && (await h.menuOff("copy-style")));
  await h.closeMenu();

  // ------------------------------------------------------------------ B4
  await open();
  await h.sel("hero~p:title");
  ok("B4 heading and sub", (await h.head()) === "Title" && (await h.sub()) === "Hero banner");
  ok("B4 its prop's field first, in Content", (await h.labels("content")).join() === "Title" && (await h.sections())[0] === "content", await h.labels("content"));
  await p.fill(field("p-title"), "Typed on the part"); await h.pause(50);
  ok("B4 the field writes the prop", (await h.node("hero")).props.title === "Typed on the part" && (await p.textContent(TITLE)) === "Typed on the part");
  ok("B4 the selection holds while typing", (await p.$eval(".de-layers li.on", (e) => e.dataset.row)) === "hero~p:title");
  await p.$eval(field("p-title"), (e) => e.blur());
  await h.undo();
  ok("B4 undo takes the typing back", (await p.textContent(TITLE)) === "The Ambrosial Hours");
  // A part with no prop has no Content section.
  await h.sel("hero~p:copy");
  ok("B4 a part with no prop: no Content", !(await h.sections()).includes("content"), await h.sections());
  ok("B4 a container offers Layout", (await h.labels("layout")).includes("Layout"), await h.labels("layout"));
  ok("B4 its Text stays behind the +", !(await h.labels("text")).length && (await p.$$(field("more-text"))).length === 1, await h.labels("text"));
  // Contrast reads the real ground.
  await h.sel("hero~p:title");
  ok("B4 the contrast line shows", (await p.$$(".de-vpanel .de-contrast")).length === 1);
  // Code tab on a part.
  await p.click('.de-vpanel [data-tab="code"]'); await h.pause(50);
  ok("B4 Code: the sheet, tag and words", (await p.textContent(".de-sheet-tag")).includes("<h1>") && (await p.textContent(".de-sheet-tag")).includes("The Ambrosial Hours"), await p.textContent(".de-sheet-tag"));
  await p.fill(".de-sheet-css", "color: #ff0000; position: fixed; z-index: 9;"); await h.pause(400);
  ok("B4 Code: a kept declaration draws", (await h.css(TITLE, "color")) === "rgb(255, 0, 0)", await h.css(TITLE, "color"));
  ok("B4 Code: what a part may not hold is not stored", !JSON.stringify(await h.morph("hero")).includes("position") && !JSON.stringify(await h.morph("hero")).includes("z-index"), await h.morph("hero"));
  ok("B4 Code: and says so", (await p.textContent('.de-vpanel [data-sync="dropped"]')).includes("position"), await p.textContent('.de-vpanel [data-sync="dropped"]'));
  await p.fill(".de-sheet-css", ""); await h.pause(400);
  ok("B4 Code: emptied, nothing stored", (await h.morph("hero")) === undefined, await h.morph("hero"));
  await h.sel("prose1~p:paragraph");
  const inherited = await p.$$eval(".de-from-row .p", (e) => e.map((x) => x.textContent));
  ok("B4 Code: From rows on a paragraph", inherited.includes("color") && inherited.includes("line-height"), inherited);
  ok("B4 Code: a colour reads as hex with its swatch", await p.$eval('.de-from-row:has([data-adopt-prop="color"]) .v', (e) => /^#[0-9a-f]{6}$/.test(e.textContent.trim()) && !!e.querySelector(".de-sw")), await p.$eval('.de-from-row:has([data-adopt-prop="color"]) .v', (e) => e.textContent));
  await h.shot("b4-code");
  await p.click('.de-from-row [data-adopt-prop="color"]'); await h.pause(60);
  ok("B4 Code: + sets it on this part", (await h.morph("prose1")).parts.paragraph.css.includes("color"), await h.morph("prose1"));
  await p.fill(".de-sheet-css", ""); await h.pause(400);
  ok("B4 Code: emptied again", (await h.morph("prose1")) === undefined, await h.morph("prose1"));
  await p.click('.de-vpanel [data-tab="props"]'); await h.pause(40);
  // Foot of the node's panel.
  await h.sel("hero");
  ok("B4 foot: none changed", (await p.textContent(field("parts-changed"))) === "0 of 6 parts changed on this page.", await p.textContent(field("parts-changed")));
  ok("B4 foot: no warning with no morph", (await p.$$(field("detach-looks"))).length === 0);
  await h.sel("hero~p:title"); await h.hex("color", "#223344");
  await h.sel("hero~p:subtitle"); await h.hex("color", "#223344");
  await h.sel("hero");
  ok("B4 foot: counts them", (await p.textContent(field("parts-changed"))) === "2 of 6 parts changed on this page.", await p.textContent(field("parts-changed")));
  ok("B7 Detach says its looks do not come", (await p.textContent(field("detach-looks"))).includes("do not come with it"));
  await p.locator(field("detach-block")).scrollIntoViewIfNeeded(); await h.pause(40);
  await h.shot("b4-foot");
  await p.click('.de-vpanel [data-tab="code"]'); await h.pause(40);
  ok("B4 the node's Code tab keeps the read-only JSON", (await p.$$(".de-vpanel .de-sheet-json")).length === 1 && (await p.$$(".de-vpanel .de-sheet textarea")).length === 0);
  await p.click('.de-vpanel [data-tab="props"]'); await h.pause(40);
  await p.click(field("detach-block")); await h.pause(100);
  ok("B7 after Detach the top bar says it too", /did not come with it/.test(await p.textContent(".de-editbar-hint")), await p.textContent(".de-editbar-hint"));
  await h.undo();
  ok("B7 Undo brings the block and its looks back", (await p.$$('#host [data-tree-node="hero"]')).length === 1 && (await h.morph("hero")).parts.title.color === "#223344");

  // ------------------------------------------------------------------ B5
  await open();
  const start = await h.rows();
  ok("B5 a sealed row starts closed", !start.some((r) => r.startsWith("Title") || r.startsWith("Caption")) && start.some((r) => r.startsWith("Hero banner")), start);
  ok("B5 own rows open as before", start.some((r) => r.startsWith("Heading") || r.startsWith("Section")), start);
  await h.sel("wall");
  const wallRows = await h.rows();
  ok("B5 selecting opens it", wallRows.some((r) => r.startsWith("Picture and caption")), wallRows);
  ok('B5 a repeated part is one row with "×6"', wallRows.filter((r) => r.startsWith("Picture and caption")).length === 1 && wallRows.some((r) => r === "Picture and caption ×6"), wallRows);
  ok("B5 a part's row can hide", await h.row("Caption").locator(".de-eye").count() === 1);
  const third = p.locator(CAP).nth(2);
  await third.scrollIntoViewIfNeeded(); await h.pause(60);
  const tb = await third.boundingBox();
  await p.mouse.click(tb.x + tb.width / 2, tb.y + tb.height / 2); await h.pause(60);
  await p.mouse.click(tb.x + tb.width / 2, tb.y + tb.height / 2); await h.pause(60);
  await p.mouse.click(tb.x + tb.width / 2, tb.y + tb.height / 2); await h.pause(60);
  ok("B5 another instance: same row", (await p.$eval(".de-layers li.on .de-layer b", (e) => e.textContent)) === "Caption" && (await p.$$(".de-layers li.on")).length === 1);
  await h.hex("color", "#aa2233");
  const outlined = await p.evaluate(() => { const b = document.querySelector(".de-layer-sheet .de-box:not(.kid):not(.hov)").getBoundingClientRect(); return [...document.querySelectorAll("#host .blk-wall-caption")].findIndex((c) => { const r = c.getBoundingClientRect(); return Math.abs(r.left - b.left) < 3 && Math.abs(r.top - b.top) < 3; }); });
  ok("B5 the clicked instance is still the one outlined", outlined === 2, outlined);
  await h.shot("b5-wall");
  // Kinds, by icon: T for words, a picture for media, a frame otherwise.
  await h.sel("hero~p:title");
  const icon = (name) => h.row(name).locator(".de-kind").innerHTML();
  ok("B5 words and frames have different icons", (await icon("Title")) !== (await icon("Words")));
  await h.sel("wall~p:image");
  ok("B5 media has its own icon", (await icon("Picture")) !== (await icon("Caption")));
  await h.sel("head");
  ok("B5 first words in quotes", (await h.rows()).some((r) => r.startsWith("Heading “Recent work”")), await h.rows());

  // ------------------------------------------------------------------ B6
  await open();
  await h.sel("box1");
  ok("B6 no Tweaks on an own box", (await p.$$('.de-vpanel [data-tab="tweaks"]')).length === 0);
  await h.sel("ptb");
  ok("B6 no Tweaks on a block with no tokens", (await p.$$('.de-vpanel [data-tab="tweaks"]')).length === 0);
  await h.sel("hero~p:title");
  ok("B6 Tweaks on a part", (await p.$$('.de-vpanel [data-tab="tweaks"]')).length === 1);
  await p.click('.de-vpanel [data-tab="tweaks"]'); await h.pause(40);
  await h.sel("box1");
  ok("B6 a tab no longer offered falls back to Properties", await p.$eval('.de-vpanel [data-tab="props"]', (e) => e.getAttribute("aria-selected") === "true") && (await h.head()) !== null, await h.head());
  await h.sel("hero");
  await p.click('.de-vpanel [data-tab="tweaks"]'); await h.pause(40);
  const undoBefore = await p.$eval("[data-a=undo]", (e) => e.disabled);
  await p.fill(field("t-blk-accent"), "#112233"); await h.pause(20);
  await p.fill(field("t-blk-accent"), "#223344"); await h.pause(20);
  await p.fill(field("t-blk-accent"), "#334455"); await h.pause(60);
  ok("B6 token stored", (await h.morph("hero")).tokens["--blk-accent"] === "#334455", await h.morph("hero"));
  ok("B6 the swatch follows what is typed", (await p.$eval(`${field("pop-t-blk-accent")} .de-sw`, (e) => e.style.getPropertyValue("--sw"))) === "#334455", await p.$eval(`${field("pop-t-blk-accent")} .de-sw`, (e) => e.style.getPropertyValue("--sw")));
  ok("B6 a run of edits is one undo step", undoBefore === true);
  await h.undo();
  ok("B6 Undo takes the field back at once", (await h.morph("hero")) === undefined, await h.morph("hero"));
  ok("B6 and the field shows it", (await p.inputValue(field("t-blk-accent"))).toLowerCase() !== "#334455", await p.inputValue(field("t-blk-accent")));
  await p.fill(field("t-blk-accent"), "#334455"); await h.pause(60);
  ok("B6 a reset arrow on a set token", (await p.$$(field("reset-t-blk-accent"))).length === 1);
  ok("B6 the derived ink moves with the accent", (await p.$eval("#host .blk-hero", (e) => getComputedStyle(e).getPropertyValue("--blk-accent-ink"))).includes("color-mix"));
  await p.click(field("reset-t-blk-accent")); await h.pause(60);
  ok("B6 reset removes it", (await h.morph("hero")) === undefined);
  await p.click(field("pop-t-blk-font-title")); await h.pause(50);
  await p.fill('.de-vpanel [data-fontq]', "Oswald"); await h.pause(40);
  await p.click('.de-vpanel .de-fontitem[data-font="Oswald"]'); await h.pause(70);
  ok("B6 a font token stores the family's name", (await h.morph("hero")).tokens["--blk-font-title"] === "Oswald", await h.morph("hero"));
  ok("B6 and the title draws in it", (await h.css(TITLE, "fontFamily")).includes("Oswald"), await h.css(TITLE, "fontFamily"));
  await p.fill(field("t-blk-radius"), "14"); await h.pause(60);
  ok("B6 a length token stores px", (await h.morph("hero")).tokens["--blk-radius"] === "14px", await h.morph("hero"));
  await p.$eval(field("t-blk-radius"), (e) => e.blur());
  await p.click(field("pop-t-blk-band")); await h.pause(50);
  ok("B6 the colour popover opens on a token", (await p.$$(".de-vpanel .de-colorpop")).length === 1);
  await h.shot("b6-pop");
  await p.keyboard.press("Escape"); await h.pause(30);
  await p.click('.de-vpanel [data-tab="props"]'); await h.pause(30);

  // ------------------------------------------------------------------ B7
  await open();
  await h.sel("hero~p:title");
  const count = async () => (await h.doc()).content.length;
  const n0 = await count();
  await p.mouse.click(5, 940); await h.sel("hero~p:title"); await p.evaluate(() => document.activeElement?.blur?.());
  for (const k of ["Delete", "Backspace", "[", "]", "Control+d", "Control+g"]) { await p.keyboard.press(k); await h.pause(30); }
  ok("B7 keys do nothing on a part", (await count()) === n0 && (await h.doc()).content[0].props.id === "hero" && (await h.head()) === "Title", [await count(), await h.head()]);
  // No drag and no handles on a part.
  ok("B7 no resize handles on a part", (await p.$$(".de-layer-sheet .de-handle")).length === 0);
  const tt = await p.locator(TITLE).boundingBox();
  await p.mouse.move(tt.x + 50, tt.y + 20); await p.mouse.down(); await p.mouse.move(tt.x + 90, tt.y + 80, { steps: 5 }); await h.pause(40);
  ok("B7 a pull on a part starts no drag", (await p.$$(".de-ghostbox, .de-insert, .de-dragsource")).length === 0, await p.$$eval(".de-ghostbox, .de-insert, .de-dragsource", (e) => e.map((x) => x.className)));
  await p.mouse.up(); await h.pause(60);
  ok("B7 the tree is unchanged", (await h.doc()).content[0].props.id === "hero" && (await count()) === n0 && (await h.head()) === "Title");
  // Thin bar modes.
  const dis = (m) => p.$eval(`.de-mb [data-mb="${m}"]`, (e) => e.disabled);
  ok("B7 words: text mode with B, I, U, link, list off", (await dis("b")) && (await dis("i")) && (await dis("u")) && (await dis("link")) && (await dis("list")) && !(await dis("color")) && !(await dis("align")));
  await h.sel("hero~p:copy");
  ok("B7 a container: box mode", (await p.$$('.de-mb [data-mb="b"]')).length === 0 && (await p.$$('.de-mb [data-mb="color"]')).length === 1);
  await p.click('.de-mb [data-mb="color"]'); await p.click('.de-mb [data-mb-tab="custom"]'); await p.fill(".de-mb [data-mb-hex]", "#556677"); await h.pause(60);
  ok("B7 box mode's colour is its fill", (await h.morph("hero")).parts.copy.fill === "#556677", await h.morph("hero"));
  await p.mouse.click(5, 940);
  await h.sel("wall~p:image");
  ok("B7 media: plain", (await p.$$('.de-mb [data-mb="color"]')).length === 0 && (await p.$$('.de-mb [data-mb="more"]')).length === 1);
  // The bar's More opens the same menu.
  await p.click('.de-mb [data-mb="more"]'); await p.waitForSelector(".de-menu"); await h.pause(30);
  ok("B7 More: the same grey rows", (await h.menuOff("delete")) && (await h.menuOff("dup")));
  await h.closeMenu();
  // Add from a part's menu goes after its block.
  await h.sel("hero~p:title");
  await h.right(TITLE);
  await p.click('.de-menu [data-open="add"]'); await p.click('.de-menu [data-sub="add"] [data-mi="add:box"]'); await h.pause(80);
  const added = (await h.doc()).content;
  ok("B7 Add on a part: after its block", added[1].type === "box" && added[0].props.id === "hero", added.slice(0, 2).map((n) => n.type));

  // ------------------------------------------------------------------ B9: what the document holds
  await open();
  await h.sel("hero~p:title"); await h.hex("color", "#aa2233");
  await h.sel("hero~p:subtitle"); await p.fill(field("size"), "20"); await h.pause(40); await p.$eval(field("size"), (e) => e.blur());
  await h.sel("hero"); await p.click('.de-vpanel [data-tab="tweaks"]'); await p.fill(field("t-blk-band"), "#123456"); await h.pause(60); await p.click('.de-vpanel [data-tab="props"]');
  const m = await h.morph("hero");
  ok("B9 morph holds parts and tokens only", Object.keys(m).sort().join() === "parts,tokens,v" && m.v === 1, Object.keys(m));
  ok("B9 part names only, no selector", Object.keys(m.parts).every((n) => /^[a-z][a-zA-Z0-9]*$/.test(n)) && !/[.>#]blk|blk-hero/.test(JSON.stringify(m)), m);
  ok("B9 no look on a sealed node", (await h.doc()).content.filter((n) => !["box", "words", "picture"].includes(n.type)).every((n) => n.type === "faq" || n.props.look === undefined));
  await h.sel("hero~p:title"); await p.click(field("reset-color")); await h.pause(40);
  await h.sel("hero~p:subtitle"); await p.click(field("reset-size")); await h.pause(40);
  await h.sel("hero"); await p.click('.de-vpanel [data-tab="tweaks"]'); await p.click(field("reset-t-blk-band")); await h.pause(50); await p.click('.de-vpanel [data-tab="props"]');
  ok("B9 reset everything: the morph key is gone", !("morph" in (await h.node("hero")).props), (await h.node("hero")).props);

  // Selection holds across a redraw that replaces the element.
  await open();
  await h.sel("head");
  await p.focus(field("p-level")); await p.selectOption(field("p-level"), '"h3"'); await h.pause(50);
  await h.sel("head~p:title");
  const tag0 = await p.$eval("#host .blk-heading-title", (e) => e.tagName);
  await p.evaluate(() => { document.querySelector("#host .blk-heading-title").dataset.old = "1"; });
  await h.undo();
  ok("B9 the element was replaced", (await p.$eval("#host .blk-heading-title", (e) => e.tagName)) !== tag0, tag0);
  ok("B9 selection holds across it", (await h.head()) === "Heading" && (await p.$eval(".de-layers li.on", (e) => e.dataset.row)) === "head~p:title");
  ok("B9 the outline is on the new element", await p.evaluate(() => { const b = document.querySelector(".de-layer-sheet .de-box:not(.kid)").getBoundingClientRect(), r = document.querySelector("#host .blk-heading-title").getBoundingClientRect(); return Math.abs(b.top - r.top) < 3 && Math.abs(b.height - r.height) < 3; }));

  // A client block's state survives the first look.
  await open();
  await h.sel("faq");
  const openNow = () => p.$$eval("#host .blk-faq details", (e) => e.map((x) => x.open).join());
  // Another row opened in the browser, which a remount would forget, then the first look.
  await p.evaluate(() => { const q = document.querySelector("#host .blk-faq"); q.dataset.kept = "same element"; q.querySelectorAll("details")[1].open = true; });
  await h.pause(40);
  const state0 = await openNow();
  ok("B9 the row is open before the look", state0 === "true,true,false", state0);
  await p.fill(field("opacity"), "0.8"); await h.pause(60); await p.$eval(field("opacity"), (e) => e.blur());
  ok("B9 the block was not remounted by its first look", (await p.$eval("#host .blk-faq", (e) => e.dataset.kept)) === "same element");
  ok("B9 its open row is still open", (await openNow()) === state0, [state0, await openNow()]);

  // Undo and Redo through a part edit, a hide and a token, in order.
  await open();
  await h.sel("hero~p:title"); await h.hex("color", "#aa2233"); await h.pause(900);
  await h.row("Subtitle").locator(".de-eye").click(); await h.pause(900);
  await h.sel("hero"); await p.click('.de-vpanel [data-tab="tweaks"]'); await p.fill(field("t-blk-band"), "#123456"); await h.pause(60); await p.$eval(field("t-blk-band"), (e) => e.blur()); await p.click('.de-vpanel [data-tab="props"]');
  const state = async () => { const x = await h.morph("hero"); return [!!x?.parts?.title, !!x?.parts?.subtitle, !!x?.tokens].join(); };
  ok("U all three set", (await state()) === "true,true,true", await state());
  await h.undo(); ok("U undo: the token", (await state()) === "true,true,false", await state());
  await h.undo(); ok("U undo: the hide", (await state()) === "true,false,false", await state());
  await h.undo(); ok("U undo: the part edit", (await state()) === "false,false,false" && (await h.morph("hero")) === undefined, await state());
  await h.redo(); ok("U redo: the part edit", (await state()) === "true,false,false", await state());
  await h.redo(); ok("U redo: the hide", (await state()) === "true,true,false", await state());
  await h.redo(); ok("U redo: the token", (await state()) === "true,true,true", await state());
};
