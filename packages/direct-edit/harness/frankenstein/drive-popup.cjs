// Drives the block popup opened from Puck Studio (EDIT_LOOK_POPUP_BRIEF_2026-11-06 section 5 step 4) on Para
// Theater's real editor config. Run: W=<scratch> bash run.sh frankenstein/entry-popup.tsx:fkp.js -- drive-popup.cjs
const { chromium } = require("playwright-core");
const fs = require("fs");
const { serve } = require("./serve.cjs");
const page = `<!doctype html><meta charset=utf-8><link rel=stylesheet href=/site.css><link rel=stylesheet href=/fkp.css><body><div id="host"></div><script src=/fkp.js></script>`;
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { cond ? pass++ : fail++; console.log(`${cond ? "pass" : "  FAIL"} ${name}${extra ? "  " + extra : ""}`); };
// Stand-in forum rows with topics (serve.cjs has none), so the data block draws real rows.
const FORUM = { forum: { title: "Para Theater", href: "/forum", feeds: [{ slug: "lab", name: "Lab work", threadCount: 3 }], recent: [
  { id: "t1", title: "Masks and breath", kind: "post", feedName: "Lab work", authorName: "A member", replyCount: 2, at: "2026-11-01T12:00:00Z", href: "/forum/t1" },
  { id: "t2", title: "Notes on the second rite", kind: "post", feedName: "Lab work", authorName: "A member", replyCount: 0, at: "2026-10-28T12:00:00Z", href: "/forum/t2" },
], topicCount: 3, postCount: 5 } };

(async () => {
  const srv = await serve("/h", page); fs.mkdirSync("/h/shots", { recursive: true });
  const b = await chromium.connectOverCDP("http://127.0.0.1:9222"); const p = b.contexts()[0].pages()[0];
  p.setDefaultTimeout(9000); await p.setViewportSize({ width: 1500, height: 950 });
  await p.route(/\/api\/blocks\/pt-forum/, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(FORUM) }));
  const errs = []; p.on("pageerror", (e) => errs.push((e.stack || e.message).slice(0, 300))); p.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 200)); });
  let f, frameEl;
  const open = async (q = "") => {
    await p.goto(`http://127.0.0.1:8123/${q}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    frameEl = await p.waitForSelector("iframe", { timeout: 20000 }); f = await frameEl.contentFrame();
    await f.waitForSelector('[data-puck-component="try-steps"]', { timeout: 20000 }); await p.waitForTimeout(1500);
  };
  const data = () => p.evaluate(() => JSON.stringify(globalThis.__getPuck().appState.data));
  const idx = () => p.evaluate(() => globalThis.__getPuck().history.index);
  const item = (id) => p.evaluate((id) => globalThis.__getPuck().getItemById(id)?.props ?? null, id);
  const isOpen = () => p.evaluate(() => globalThis.__popupOpen() && !!document.querySelector(".de-popup"));
  const at = async (sel) => { const el = f.locator(sel).first(); await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(150); const b = await el.boundingBox(); return { x: b.x + Math.min(b.width / 2, 30), y: b.y + Math.min(b.height / 2, 12) }; };
  const dblIn = async (sel) => { const c = await at(sel); await p.mouse.dblclick(c.x, c.y); await p.waitForTimeout(800); };
  const clickIn = async (sel) => { const c = await at(sel); await p.mouse.click(c.x, c.y); await p.waitForTimeout(500); };
  const S = ".de-popup .de-popup-stage";
  const stageDbl = async (sel) => { const el = p.locator(`${S} ${sel}`).first(); await el.scrollIntoViewIfNeeded(); const bb = await el.boundingBox(); await p.mouse.dblclick(bb.x + Math.min(bb.width / 2, 40), bb.y + bb.height / 2); await p.waitForTimeout(500); };
  const typeAll = async (text) => { await p.keyboard.press("Control+a"); await p.keyboard.type(text, { delay: 20 }); };
  const button = (label) => p.locator(".de-popup button:visible", { hasText: label }).first();
  const STEPS = '[data-puck-component="try-steps"]';

  // ── A. Open by gesture ────────────────────────────────────────────────────
  await open();
  ok("row markers drawn: the third stored step (after an empty one) is steps:2", (await f.locator(`${STEPS} li[data-edit-item="steps:2"]`).count()) === 1 && (await f.locator(`${STEPS} li[data-edit-item]`).count()) === 2);
  const d0 = await data(), i0 = await idx();
  // A Puck inline field (the Text block's words in the About band) keeps its double-click.
  const proseSel = '[data-puck-component] [data-puck-overlay-portal]';
  const inlineCount = await f.locator(proseSel).count();
  if (inlineCount) { await dblIn(proseSel); ok("double-click on a Puck inline field: no popup", !(await isOpen())); await p.keyboard.press("Escape"); await clickIn(`${STEPS} li span`); }
  else ok("an inline field exists on the seed", false, "no [data-puck-overlay-portal]");
  ok("…and Puck's data unchanged by it", (await data()) === d0);
  await dblIn(`${STEPS} li span`);
  ok("double-click on a block opens the popup", await isOpen());
  ok("popup draws that block alone", (await p.locator(`${S} [data-tree-node="try-steps"]`).count()) === 1 && (await p.locator(`${S} [data-tree-node]`).count()) === 1);
  ok("popup is over Studio, not in the canvas iframe", (await f.locator(".de-popup").count()) === 0);
  const fontCanvas = await f.$eval(`${STEPS} h3`, (e) => getComputedStyle(e).fontFamily);
  const fontStage = await p.$eval(`${S} h3`, (e) => getComputedStyle(e).fontFamily);
  ok("stage draws with the site's fonts (step title family as in the canvas)", fontCanvas === fontStage, `${fontCanvas} | ${fontStage}`);
  const primCanvas = await f.$eval(`${STEPS} li span`, (e) => getComputedStyle(e).color);
  const primStage = await p.$eval(`${S} li span`, (e) => getComputedStyle(e).color);
  ok("stage draws with the site's tokens (number colour as in the canvas)", primCanvas === primStage, `${primCanvas} | ${primStage}`);
  ok("no Code tab with developer off", (await p.locator('.de-popup [data-tab="code"]').count()) === 0);
  ok("rows note says rows are typed on the block", (await p.locator('.de-popup [data-f="rows-note"]').count()) >= 1);
  await p.screenshot({ path: "/h/shots/popup-01-open.png" });

  // ── B. Type a step, its text, style a part ────────────────────────────────
  await stageDbl('li[data-edit-item="steps:2"] h3');
  ok("double-click on a step title starts typing in place", (await p.locator(`${S} h3[contenteditable="true"]`).count()) === 1);
  await typeAll("Read this first"); await p.keyboard.press("Enter"); await p.waitForTimeout(400);
  ok("typed title drawn in the popup", (await p.locator(`${S} li[data-edit-item="steps:2"] h3`).innerText()) === "Read this first");
  ok("no duplicated text after the redraw", (await p.locator(`${S} li[data-edit-item="steps:2"] h3`).evaluate((e) => e.childNodes.length)) === 1);
  ok("Puck's data untouched while the popup is open", (await data()) === d0);
  await stageDbl('li[data-edit-item="steps:0"] > div > div');
  ok("double-click on a step's text starts rich typing", (await p.locator(`${S} li[data-edit-item="steps:0"] [contenteditable="true"]`).count()) === 1);
  await typeAll("New words <b>here</b>"); await p.keyboard.press("Enter"); await p.waitForTimeout(400);
  console.log("  after rich commit:", JSON.stringify(await p.locator(`${S} li[data-edit-item="steps:0"] > div > div`).evaluate((e) => ({ html: e.innerHTML, ce: e.getAttribute("contenteditable") }))));
  ok("typed text drawn as a paragraph", /New words &lt;b&gt;here&lt;\/b&gt;|New words <b>here<\/b>/.test(await p.locator(`${S} li[data-edit-item="steps:0"] > div > div`).innerHTML()) || (await p.locator(`${S} li[data-edit-item="steps:0"] > div > div p`).count()) === 1, await p.locator(`${S} li[data-edit-item="steps:0"] > div > div`).innerHTML());
  // Style the step titles (a repeated part): select it, then Size in the popup's panel.
  await p.locator(`${S} li[data-edit-item="steps:2"] h3`).click(); await p.waitForTimeout(300);
  await p.locator(`${S} li[data-edit-item="steps:2"] h3`).click(); await p.waitForTimeout(300);
  await p.locator(`${S} li[data-edit-item="steps:2"] h3`).click(); await p.waitForTimeout(300);
  const heading = await p.locator(".de-popup .de-vpanel .de-head, .de-popup .de-vpanel h2, .de-popup .de-vpanel [data-f=heading]").first().innerText().catch(() => "?");
  console.log("  panel heading:", heading.replace(/\s+/g, " ").slice(0, 60));
  const size = p.locator('.de-popup input[data-k="size"]').first();
  if (await size.count()) { await size.fill("30"); await p.keyboard.press("Enter"); await p.waitForTimeout(400); }
  const titleSize = await p.$eval(`${S} li[data-edit-item="steps:2"] h3`, (e) => getComputedStyle(e).fontSize);
  ok("Size on the Step title part draws in the popup", titleSize === "30px", titleSize);
  await p.screenshot({ path: "/h/shots/popup-02-edited.png" });
  // Puck's undo key inside the popup is the popup's, not Puck's.
  await p.locator(".de-popup .de-popup-frame").focus();
  await p.keyboard.press("Control+z"); await p.waitForTimeout(300); await p.keyboard.press("Control+Shift+z"); await p.waitForTimeout(300);
  ok("Ctrl+Z in the popup leaves Puck's history and data alone", (await idx()) === i0 && (await data()) === d0);

  // ── C. Use on this page: one replace, one undo step ───────────────────────
  await button("Use on this page").click(); await p.waitForTimeout(1200);
  ok("popup closed after Use", !(await isOpen()));
  const s1 = await item("try-steps");
  ok("Puck holds the typed title", s1?.steps?.[2]?.title === "Read this first", JSON.stringify(s1?.steps?.[2]));
  ok("Puck holds the typed text, sanitised as paragraphs", s1?.steps?.[0]?.text === "<p>New words &lt;b&gt;here&lt;/b&gt;</p>", JSON.stringify(s1?.steps?.[0]?.text));
  ok("the empty row is kept in place", s1?.steps?.length === 3 && s1.steps[1].title === "");
  ok("Puck holds morph.parts.stepTitle.size = 30", s1?.morph?.parts?.stepTitle?.size === 30, JSON.stringify(s1?.morph));
  ok("one history step", (await idx()) === i0 + 1, `${i0} -> ${await idx()}`);
  ok("canvas draws the typed title", (await f.locator(`${STEPS} li[data-edit-item="steps:2"] h3`).innerText()) === "Read this first");
  ok("canvas draws the look", (await f.$eval(`${STEPS} li[data-edit-item="steps:2"] h3`, (e) => getComputedStyle(e).fontSize)) === "30px");
  // Puck's right panel shows the row as typed.
  const sel = () => p.evaluate(() => ({ item: globalThis.__getPuck().selectedItem?.props?.id ?? null, part: globalThis.__parts() }));
  await p.evaluate(() => globalThis.__getPuck().dispatch({ type: "setUi", ui: { itemSelector: null } })); await p.waitForTimeout(300);
  await clickIn(`${STEPS} h2`);
  await p.waitForTimeout(400);
  console.log("  selected:", JSON.stringify(await sel()));
  const fieldsText = await p.locator("body").innerText();
  ok("Puck's right panel lists the typed step", fieldsText.includes("Read this first"));
  await p.screenshot({ path: "/h/shots/popup-03-used.png" });
  await p.evaluate(() => globalThis.__getPuck().history.back()); await p.waitForTimeout(500);
  ok("one undo reverts the whole popup session", (await data()) === d0);
  await p.evaluate(() => globalThis.__getPuck().history.forward()); await p.waitForTimeout(500);
  ok("redo brings it back", (await item("try-steps"))?.steps?.[2]?.title === "Read this first");

  // ── D. Discard and Esc: Puck byte-equal ───────────────────────────────────
  const d1 = await data(), i1 = await idx();
  await p.evaluate(() => globalThis.__getPuck().dispatch({ type: "setUi", ui: { itemSelector: null } })); await p.waitForTimeout(300);
  await clickIn(`${STEPS} li span`);
  console.log("  selected:", JSON.stringify(await sel()));
  const edit = f.locator('[data-eac-edit-look]').first();
  ok('"Edit look" in the block\'s action bar', (await edit.count()) === 1);
  await edit.click({ force: true }); await p.waitForTimeout(800);
  ok('"Edit look" opens the popup', await isOpen());
  await stageDbl('li[data-edit-item="steps:2"] h3'); await typeAll("Thrown away"); await p.keyboard.press("Enter"); await p.waitForTimeout(300);
  await button("Close").click(); await p.waitForTimeout(300);
  ok("Close with changes asks first", await p.locator(".de-popup-ask:not([hidden])").isVisible());
  await p.locator('.de-popup [data-ask="discard"]').click(); await p.waitForTimeout(500);
  ok("Discard closes it", !(await isOpen()));
  ok("Discard leaves Puck's data byte-equal", (await data()) === d1);
  ok("…and its history where it was", (await idx()) === i1);
  await dblIn(`${STEPS} li span`);
  await p.keyboard.press("Escape"); await p.waitForTimeout(300); await p.keyboard.press("Escape"); await p.waitForTimeout(400);
  ok("Esc closes an unchanged popup", !(await isOpen()));
  ok("…byte-equal again", (await data()) === d1);

  // ── E. Nested block (inside a band) ───────────────────────────────────────
  const NEST = '[data-puck-component="try-steps-nested"]';
  const band0 = await item("try-about");
  console.log("  nested drawn:", await f.locator(NEST).count(), await f.locator(`${NEST} li`).count());
  await dblIn(`${NEST} li span`);
  console.log("  open:", await isOpen(), JSON.stringify(await p.evaluate(() => [...document.querySelectorAll(".de-popup [data-tree-node]")].map((e) => e.dataset.treeNode))), JSON.stringify(await p.evaluate(() => globalThis.__getPuck().selectedItem?.props?.id)));
  ok("double-click on a block in a band opens that block, not the band", (await p.locator(`${S} [data-tree-node="try-steps-nested"]`).count()) === 1 && (await p.locator(`${S} [data-tree-node="try-about"]`).count()) === 0);
  await stageDbl("section > h2"); await typeAll("Before the lab, read"); await p.keyboard.press("Enter"); await p.waitForTimeout(300);
  await button("Use on this page").click(); await p.waitForTimeout(1000);
  const band1 = await item("try-about");
  ok("the nested heading is typed", (await item("try-steps-nested"))?.heading === "Before the lab, read");
  ok("the band's other blocks are as they were", JSON.stringify(band1.content.filter((n) => n.props.id !== "try-steps-nested")) === JSON.stringify(band0.content.filter((n) => n.props.id !== "try-steps-nested")));

  // ── F. Data block with real rows (forum) ──────────────────────────────────
  const FOR = '[data-puck-component="try-forum"]';
  await f.waitForSelector(`${FOR} .eac-forum-mini-title`, { timeout: 10000 }).catch(() => {});
  const forum0 = await item("try-forum");
  ok("Puck resolved the forum rows", forum0?.forum?.recent?.length === 2);
  const i2 = await idx();
  await dblIn(`${FOR} h2`);
  ok("forum opens in the popup", await isOpen());
  const titles = await p.locator(`${S} .eac-forum-mini-title`).allInnerTexts();
  ok("popup draws Puck's resolved rows (not samples)", titles.join("|").includes("Masks and breath"), titles.join("|"));
  await stageDbl(".eac-forum-mini-title");
  ok("a topic title is not typed into", (await p.locator(`${S} [contenteditable="true"]`).count()) === 0);
  const top = await p.locator(".de-popup").innerText();
  ok("…and a note says where it is changed", /come from the site's data/.test(top));
  await stageDbl("h2"); await typeAll("Forum notes"); await p.keyboard.press("Enter"); await p.waitForTimeout(300);
  await p.screenshot({ path: "/h/shots/popup-04-forum.png" });
  await button("Use on this page").click(); await p.waitForTimeout(1500);
  const forum1 = await item("try-forum");
  ok("forum heading typed into Puck", forum1?.heading === "Forum notes");
  ok("forum rows still on the node after the hand-back", JSON.stringify(forum1?.forum) === JSON.stringify(forum0?.forum));
  ok("forum hand-back is one step", (await idx()) === i2 + 1, `${i2} -> ${await idx()}`);
  ok("canvas still draws the topics", (await f.locator(`${FOR} .eac-forum-mini-title`).count()) >= 2);

  // ── G. Publish carries morph and typed text ───────────────────────────────
  await p.locator("header").getByText("Publish", { exact: true }).click(); await p.waitForTimeout(1500);
  const pub = await p.evaluate(() => globalThis.__published);
  const pstep = pub?.content?.find((n) => n.props.id === "try-steps")?.props;
  ok("published: typed title and text", pstep?.steps?.[2]?.title === "Read this first" && pstep?.steps?.[0]?.text?.startsWith("<p>New words"));
  ok("published: morph", pstep?.morph?.parts?.stepTitle?.size === 30);
  fs.writeFileSync("/h/published-popup.json", JSON.stringify(pub, null, 1));

  // ── H. Phone width ────────────────────────────────────────────────────────
  // Opened at phone width: Studio's canvas is narrower, and the popup fits the block to the room it has.
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(1200);
  await dblIn(`${STEPS} li span`);
  ok("phone width: double-click still opens it", await isOpen());
  const phone = await p.evaluate(() => { const fr = document.querySelector(".de-popup-frame").getBoundingClientRect(); return { sw: document.documentElement.scrollWidth, iw: innerWidth, l: Math.round(fr.left), r: Math.round(fr.right) }; });
  ok("phone width: the popup fits the window", phone.sw <= phone.iw + 1 && phone.l >= 0 && phone.r <= phone.iw + 1, JSON.stringify(phone));
  const fitted = await p.evaluate(() => { const m = document.querySelector(".de-popup-main"); return { sw: m.scrollWidth, cw: m.clientWidth }; });
  ok("phone width: the block is fitted to the popup (no sideways scroll)", fitted.sw <= fitted.cw + 1, JSON.stringify(fitted));
  await p.screenshot({ path: "/h/shots/popup-05-phone.png" });
  await p.keyboard.press("Escape"); await p.waitForTimeout(300); await p.keyboard.press("Escape"); await p.waitForTimeout(300);
  await p.setViewportSize({ width: 1500, height: 950 });

  // ── I. Developer on ───────────────────────────────────────────────────────
  await open("?dev=1");
  await dblIn(`${STEPS} li span`);
  ok("developer on: the Code tab is in the popup", (await p.locator('.de-popup [data-tab="code"]').count()) >= 1);
  await p.screenshot({ path: "/h/shots/popup-06-dev.png" });

  const real = errs.filter((e) => !/Failed to load resource|ERR_|net::/.test(e));
  ok("no page errors", real.length === 0, real.slice(0, 4).join(" || "));
  console.log(`\n${pass}/${pass + fail}`);
  srv.close(); process.exit(0);
})().catch((e) => { console.log("CRASH", e.stack); console.log(`\n${pass}/${pass + fail}`); process.exit(1); });
