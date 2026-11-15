// Drives "inception" on Para Theater's real canvas page editor (entry-inception.tsx): Settings… opens one block in
// Puck over the canvas; inside that sheet, "Edit look" opens direct-edit's popup over it and hands back into it; the
// canvas's own popup offers Settings… over itself; Esc and keys belong to the top layer; the selection comes back.
// Run: W=<scratch> bash run.sh frankenstein/entry-inception.tsx:fki.js -- drive-inception.cjs
// (server actions recorded by the scratch build's stubs: globalThis.__calls)
const { chromium } = require("playwright-core");
const fs = require("fs");
const { serve } = require("./serve.cjs");
const page = `<!doctype html><meta charset=utf-8><link rel=stylesheet href=/site.css><link rel=stylesheet href=/fki.css><body><div id="host"></div><script src=/fki.js></script>`;
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { cond ? pass++ : fail++; console.log(`${cond ? "pass" : "  FAIL"} ${name}${extra ? "  " + extra : ""}`); };

(async () => {
  const srv = await serve("/h", page); fs.mkdirSync("/h/shots", { recursive: true });
  const b = await chromium.connectOverCDP("http://127.0.0.1:9222"); const p = b.contexts()[0].pages()[0];
  p.setDefaultTimeout(9000); await p.setViewportSize({ width: 1500, height: 950 });
  const errs = []; p.on("pageerror", (e) => errs.push((e.stack || e.message).slice(0, 300))); p.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 200)); });
  await p.goto("http://127.0.0.1:8123/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForSelector('[data-tree-node="try-steps"]', { timeout: 30000 }); await p.waitForTimeout(1500);

  const N = (id) => `#host [data-tree-node="${id}"]`;
  const SHEET = "[data-block-settings]";
  const POP = ".de-popup";
  const S = `${POP} .de-popup-stage`;
  const layers = () => p.evaluate(() => [...document.querySelectorAll("[data-eac-layer]")].map((e) => ({ kind: e.matches("[data-block-settings]") ? "sheet" : e.matches(".de-popup") ? "popup" : "?", z: Number(getComputedStyle(e).zIndex) })));
  const sheetFrame = async () => { const el = await p.waitForSelector(`${SHEET} iframe`, { timeout: 20000 }); const fr = await el.contentFrame(); await fr.waitForSelector('[data-puck-component]', { timeout: 20000 }); await p.waitForTimeout(800); return fr; };
  const centre = async (loc) => { await loc.scrollIntoViewIfNeeded(); const bb = await loc.boundingBox(); return { x: bb.x + Math.min(bb.width / 2, 40), y: bb.y + Math.min(bb.height / 2, 12) }; };
  const click = async (sel) => { const c = await centre(p.locator(sel).first()); await p.mouse.click(c.x, c.y); await p.waitForTimeout(400); };
  const typeAll = async (text) => { await p.keyboard.press("Control+a"); await p.keyboard.type(text, { delay: 15 }); };
  const headText = () => p.locator(".de-vpanel .de-head b").first().innerText().catch(() => "");
  const heading = (root) => p.locator(`${root} [data-tree-node="try-steps"] > h2`).first().innerText();
  const sheetHeading = async (value) => { const inp = p.locator(`${SHEET} input[name="heading"]:visible`).first(); await inp.click(); await inp.fill(value); await p.waitForTimeout(500); };
  /** The steps block itself (not one of its parts): Esc up to nothing selected, then one click. */
  const selectBlock = async () => {
    for (let i = 0; i < 3; i++) { await p.keyboard.press("Escape"); await p.waitForTimeout(150); }
    await click(`${N("try-steps")} > h2`);
  };
  const sheetButton = (label) => p.locator(`${SHEET} button`, { hasText: label }).first();

  // ── A. One door: Settings… on a sealed block opens Puck over the canvas ───
  await click(`${N("try-steps")} > h2`);
  ok("canvas: the steps block is selected", /Numbered steps/.test(await headText()), await headText());
  ok("right column offers Settings… (not a link away)", (await p.locator('.de-vpanel [data-f="block-settings"]').count()) === 1 && (await p.locator('.de-vpanel [data-f="block-editor"]').count()) === 0);
  await p.locator('.de-vpanel [data-f="block-settings"]').click(); await p.waitForTimeout(500);
  let sf = await sheetFrame();
  ok("Settings… opens the Puck sheet", (await p.locator(SHEET).count()) === 1);
  ok("…as a layer in the stack", JSON.stringify((await layers()).map((l) => l.kind)) === '["sheet"]', JSON.stringify(await layers()));
  ok("…drawing that one block", (await sf.locator('[data-puck-component]').count()) >= 1 && (await sf.locator('[data-puck-component="try-steps"]').count()) === 1);
  ok("…with its heading field", (await p.locator(`${SHEET} input[name="heading"]:visible`).count()) === 1);
  await sheetHeading("How to join us");
  await p.screenshot({ path: "/h/shots/inc-01-sheet.png" });
  await sheetButton("Apply").click(); await p.waitForTimeout(1200);
  ok("Apply closes the sheet", (await p.locator(SHEET).count()) === 0 && (await layers()).length === 0);
  ok("canvas draws the new heading", (await heading("#host")) === "How to join us", await heading("#host"));
  await p.keyboard.press("Control+z"); await p.waitForTimeout(500);
  ok("one undo on the canvas takes it back", (await heading("#host")) === "How to join", await heading("#host"));
  await p.keyboard.press("Control+Shift+z"); await p.waitForTimeout(500);
  ok("redo brings it back", (await heading("#host")) === "How to join us");

  // ── B. Inception 1: Puck sheet → Edit look → direct-edit popup over it → hand back → Apply ──
  await selectBlock();
  await p.locator('.de-vpanel [data-f="block-settings"]').click(); await p.waitForTimeout(500);
  sf = await sheetFrame();
  // The block is selected in the sheet: its action bar carries "Edit look" (parts plugin with a popup).
  let edit = sf.locator("[data-eac-edit-look]").first();
  if (!(await edit.count())) { const c = await centre(sf.locator('[data-puck-component="try-steps"] h2').first()); await p.mouse.click(c.x, c.y); await p.waitForTimeout(500); edit = sf.locator("[data-eac-edit-look]").first(); }
  ok('the sheet offers "Edit look"', (await edit.count()) === 1);
  await edit.click({ force: true }); await p.waitForTimeout(900);
  let L = await layers();
  ok("Edit look opens direct-edit's popup over the sheet", JSON.stringify(L.map((l) => l.kind)) === '["sheet","popup"]', JSON.stringify(L));
  ok("…stacked above it", L.length === 2 && L[1].z > L[0].z, JSON.stringify(L));
  const top = await p.evaluate(() => { const r = document.querySelector(".de-popup .de-popup-frame").getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!e?.closest(".de-popup"); });
  ok("…and the popup takes the pointer", top);
  // Type a step title in the popup.
  const t = p.locator(`${S} li h3`).nth(1); const ct = await centre(t); await p.mouse.dblclick(ct.x, ct.y); await p.waitForTimeout(400);
  ok("typing in place inside the popup", (await p.locator(`${S} h3[contenteditable="true"]`).count()) === 1);
  await typeAll("Read this first"); await p.keyboard.press("Enter"); await p.waitForTimeout(400);
  await p.screenshot({ path: "/h/shots/inc-02-popup-over-sheet.png" });
  await p.locator(`${POP} button:visible`, { hasText: "Use on this page" }).first().click(); await p.waitForTimeout(1000);
  L = await layers();
  ok("Use closes the popup; the sheet stays", JSON.stringify(L.map((l) => l.kind)) === '["sheet"]', JSON.stringify(L));
  ok("the sheet's Puck draws the typed title", (await sf.locator('[data-puck-component="try-steps"] li h3').nth(1).innerText()) === "Read this first");
  await sheetButton("Apply").click(); await p.waitForTimeout(1200);
  ok("Apply hands it to the canvas", (await p.locator(`${N("try-steps")} li h3`).nth(1).innerText()) === "Read this first");
  ok("…and the heading from A is kept", (await heading("#host")) === "How to join us");

  // ── C. Esc belongs to the top layer (popup over sheet) ────────────────────
  await selectBlock();
  await p.locator('.de-vpanel [data-f="block-settings"]').click(); await p.waitForTimeout(500);
  sf = await sheetFrame();
  edit = sf.locator("[data-eac-edit-look]").first();
  if (!(await edit.count())) { const c = await centre(sf.locator('[data-puck-component="try-steps"] h2').first()); await p.mouse.click(c.x, c.y); await p.waitForTimeout(500); edit = sf.locator("[data-eac-edit-look]").first(); }
  await edit.click({ force: true }); await p.waitForTimeout(900);
  // One Esc at a time: the unchanged popup goes (up a level first if something is selected in it), the sheet stays.
  for (let i = 0; i < 2 && (await p.locator(POP).count()); i++) { await p.keyboard.press("Escape"); await p.waitForTimeout(400); }
  L = await layers();
  ok("Esc closes the unchanged popup, not the sheet under it", JSON.stringify(L.map((l) => l.kind)) === '["sheet"]', JSON.stringify(L));
  await p.keyboard.press("Escape"); await p.waitForTimeout(800);
  ok("the next Esc cancels the clean sheet", (await layers()).length === 0 && (await p.locator(SHEET).count()) === 0);
  ok("…canvas unchanged", (await p.locator(`${N("try-steps")} li h3`).nth(1).innerText()) === "Read this first");

  // ── D. Inception 2: canvas popup → Settings… → Puck sheet over it → back into the popup ──
  const c2 = await centre(p.locator(`${N("try-steps")} li span`).first()); await p.mouse.dblclick(c2.x, c2.y); await p.waitForTimeout(900);
  ok("double-click opens the canvas popup", (await p.locator(POP).count()) === 1);
  const popSettings = p.locator(`${POP} [data-f="block-settings"]`);
  // The popup opens with its block selected; select it only if it is not.
  if (!(await popSettings.count())) { await p.locator(`${S} [data-tree-node="try-steps"] > h2`).click(); await p.waitForTimeout(400); }
  ok("the popup offers Settings…", (await popSettings.count()) === 1);
  await popSettings.click(); await p.waitForTimeout(500);
  sf = await sheetFrame();
  L = await layers();
  ok("the Puck sheet opens over the popup", JSON.stringify(L.map((l) => l.kind)) === '["popup","sheet"]' && L[1].z > L[0].z, JSON.stringify(L));
  await sheetHeading("Joining");
  // Dirty guard: the first Esc leaves the field, the next one asks in the header instead of dropping the change.
  await p.keyboard.press("Escape"); await p.waitForTimeout(300); await p.keyboard.press("Escape"); await p.waitForTimeout(500);
  ok("Esc on a sheet with changes keeps it open", JSON.stringify((await layers()).map((l) => l.kind)) === '["popup","sheet"]', JSON.stringify(await layers()));
  ok("…and asks to Apply or Cancel (in the sheet, no browser dialog)", await p.locator(`${SHEET} [data-block-settings-ask]`).isVisible());
  ok("…the popup under it is untouched", (await heading(S)) === "How to join us");
  await p.screenshot({ path: "/h/shots/inc-03-sheet-over-popup.png" });
  await sheetButton("Apply").click(); await p.waitForTimeout(1200);
  ok("Apply returns to the popup, still open", JSON.stringify((await layers()).map((l) => l.kind)) === '["popup"]');
  ok("the popup draws the new heading", (await heading(S)) === "Joining", await heading(S).catch(() => "?"));
  ok("the page under it is not changed yet", (await heading("#host")) === "How to join us");
  await p.locator(`${POP} button:visible`, { hasText: "Use on this page" }).first().click(); await p.waitForTimeout(1000);
  ok("Use hands it to the page", (await p.locator(POP).count()) === 0 && (await heading("#host")) === "Joining");

  // ── E. The selection comes back: a part, Settings… from its menu, Cancel ──
  await selectBlock();
  await click(`${N("try-steps")} > h2`);
  const before = await headText();
  ok("a part of the block is selected", /Heading/.test(before), before);
  const hc = await centre(p.locator(`${N("try-steps")} > h2`).first());
  await p.mouse.click(hc.x, hc.y, { button: "right" }); await p.waitForTimeout(400);
  const item = p.locator('.de-menu button[role="menuitem"]', { hasText: "Settings…" });
  ok("a part's menu offers Settings…", (await item.count()) === 1);
  await item.first().click(); await p.waitForTimeout(500);
  await sheetFrame();
  await sheetButton("Cancel").click(); await p.waitForTimeout(800);
  ok("Cancel gives the part back its selection", (await headText()) === before, `${before} -> ${await headText()}`);

  // ── G. Mixed stack, walked back with Esc: canvas part → Puck sheet → popup over it → Esc ×3 ──
  ok("the part is still selected before the walk", (await headText()) === before, await headText());
  const hc2 = await centre(p.locator(`${N("try-steps")} > h2`).first());
  await p.mouse.click(hc2.x, hc2.y, { button: "right" }); await p.waitForTimeout(400);
  await p.locator('.de-menu button[role="menuitem"]', { hasText: "Settings…" }).first().click(); await p.waitForTimeout(500);
  sf = await sheetFrame();
  edit = sf.locator("[data-eac-edit-look]").first();
  if (!(await edit.count())) { const c = await centre(sf.locator('[data-puck-component="try-steps"] h2').first()); await p.mouse.click(c.x, c.y); await p.waitForTimeout(500); edit = sf.locator("[data-eac-edit-look]").first(); }
  await edit.click({ force: true }); await p.waitForTimeout(900);
  // A part selected inside the popup, so the first Esc has a level to go up.
  await p.locator(`${S} [data-tree-node="try-steps"] > h2`).click(); await p.waitForTimeout(300);
  L = await layers();
  ok("mixed stack open: sheet (page-builder) under popup (direct-edit)", JSON.stringify(L.map((l) => l.kind)) === '["sheet","popup"]' && L[1].z > L[0].z, JSON.stringify(L));
  ok("both packages read one registry", await p.evaluate(() => (globalThis[Symbol.for("eac.layer-stack.v1")] ?? []).length === 2));
  const seq = [];
  for (let i = 0; i < 3; i++) { await p.keyboard.press("Escape"); await p.waitForTimeout(500); seq.push((await layers()).map((l) => l.kind).join("+") || "none"); }
  console.log("  after each Esc:", seq.join(" | "));
  ok("Esc ×3 walks down: popup up a level, popup closed, sheet cancelled", seq[0] === "sheet+popup" && seq[1] === "sheet" && seq[2] === "none", seq.join(" | "));
  ok("…back on the canvas with the original part selected", (await headText()) === before, `${before} -> ${await headText()}`);
  ok("…and the registry is empty", await p.evaluate(() => (globalThis[Symbol.for("eac.layer-stack.v1")] ?? []).length === 0));
  ok("the canvas takes clicks again", await (async () => { await click(`${N("try-steps")} li span`); return (await headText()).length > 0; })());

  // ── H. A look made in the inner popup: one undo step on the canvas ───────
  const T2 = `${N("try-steps")} li[data-edit-item="steps:0"] h3`;
  const size0 = await p.$eval(T2, (e) => getComputedStyle(e).fontSize);
  await selectBlock();
  await p.locator('.de-vpanel [data-f="block-settings"]').click(); await p.waitForTimeout(500);
  sf = await sheetFrame();
  edit = sf.locator("[data-eac-edit-look]").first();
  if (!(await edit.count())) { const c = await centre(sf.locator('[data-puck-component="try-steps"] h2').first()); await p.mouse.click(c.x, c.y); await p.waitForTimeout(500); edit = sf.locator("[data-eac-edit-look]").first(); }
  await edit.click({ force: true }); await p.waitForTimeout(900);
  const PT = `${S} li[data-edit-item="steps:0"] h3`;
  // Click-through goes one level deeper per click: stop at the step title part.
  const popHead = () => p.locator(".de-popup .de-vpanel .de-head b").first().innerText().catch(() => "");
  for (let i = 0; i < 6 && !/Step title/.test(await popHead()); i++) { await p.locator(PT).click(); await p.waitForTimeout(300); }
  console.log("  popup panel:", await popHead());
  const sizeBox = p.locator('.de-popup input[data-k="size"]').first();
  ok("the popup offers Size on the step title part", (await sizeBox.count()) === 1, await p.locator(".de-popup .de-vpanel .de-head").first().innerText().catch(() => "?"));
  if (await sizeBox.count()) { await sizeBox.fill("30"); await p.keyboard.press("Enter"); await p.waitForTimeout(400); }
  ok("the look draws in the popup", (await p.$eval(PT, (e) => getComputedStyle(e).fontSize)) === "30px");
  await p.locator(`${POP} button:visible`, { hasText: "Use on this page" }).first().click(); await p.waitForTimeout(1000);
  ok("the sheet's Puck draws the look handed back", (await sf.$eval('[data-puck-component="try-steps"] li h3', (e) => getComputedStyle(e).fontSize)) === "30px");
  // A sheet holding a look handed back is dirty: Esc asks, it does not drop it.
  await p.keyboard.press("Escape"); await p.waitForTimeout(400);
  ok("Esc with a handed-back look asks, the sheet stays", (await p.locator(SHEET).count()) === 1 && (await p.locator(`${SHEET} [data-block-settings-ask]`).isVisible()));
  await sheetButton("Apply").click(); await p.waitForTimeout(1200);
  ok("Apply: the canvas draws the look", (await p.$eval(T2, (e) => getComputedStyle(e).fontSize)) === "30px");
  const head1 = await heading("#host");
  await p.keyboard.press("Control+z"); await p.waitForTimeout(600);
  ok("one undo removes the look", (await p.$eval(T2, (e) => getComputedStyle(e).fontSize)) === size0, `${size0} vs ${await p.$eval(T2, (e) => getComputedStyle(e).fontSize)}`);
  ok("…and only the look: the step before it is still there", (await heading("#host")) === head1, `${head1} -> ${await heading("#host")}`);
  await p.keyboard.press("Control+Shift+z"); await p.waitForTimeout(600);
  ok("redo brings the look back", (await p.$eval(T2, (e) => getComputedStyle(e).fontSize)) === "30px");

  // ── I. designTools (round 2): Shift+click adds a second block, the panel offers the several-at-once tools ──
  await selectBlock();
  const bannerEl = p.locator(`${N("try-banner")}`).first(); await bannerEl.scrollIntoViewIfNeeded();
  const bb2 = await bannerEl.boundingBox();
  // The middle of the banner: its top edge sits under the editor's own bar.
  await bannerEl.click({ force: true, modifiers: ["Shift"], position: { x: Math.min(80, bb2.width / 2), y: bb2.height / 2 } }); await p.waitForTimeout(600);
  const multi = await p.locator('.de-vpanel [data-f^="multi-"]').count();
  ok("designTools: Shift+click selects two blocks, the panel offers align/same size/group", multi >= 3 && /2 selected/.test(await headText()), `${multi} tools; head: ${await headText()}`);
  for (let i = 0; i < 3; i++) { await p.keyboard.press("Escape"); await p.waitForTimeout(150); }
  // Handles on all four sides (top and left too) on a box of the page's own: designTools only.
  const box = await p.evaluate(() => { const e = [...document.querySelectorAll("#host [data-tree-node]")].find((x) => !x.hasAttribute("data-tree-sealed") && x.dataset.treeType === "pt-band"); return e?.dataset.treeNode ?? null; });
  if (box) { await click(`${N(box)}`); }
  const sides = await p.evaluate(() => [...document.querySelectorAll("[data-handle]")].map((e) => e.getAttribute("data-handle")));
  console.log("  handles:", box, JSON.stringify(sides));
  for (let i = 0; i < 3; i++) { await p.keyboard.press("Escape"); await p.waitForTimeout(150); }

  // ── J. Item 5a: Tab stays in the editor; the page's own tabindex comes back exactly ──
  const FOC = "a[href], button, input, select, textarea, iframe, [tabindex], [contenteditable]:not([contenteditable='false'])";
  const loud = await p.evaluate((sel) => [...document.querySelectorAll(`#host [data-tree-node] :is(${sel})`)].filter((e) => !e.closest("[data-de-ui], [data-edit-skip]") && e.getAttribute("tabindex") !== "-1").map((e) => e.outerHTML.slice(0, 80)), FOC);
  const quietCount = await p.evaluate(() => document.querySelectorAll('#host [data-tree-node] [tabindex="-1"]').length);
  ok("5a: every focusable a block draws is out of the Tab order while editing", loud.length === 0 && quietCount > 0, `${quietCount} quiet; loud: ${loud.slice(0, 2).join(" | ")}`);
  await p.locator(".de-editbar button").first().focus();
  const landed = [];
  for (let i = 0; i < 40; i++) { await p.keyboard.press("Tab"); landed.push(await p.evaluate(() => { const a = document.activeElement; return a?.closest?.("#host [data-tree-node]") ? `PAGE:${a.tagName}` : a?.tagName ?? "none"; })); }
  ok("5a: 40 Tabs from the editor bar never land inside a block", !landed.some((x) => x.startsWith("PAGE")), [...new Set(landed)].join(","));
  await p.keyboard.press("Shift+Tab");
  ok("5a: Shift+Tab neither", !(await p.evaluate(() => !!document.activeElement?.closest?.("#host [data-tree-node]"))));
  // A click on a block's own link still selects it (picking is unchanged, unlike inert).
  const linkIn = p.locator(`#host [data-tree-node] a[href]`).first();
  if (await linkIn.count()) { await selectBlock(); const lb = await linkIn.boundingBox(); await p.mouse.click(lb.x + 4, lb.y + 4); await p.waitForTimeout(400); }
  ok("5a: a click on a block's link still selects in the editor (no navigation)", (await headText()).length > 0 && !(await p.evaluate(() => globalThis.__nav)), await headText());
  // The module on a fixture: original values back exactly, the chrome never touched, re-renders covered.
  const fx = await p.evaluate(async () => {
    const box = document.createElement("div");
    box.innerHTML = `<a href="#a">a</a><a href="#b" tabindex="2">b</a><button>c</button><input><div tabindex="0">d</div><div contenteditable="true">e</div><span data-de-ui=""><button tabindex="4">chrome</button></span><iframe title="f"></iframe><div data-edit-skip=""><a href="#s">skip</a></div>`;
    document.body.append(box);
    const before = box.outerHTML;
    const q = globalThis.__quietFocus(box);
    const tick = () => new Promise((r) => setTimeout(r, 30));
    const during = [...box.querySelectorAll("a, button, input, [tabindex], iframe, [contenteditable]")].map((e) => `${e.textContent || e.tagName}:${e.getAttribute("tabindex")}`);
    const added = document.createElement("a"); added.href = "#new"; added.textContent = "new"; box.append(added); await tick();
    const addedQuiet = added.getAttribute("tabindex");
    const own = box.querySelector('div[tabindex]'); own.setAttribute("tabindex", "7"); await tick();
    const reQuiet = own.getAttribute("tabindex");
    q.dispose();
    const ownAfter = own.getAttribute("tabindex"), addedAfter = added.getAttribute("tabindex");
    added.remove(); own.setAttribute("tabindex", "0");
    const after = box.outerHTML; box.remove();
    return { equal: before === after, during, addedQuiet, reQuiet, ownAfter, addedAfter };
  });
  ok("5a fixture: page controls quiet, chrome and skip zones untouched", fx.during.join(",") === "a:-1,b:-1,c:-1,INPUT:-1,d:-1,e:-1,chrome:4,IFRAME:-1,skip:null", fx.during.join(","));
  ok("5a fixture: a node a re-render adds is quieted", fx.addedQuiet === "-1");
  ok("5a fixture: a value the page's code sets again is quieted, and is the one put back", fx.reQuiet === "-1" && fx.ownAfter === "7");
  ok("5a fixture: after dispose the DOM is byte-equal (an added node keeps no tabindex)", fx.equal && fx.addedAfter === null, JSON.stringify(fx));
  for (let i = 0; i < 3; i++) { await p.keyboard.press("Escape"); await p.waitForTimeout(150); }

  // ── F. Save carries the edits, without resolver rows ──────────────────────
  await p.locator('.de-editbar [data-a="save"]').click(); await p.waitForTimeout(1500);
  const calls = await p.evaluate(() => JSON.parse(JSON.stringify(globalThis.__calls ?? [])));
  const save = calls.filter((c) => c[0] === "savePageAction").pop();
  const saved = save?.[1]?.[1];
  const steps = saved?.content?.find((n) => n.props?.id === "try-steps")?.props;
  ok("Save sends the page", !!saved, JSON.stringify(calls.map((c) => c[0])));
  ok("saved: heading and typed title", steps?.heading === "Joining" && steps?.steps?.[1]?.title === "Read this first", JSON.stringify(steps));
  ok("saved: the look from the inner popup", steps?.morph?.parts && JSON.stringify(steps.morph).includes("30"), JSON.stringify(steps?.morph));
  // Every data block, at any depth, without the keys its resolver fills (apps/sunjay/src/blocks/resolved-keys.ts).
  const FILLED = { "pt-standing": ["standing"], "pt-calendar": ["events"], "pt-profile": ["guide", "links"], "pt-threads": ["threads", "feedName"], "pt-forum": ["forum"], "pt-writing": ["items"], "pt-gallery": ["images"] };
  const leaks = [], seen = [];
  const walk = (list) => { for (const n of list ?? []) { if (FILLED[n.type]) { seen.push(n.type); for (const k of FILLED[n.type]) if (k in n.props) leaks.push(`${n.props.id}.${k}`); } for (const v of Object.values(n.props ?? {})) if (Array.isArray(v) && v[0]?.props) walk(v); } };
  walk(saved?.content);
  ok("saved: no resolver rows on any data block", seen.length >= 6 && leaks.length === 0, `checked ${seen.length}; leaks ${leaks.join(",") || "none"}`);
  fs.writeFileSync("/h/saved-inception.json", JSON.stringify(saved ?? null, null, 1));

  const real = errs.filter((e) => !/Failed to load resource|ERR_|net::/.test(e));
  ok("no page errors", real.length === 0, real.slice(0, 4).join(" || "));
  console.log(`\n${pass}/${pass + fail}`);
  srv.close(); process.exit(0);
})().catch((e) => { console.log("CRASH", e.stack); console.log(`\n${pass}/${pass + fail}`); process.exit(1); });
