// The hand test of plan section 8, one group per step, with what a person would see checked against the page and the document.
module.exports = async ({ p, ok, h, open }) => {
  const TITLE = "#host .blk-hero-title", SUB = "#host .blk-hero-sub", CAP = "#host .blk-wall-caption";

  // ------------------------------------------------------------------ step 1
  await h.click(TITLE);
  ok("1 a click selects Hero banner", (await h.head()) === "Hero banner", await h.head());
  ok("1 its settings first", (await h.sections())[0] === "content" && (await h.labels("content")).join() === "Title,Subtitle,Background image,Image description", await h.labels("content"));
  const heroLayout = await h.labels("layout");
  ok("1 then a box's rows", heroLayout.slice(0, 2).join() === "Text position,Height" && heroLayout.includes("Padding"), heroLayout);
  ok("1 Fill below", (await h.labels("appearance")).includes("Fill"), await h.labels("appearance"));
  ok("1 boxes inside show faintly", (await p.$$(".de-layer-sheet .de-box.kid")).length >= 2, (await p.$$(".de-layer-sheet .de-box.kid")).length);
  await h.shot("1-hero");

  // ------------------------------------------------------------------ step 2
  await h.click(TITLE);
  ok("2 second click: Words", (await h.head()) === "Words", await h.head());
  await h.click(TITLE);
  ok("2 third click: Title", (await h.head()) === "Title", await h.head());
  ok("2 under it the block", (await h.sub()) === "Hero banner", await h.sub());
  const secs = await h.sections();
  ok("2 Size, Layout, Text, Appearance", ["size", "layout", "text", "appearance"].every((s) => secs.includes(s)), secs);
  ok("2 no Link and no Kind", !secs.includes("link") && !(await p.$$('.de-vpanel [data-f="tag"]')).length);
  const rows = await h.rows();
  const at = rows.findIndex((r) => r.startsWith("Hero banner"));
  ok("2 the tree shows Hero banner, Words, Title, Subtitle", at >= 0 && rows.slice(at, at + 5).map((r) => r.split(" ")[0]).join() === "Hero,Wash,Words,Title,Subtitle", rows.slice(at, at + 6));
  ok("2 the row is selected", (await p.$eval(".de-layers li.on .de-layer b", (e) => e.textContent)) === "Title");
  await h.shot("2-title");

  // ------------------------------------------------------------------ step 3
  // The part's Colour swatch opens its popover without moving the panel sideways, which clipped every label (seen 2026-11-04, integration).
  const sideways = () => p.$eval(".de-vpanel", (e) => { let m = 0; for (const x of [e, ...e.querySelectorAll("*")]) m = Math.max(m, x.scrollLeft); return m; });
  await p.click('.de-vpanel [data-f="pop-color"]'); await h.pause(120);
  ok("3 the Colour popover opens", (await p.$$(".de-vpanel .de-colorpop")).length === 1);
  ok("3 and the panel stays put", (await sideways()) === 0, await sideways());
  await h.shot("3-colour-pop");
  await p.keyboard.press("Escape"); await h.pause(60);
  await p.click('.de-vpanel [data-f="pop-font"]'); await h.pause(120);
  ok("3 nor does the Font popover move it", (await sideways()) === 0, await sideways());
  await p.keyboard.press("Escape"); await h.pause(60);
  await h.hex("color", "#aa2233");
  ok("3 colour restyles live", (await h.css(TITLE, "color")) === "rgb(170, 34, 51)", await h.css(TITLE, "color"));
  ok("3 still selected", (await h.head()) === "Title" && (await p.$eval(".de-layer-sheet .de-box:not(.kid)", (e) => !!e)));
  await p.fill('.de-vpanel [data-f="size"]', "64"); await h.pause(60);
  ok("3 size restyles live", (await h.css(TITLE, "fontSize")) === "64px", await h.css(TITLE, "fontSize"));
  ok("3 focus stays in the field", await p.$eval('.de-vpanel [data-f="size"]', (e) => document.activeElement === e));
  await p.$eval('.de-vpanel [data-f="size"]', (e) => e.blur());
  await p.click('.de-vpanel [data-f="pop-font"]'); await h.pause(60);
  await p.fill('.de-vpanel [data-fontq]', "Playfair Display"); await h.pause(60);
  await p.click('.de-vpanel .de-fontitem[data-font="Playfair Display"]'); await h.pause(80);
  ok("3 font restyles live", (await h.css(TITLE, "fontFamily")).includes("Playfair Display"), await h.css(TITLE, "fontFamily"));
  ok("3 selection holds through all three", (await h.head()) === "Title" && (await p.$eval(".de-layers li.on .de-layer b", (e) => e.textContent)) === "Title");
  ok("3 stored on the part", JSON.stringify((await h.morph("hero")).parts.title) === JSON.stringify({ color: "#aa2233", size: 64, font: "Playfair Display" }), await h.morph("hero"));
  await h.shot("3-restyled");
  // The rows are a box's rows: same controls, same order, compared with the blue box's words lower down.
  const rowsOf = (s) => p.$$eval(`.de-vpanel .de-sec[data-section="${s}"] .de-row`, (e) => e.map((r) => [r.querySelector(".de-label")?.textContent, r.className.replace(/^de-row\s*/, "")].join(":")));
  const partText = (await rowsOf("text")).filter((r) => !r.startsWith("Colour:")), partLook = await rowsOf("appearance");
  await h.click("#host [data-tree-node=w2]");
  await h.click("#host [data-tree-node=w2]");
  ok("3 the compare box's words are selected", (await p.$eval(".de-layers li.on", (e) => e.dataset.row)) === "w2", await p.$eval(".de-layers li.on", (e) => e.dataset.row));
  const wordsText = (await rowsOf("text")).filter((r) => !/^(Colour|Kind):/.test(r));
  ok("3 Text rows as a box's words have", JSON.stringify(partText) === JSON.stringify(wordsText), [partText, wordsText]);
  ok("3 Appearance rows as a box's words have", JSON.stringify(partLook) === JSON.stringify(await rowsOf("appearance")), [partLook, await rowsOf("appearance")]);
  await h.shot("3-box-words");

  // ------------------------------------------------------------------ step 4
  await open();
  await h.sel("hero~p:title");
  const eye = (name) => h.row(name).locator(".de-eye");
  await eye("Subtitle").click(); await h.pause(60);
  ok("4 faint in the editor", (await h.css(SUB, "opacity")) === "0.3", await h.css(SUB, "opacity"));
  ok("4 the row says hidden", await h.row("Subtitle").evaluate((e) => e.classList.contains("off")));
  await h.shot("4-hidden");
  await h.published();
  ok("4 gone as published", (await h.css("#tt-show .blk-hero-sub", "display")) === "none", await h.css("#tt-show .blk-hero-sub", "display"));
  await h.shot("4-published");
  await h.closeShow();
  await h.sel("hero~p:title");
  await eye("Subtitle").click(); await h.pause(60);
  ok("4 the eye shows it again", (await h.css(SUB, "opacity")) === "1");
  ok("4 nothing left stored", (await h.morph("hero")) === undefined, await h.morph("hero"));
  await h.undo();
  ok("4 first undo: hidden", (await h.css(SUB, "opacity")) === "0.3");
  await h.undo();
  ok("4 second undo: back", (await h.css(SUB, "opacity")) === "1" && (await h.morph("hero")) === undefined);

  // ------------------------------------------------------------------ step 5
  await open();
  await h.sel("hero~p:title");
  const own = await h.css(TITLE, "color");
  await h.hex("color", "#117733");
  ok("5 set", (await h.css(TITLE, "color")) === "rgb(17, 119, 51)");
  await p.click('.de-vpanel [data-f="reset-color"]'); await h.pause(60);
  ok("5 the arrow returns the block's own colour", (await h.css(TITLE, "color")) === own, await h.css(TITLE, "color"));
  ok("5 and no morph is left", (await h.morph("hero")) === undefined, await h.morph("hero"));
  ok("5 the arrow is gone", (await p.$$('.de-vpanel [data-f="reset-color"]')).length === 0);

  // ------------------------------------------------------------------ step 6
  await open();
  await h.click(CAP);
  ok("6 first click: the wall", (await h.head()) === "Picture wall", await h.head());
  await h.click(CAP);
  ok("6 second click: its cell", (await h.head()) === "Picture and caption", await h.head());
  await h.click(CAP);
  ok("6 third click: Caption", (await h.head()) === "Caption", await h.head());
  ok("6 says how many", (await p.textContent('.de-vpanel [data-f="notice"]')) === "All 6 change together.", await p.textContent('.de-vpanel [data-f="notice"]'));
  await h.shot("6-caption");
  // A scrolled panel still says which part this is.
  await p.$eval(".de-vpanel .de-body", (e) => { e.scrollTop = e.scrollHeight; }); await h.pause(40);
  const stays = await p.evaluate(() => { const b = document.querySelector(".de-vpanel .de-body").getBoundingClientRect(), t = document.querySelector(".de-vpanel .de-head").getBoundingClientRect(), n = document.querySelector('.de-vpanel [data-f="notice"]').getBoundingClientRect(); return { scrolled: document.querySelector(".de-vpanel .de-body").scrollTop > 0, head: Math.abs(t.top - b.top) < 2, notice: n.top >= b.top && n.bottom <= b.bottom }; });
  ok("6 heading and notice stay in view while the panel scrolls", stays.scrolled && stays.head && stays.notice, stays);
  await h.shot("6-scrolled");
  await p.$eval(".de-vpanel .de-body", (e) => { e.scrollTop = 0; }); await h.pause(30);
  await h.hex("color", "#aa2233");
  ok("6 all six change", (await p.$$eval(CAP, (e) => e.map((x) => getComputedStyle(x).color))).join("|") === Array(6).fill("rgb(170, 34, 51)").join("|"), await p.$$eval(CAP, (e) => e.map((x) => getComputedStyle(x).color)));
  await h.shot("6-all");

  // ------------------------------------------------------------------ step 7
  await open();
  await h.click(TITLE); await h.click(TITLE); await h.click(TITLE);
  await h.right(TITLE);
  await h.shot("7-menu");
  for (const id of ["first", "last", "group", "groupcol", "ungroup", "detach", "dup", "delete"]) ok(`7 ${id} is grey`, await h.menuOff(id));
  for (const id of ["parent", "hide"]) ok(`7 ${id} is live`, !(await h.menuOff(id)));
  ok("7 Copy and Reset grey with no look yet", (await h.menuOff("copy-style")) && (await h.menuOff("reset")));
  await h.closeMenu();
  await h.hex("color", "#aa2233");
  await h.right(TITLE);
  ok("7 Copy and Reset live with a look", !(await h.menuOff("copy-style")) && !(await h.menuOff("reset")));
  await h.closeMenu();
  await p.keyboard.press("Escape"); await h.pause(40);
  ok("7 Esc: Words", (await h.head()) === "Words", await h.head());
  await p.keyboard.press("Escape"); await h.pause(40);
  ok("7 Esc: Hero banner", (await h.head()) === "Hero banner", await h.head());

  // ------------------------------------------------------------------ step 8
  await open();
  const PT = '#host [data-tree-node="ptb"]', PTT = `${PT} h1`, PTA = `${PT} a`;
  const ptOwn = await h.css(PTT, "color");
  await h.click(PTT);
  ok("8 first click: the banner", (await h.head()) === "Banner" || /Banner/.test(await h.head()), await h.head());
  ok("8 no Tweaks on a Tailwind block", (await p.$$('.de-vpanel [data-tab="tweaks"]')).length === 0);
  await h.click(PTT); await h.click(PTT);
  ok("8 Title", (await h.head()) === "Title", await h.head());
  await h.hex("color", "#ffcc00");
  ok("8 its colour beats the one it had", (await h.css(PTT, "color")) === "rgb(255, 204, 0)" && ptOwn !== "rgb(255, 204, 0)", [await h.css(PTT, "color"), ptOwn]);
  await p.fill('.de-vpanel [data-f="size"]', "40"); await h.pause(60); await p.$eval('.de-vpanel [data-f="size"]', (e) => e.blur());
  ok("8 size too", (await h.css(PTT, "fontSize")) === "40px", await h.css(PTT, "fontSize"));
  await h.shot("8-title");
  await h.click(PTA); await h.click(PTA);
  ok("8 Button", (await h.head()) === "Button", await h.head());
  await h.hex("color", "#00ccff");
  ok("8 the button restyles", (await h.css(PTA, "color")) === "rgb(0, 204, 255)", await h.css(PTA, "color"));
  await h.shot("8-button");

  // ------------------------------------------------------------------ step 9
  await open();
  await h.click(TITLE);
  await p.click('.de-vpanel [data-tab="tweaks"]'); await h.pause(60);
  ok('9 titled "This block"', (await p.textContent(".de-tweaks .de-sec-title")) === "This block", await p.textContent(".de-tweaks .de-sec-title"));
  ok("9 lists the tokens", (await p.$$eval(".de-tweaks .de-label", (e) => e.map((x) => x.textContent))).join() === "Accent,Ink,Ground,Band,Ink on a band,Title font,Body font,Corners", await p.$$eval(".de-tweaks .de-label", (e) => e.map((x) => x.textContent)));
  ok("9 none is blank", (await p.$$eval(".de-tweaks input", (e) => e.map((x) => x.value))).every((v) => v), await p.$$eval(".de-tweaks input", (e) => e.map((x) => x.value)));
  await h.shot("9-tweaks");
  const before = await p.evaluate(() => [...document.querySelectorAll('#host [data-tree-node]')].filter((e) => e.dataset.treeNode !== "hero").map((e) => getComputedStyle(e).getPropertyValue("--blk-band")).join("|"));
  await p.fill('.de-vpanel [data-f="t-blk-band"]', "#225588"); await h.pause(60);
  const heroBand = await p.$eval("#host .blk-hero", (e) => getComputedStyle(e).getPropertyValue("--blk-band").trim());
  ok("9 this hero's token moves", heroBand === "#225588", heroBand);
  ok("9 its ground moves with it", (await h.css("#host .blk-hero", "backgroundColor")) === "rgb(34, 85, 136)", await h.css("#host .blk-hero", "backgroundColor"));
  const after = await p.evaluate(() => [...document.querySelectorAll('#host [data-tree-node]')].filter((e) => e.dataset.treeNode !== "hero").map((e) => getComputedStyle(e).getPropertyValue("--blk-band")).join("|"));
  ok("9 nothing else on the page moves", before === after);
  ok("9 stored as a token", (await h.morph("hero")).tokens["--blk-band"] === "#225588", await h.morph("hero"));
  await p.$eval('.de-vpanel [data-f="t-blk-band"]', (e) => e.blur());
  await h.shot("9-band");

  // ------------------------------------------------------------------ step 10
  await open();
  await h.sel("hero~p:title");
  await h.hex("color", "#aa2233");
  await h.row("Subtitle").locator(".de-eye").click(); await h.pause(60);
  await h.sel("wall~p:caption");
  await h.hex("color", "#117733");
  await h.sel("ptb~p:title");
  await h.hex("color", "#ffcc00");
  await p.click("[data-a=save]"); await p.waitForFunction(() => document.querySelector(".de-editbar-hint")?.textContent.includes("Saved")); await h.pause(40);
  await p.evaluate(() => window.remount()); await p.waitForSelector(".de-vpanel .de-tabs"); await h.pause(120);
  ok("10 back: the title's look", (await h.css(TITLE, "color")) === "rgb(170, 34, 51)", await h.css(TITLE, "color"));
  ok("10 back: the captions", (await h.css(CAP, "color")) === "rgb(17, 119, 51)");
  ok("10 back: the Tailwind banner", (await h.css(PTT, "color")) === "rgb(255, 204, 0)");
  await p.click('#tt-acts [data-tt="saved-doc"]'); await p.waitForSelector("#tt-show pre"); await h.pause(60);
  const savedText = await p.$eval("#tt-show pre", (e) => e.textContent);
  const saved = JSON.parse(savedText);
  const heroMorph = h.nodeIn(saved, "hero").props.morph;
  ok("10 the saved document holds morph with part names", !!heroMorph?.parts?.title && !!heroMorph.parts.subtitle?.hide, heroMorph);
  ok("10 no CSS selector in it", !/blk-hero|blk-wall|data-morph|template\[|h1 \+/.test(JSON.stringify([heroMorph, h.nodeIn(saved, "wall").props.morph, h.nodeIn(saved, "ptb").props.morph])));
  await h.shot("10-saved");
  await h.closeShow();
  await h.published();
  ok("10 published: the same looks", (await h.css("#tt-show .blk-hero-title", "color")) === "rgb(170, 34, 51)" && (await h.css("#tt-show .blk-wall-caption", "color")) === "rgb(17, 119, 51)" && (await h.css("#tt-show .blk-hero-sub", "display")) === "none");
  const marks = await p.evaluate(() => { const s = document.querySelector("#tt-show"); return { tree: s.querySelectorAll("[data-tree-node],[data-tree-slot],[data-tree-wrap]").length, de: [...s.querySelectorAll("[class]")].filter((e) => [...e.classList].some((c) => c.startsWith("de-"))).length, inline: s.querySelectorAll(".tt-show-page style").length }; });
  ok("10 published: no editor marks", marks.tree === 0 && marks.de === 0, marks);
  await h.shot("10-published");
  await h.closeShow();
  // A font on a paragraph inside the grid: the space under it does not change.
  await open();
  const P = '#host [data-tree-node="prose1"]';
  const gapUnder = () => p.$eval(P, (e) => { const para = e.querySelector("p") ?? e, r = para.getBoundingClientRect(), holder = e.closest("[data-tree-slot]").getBoundingClientRect(); return { margin: getComputedStyle(para).marginBottom, under: Math.round(holder.bottom - r.bottom), top: Math.round(r.top - holder.top) }; });
  const space0 = await gapUnder();
  await h.sel("prose1~p:paragraph");
  ok("10 the paragraph part is selected", (await h.head()) === "Paragraphs", await h.head());
  await p.click('.de-vpanel [data-f="pop-font"]'); await h.pause(60);
  await p.fill('.de-vpanel [data-fontq]', "Oswald"); await h.pause(60);
  await p.click('.de-vpanel .de-fontitem[data-font="Oswald"]'); await h.pause(80);
  ok("10 the font is set", (await h.css(`${P} p`, "fontFamily")).includes("Oswald"), await h.css(`${P} p`, "fontFamily"));
  const space1 = await gapUnder();
  ok("10 the space under it is unchanged", space0.margin === space1.margin && space0.top === space1.top, [space0, space1]);
};
