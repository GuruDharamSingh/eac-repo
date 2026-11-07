// Drives the packaged parts plugin (packages/page-builder/src/parts) inside page-builder's PuckEditor
// on Para Theater's real config. Run: W=<scratch> bash run.sh frankenstein/entry-pkg.tsx:fk.js -- drive-pkg.cjs
const { chromium } = require("playwright-core");
const fs = require("fs");
const { serve, fetched } = require("./serve.cjs");
const page = `<!doctype html><meta charset=utf-8><link rel=stylesheet href=/site.css><link rel=stylesheet href=/fk.css><body><div id="host"></div><script src=/fk.js></script>`;
let pass = 0, fail = 0;
const canon = (v) => JSON.stringify(v, (k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((y) => [y, x[y]])) : x));
const ok = (name, cond, extra = "") => { cond ? pass++ : fail++; console.log(`${cond ? "pass" : "  FAIL"} ${name}${extra ? "  " + extra : ""}`); };

(async () => {
  const srv = await serve("/h", page); fs.mkdirSync("/h/shots", { recursive: true });
  const b = await chromium.connectOverCDP("http://127.0.0.1:9222"); const p = b.contexts()[0].pages()[0];
  p.setDefaultTimeout(9000); await p.setViewportSize({ width: 1500, height: 950 });
  const errs = [], warns = []; p.on("pageerror", (e) => errs.push((e.stack || e.message).slice(0, 300)));
  p.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 200)); if (m.type() === "warning") warns.push(m.text().slice(0, 120)); });
  await p.goto("http://127.0.0.1:8123/?dev=1", { waitUntil: "domcontentloaded", timeout: 60000 });
  const frameEl = await p.waitForSelector("iframe", { timeout: 20000 });
  const f = await frameEl.contentFrame();
  await f.waitForSelector('[data-puck-component="try-banner"]', { timeout: 20000 }).catch(async () => { console.log("no banner; errors", errs.slice(0, 5)); await p.screenshot({ path: "/h/shots/pk-00-fail.png" }); process.exit(1); });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: "/h/shots/pk-01-open.png" });
  const st = () => p.evaluate(() => { const s = globalThis.__getPuck(); return { sel: s.selectedItem?.props?.id ?? null, part: globalThis.__parts(), idx: s.history.index, n: s.history.histories.length }; });
  const morphOf = (id) => p.evaluate((id) => globalThis.__getPuck().getItemById(id)?.props?.morph ?? null, id);
  // Puck zooms the iframe (CSS scale): canvas coordinates are scaled to page coordinates.
  const clickIn = async (sel, opts = {}) => { const r = await f.$eval(sel, (e) => { e.scrollIntoView({ block: "center" }); const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + Math.min(b.height / 2, 20), iw: innerWidth }; }); const fb = await frameEl.boundingBox(); const k = fb.width / r.iw; const alt = (opts.modifiers ?? []).includes("Alt"); if (alt) await p.keyboard.down("Alt"); await p.mouse.click(fb.x + r.x * k, fb.y + r.y * k); if (alt) await p.keyboard.up("Alt"); await p.waitForTimeout(400); };
  const css = (sel, prop) => f.$eval(sel, (e, prop) => getComputedStyle(e)[prop], prop);
  const panel = () => p.locator("[data-eac-part-panel]:visible");
  const ctl = (k) => p.locator(`[data-eac-part-ctl="${k}"]:visible`);
  const B = '[data-puck-component="try-banner"]';
  // The banner's Title, however the selection stands.
  const toTitle = async () => {
    if ((await st()).sel !== "try-banner") await clickIn(`${B} h1`);
    if (!(await st()).part) await clickIn(`${B} h1`);
    await p.locator('[data-eac-part-chip="title"]:visible').click(); await p.waitForTimeout(200);
  };

  // 1. Selection: Puck selects the block, the second click picks a part.
  await clickIn(`${B} h1`);
  let s = await st();
  ok("first click selects the banner (Puck)", s.sel === "try-banner" && !s.part, JSON.stringify(s));
  ok("block fields show (no part panel)", (await panel().count()) === 0);
  await clickIn(`${B} h1`);
  s = await st();
  ok("second click on the heading picks the outermost part there (Words)", s.part?.part === "copy", JSON.stringify(s.part));
  await clickIn(`${B} h1`);
  s = await st();
  ok("third click goes one part deeper (Title)", s.part?.part === "title", JSON.stringify(s.part));
  await clickIn(`${B} h1`);
  ok("a further click on the deepest part stays on it", (await st()).part?.part === "title");
  ok("part panel shows, block fields hidden", (await panel().count()) === 1);
  ok("outline marks drawn in canvas", (await f.locator("[data-eac-part-mark]").count()) >= 3, String(await f.locator("[data-eac-part-mark]").count()));
  ok("selected mark is the title, with its name", (await f.locator('[data-eac-part-mark="title"][data-on] .eac-part-mark-label').innerText().catch(() => "")) === "Title");

  // Styled panel, in Puck's right column.
  // Para Theater's sheet sets `border-radius: 0 !important` on everything, Puck's own buttons included, so corners follow Puck's.
  const look = await p.locator("[data-eac-part-back]:visible").evaluate((e) => { const c = getComputedStyle(e); return { color: c.color, radius: c.borderTopLeftRadius, border: c.borderTopStyle, font: c.fontFamily }; });
  const puckBtn = await p.locator("header").getByText("Publish", { exact: true }).evaluate((e) => { const b = e.closest("button,a") || e; const c = getComputedStyle(b); return { radius: c.borderTopLeftRadius, font: getComputedStyle(document.querySelector("header")).fontFamily }; });
  ok("back button styled as Puck's (azure text, solid border, Puck's corners and font)", look.color === "rgb(1, 88, 173)" && look.border === "solid" && look.radius === puckBtn.radius && look.font === puckBtn.font, JSON.stringify([look, puckBtn]));
  const pb = await panel().boundingBox(), fb0 = await frameEl.boundingBox();
  ok("panel sits right of the canvas", pb && fb0 && pb.x >= fb0.x + fb0.width - 2, `${pb?.x} vs ${fb0?.x + fb0?.width}`);
  ok("section titles drawn", (await p.locator(".eac-parts-section-title:visible").count()) >= 4);
  await p.screenshot({ path: "/h/shots/pk-02-part.png" });

  // A cousin: from Title, a click on the button goes to the part inside the part both share (Words > Button).
  await clickIn(`${B} a`);
  ok("click on a cousin (the button) picks Button", (await st()).part?.part === "button", JSON.stringify((await st()).part));
  await p.evaluate(() => globalThis.__setPart(null)); await p.waitForTimeout(200);
  await clickIn(`${B} h1`, { modifiers: ["Alt"] });
  ok("Alt+click from the block goes straight to the deepest part (Title)", (await st()).part?.part === "title", JSON.stringify((await st()).part));
  await p.locator('[data-eac-part-chip="title"]:visible').click();
  ok("chip in the panel selects title", (await st()).part?.part === "title");
  ok("selected chip is pressed", (await p.locator('[data-eac-part-chip="title"]:visible').getAttribute("aria-pressed")) === "true");

  // 2. Edit: fill and size, written as morph through Puck's replace.
  const before = (await st()).idx;
  const before0 = { bg: await css(`${B} h1`, "backgroundColor"), fs: await css(`${B} h1`, "fontSize") };
  ok("size field shows what the page draws as placeholder", (await ctl("size").getAttribute("placeholder")) === String(parseFloat(before0.fs)), await ctl("size").getAttribute("placeholder"));
  await ctl("fill").fill("#b85c3a"); await p.keyboard.press("Enter"); await p.waitForTimeout(400);
  ok("fill drawn on the title", (await css(`${B} h1`, "backgroundColor")) === "rgb(184, 92, 58)", await css(`${B} h1`, "backgroundColor"));
  ok("fill: one history step", (await st()).idx === before + 1, `${before} -> ${(await st()).idx}`);
  await ctl("size").fill("64"); await p.keyboard.press("Enter"); await p.waitForTimeout(400);
  ok("size drawn on the title", (await css(`${B} h1`, "fontSize")) === "64px", await css(`${B} h1`, "fontSize"));
  let m = await morphOf("try-banner");
  ok("stored as props.morph", JSON.stringify(m) === JSON.stringify({ v: 1, parts: { title: { fill: "#b85c3a", size: 64 } } }), JSON.stringify(m));
  ok("other parts untouched", (await css(`${B} a`, "fontSize")) !== "64px");
  ok("part stays selected after the edit", (await st()).part?.part === "title");
  const expected = await p.evaluate(() => { const o = {}; globalThis.__lib.setPartLook(o, "title", { fill: "#b85c3a", size: 64 }); return o.morph; });
  ok("same morph as direct-edit's setPartLook", JSON.stringify(expected) === JSON.stringify(m));
  ok("survives the server cleaner (cleanMorph)", canon(await p.evaluate((m) => globalThis.__lib.cleanMorph(m), m)) === canon(m));
  ok("two edits, two history steps", (await st()).idx === before + 2, `${before} -> ${(await st()).idx}`);

  // 3. Undo / redo through Puck's own history.
  await p.evaluate(() => globalThis.__getPuck().history.back()); await p.waitForTimeout(400);
  ok("undo removes the size", (await css(`${B} h1`, "fontSize")) === before0.fs && (await css(`${B} h1`, "backgroundColor")) === "rgb(184, 92, 58)", await css(`${B} h1`, "fontSize"));
  ok("panel field follows undo", (await ctl("size").inputValue()) === "", await ctl("size").inputValue().catch(() => "?"));
  await p.evaluate(() => globalThis.__getPuck().history.back()); await p.waitForTimeout(400);
  ok("second undo removes the morph", (await morphOf("try-banner")) === null && (await css(`${B} h1`, "backgroundColor")) === before0.bg, JSON.stringify(await morphOf("try-banner")));
  await p.evaluate(() => { const h = globalThis.__getPuck().history; h.forward(); h.forward(); }); await p.waitForTimeout(400);
  ok("redo brings both back", JSON.stringify(await morphOf("try-banner")) === JSON.stringify(m));
  await clickIn(`${B} h1`);
  await p.keyboard.press("Control+z"); await p.waitForTimeout(400);
  ok("Ctrl+Z undoes (Puck hotkey)", (await css(`${B} h1`, "fontSize")) === before0.fs, await css(`${B} h1`, "fontSize"));
  await p.keyboard.press("Control+Shift+z"); await p.waitForTimeout(400);
  ok("Ctrl+Shift+Z redoes", (await css(`${B} h1`, "fontSize")) === "64px", await css(`${B} h1`, "fontSize"));

  // 4. One spell of typing = one undo step, however slow.
  await toTitle();
  const i0 = (await st()).idx;
  await ctl("tracking").click();
  for (const ch of "0.12") { await p.keyboard.type(ch); await p.waitForTimeout(400); } // slower than Puck's 250 ms debounce
  ok("typing draws as it goes", Math.abs(parseFloat(await css(`${B} h1`, "letterSpacing")) - 0.12 * 64) < 0.5, await css(`${B} h1`, "letterSpacing"));
  ok("no history step while typing", (await st()).idx === i0, `${i0} -> ${(await st()).idx}`);
  await p.locator(".eac-parts-title:visible").click(); await p.waitForTimeout(400); // blur
  ok("blur ends the spell: one step", (await st()).idx === i0 + 1, `${i0} -> ${(await st()).idx}`);
  await p.evaluate(() => globalThis.__getPuck().history.back()); await p.waitForTimeout(400);
  ok("one undo removes the whole spell, size stays", (await morphOf("try-banner"))?.parts?.title?.tracking === undefined && (await css(`${B} h1`, "fontSize")) === "64px", JSON.stringify(await morphOf("try-banner")));
  // Ctrl+Z inside a field mid-spell puts the spell back and leaves the step before it.
  await ctl("tracking").click(); await p.keyboard.type("0.3"); await p.waitForTimeout(300);
  await p.keyboard.press("Control+z"); await p.waitForTimeout(400);
  const mz = await morphOf("try-banner");
  ok("Ctrl+Z in a field mid-spell reverts only the spell", mz?.parts?.title?.tracking === undefined && mz?.parts?.title?.size === 64 && (await ctl("tracking").inputValue()) === "", JSON.stringify(mz));
  // Typing then clicking Puck's own undo button straight away.
  const undoBtn = p.locator('button[title="Undo"]:visible, button[aria-label="Undo"]:visible, button[title="undo" i]:visible').first();
  if (await undoBtn.count()) {
    await ctl("radius").click(); await p.keyboard.type("12"); await p.waitForTimeout(150);
    await undoBtn.click(); await p.waitForTimeout(500);
    const mu = await morphOf("try-banner");
    ok("type then click Puck's undo at once: the spell goes, the step before stays", mu?.parts?.title?.radius === undefined && mu?.parts?.title?.size === 64, JSON.stringify(mu));
  } else console.log("  (no undo button found in Puck's header; check skipped)");

  // 5. CSS box: kept and not kept.
  await toTitle();
  await ctl("css").fill("text-decoration: underline; position: fixed; color: #123456"); await p.locator(".eac-parts-title:visible").click(); await p.waitForTimeout(400);
  const kept = await p.locator("[data-eac-part-kept]:visible").innerText().catch(() => "");
  const refused = await p.locator("[data-eac-part-refused]:visible").innerText().catch(() => "");
  ok("CSS box shows what was kept", /text-decoration: underline/.test(kept) && /color: #123456/.test(kept) && !/position/.test(kept), kept);
  ok("CSS box names what was not kept", /position: fixed/.test(refused), refused);
  ok("kept declarations drawn, refused not", (await css(`${B} h1`, "textDecorationLine")) === "underline" && (await css(`${B} h1`, "position")) !== "fixed", await css(`${B} h1`, "position"));
  await p.screenshot({ path: "/h/shots/pk-03-css.png" });

  // 6. Esc: part to block, from the canvas and from the panel.
  await toTitle(); await clickIn(`${B} h1`);
  await p.keyboard.press("Escape"); await p.waitForTimeout(300);
  s = await st();
  ok("Esc in the canvas: Title out to Words", s.part?.part === "copy" && s.sel === "try-banner", JSON.stringify(s));
  await p.keyboard.press("Enter"); await p.waitForTimeout(300);
  ok("Enter in the canvas: Words in to its first part (Title)", (await st()).part?.part === "title", JSON.stringify((await st()).part));
  await p.keyboard.press("Escape"); await p.keyboard.press("Escape"); await p.waitForTimeout(300);
  s = await st();
  ok("Esc again: Words out to the block, block still selected", !s.part && s.sel === "try-banner" && (await panel().count()) === 0, JSON.stringify(s));
  await toTitle();
  await ctl("size").click(); await p.keyboard.press("Escape"); await p.waitForTimeout(300);
  s = await st();
  ok("Esc in a panel field: one level out (Words)", s.part?.part === "copy" && s.sel === "try-banner", JSON.stringify(s));
  await p.locator("[data-eac-part-back]:visible").click(); await p.waitForTimeout(300);
  ok("← Block settings goes back to the block's fields", !(await st()).part && (await panel().count()) === 0);

  // 7. Nested: the feed cards inside a band.
  const C = '[data-puck-component="try-feed-cards"]';
  await p.evaluate(() => { const g = globalThis.__getPuck(); g.dispatch({ type: "setUi", ui: { itemSelector: g.getSelectorForId("try-feed-band") } }); }); await p.waitForTimeout(500);
  ok("band selected", (await st()).sel === "try-feed-band");
  ok("band's test part does not reach the nested cards' heading", (await f.locator('[data-eac-part-mark="heading"]').count()) === 0, String(await f.locator('[data-eac-part-mark="heading"]').count()));
  await clickIn(`${C} h2`);
  s = await st();
  ok("click on the nested heading selects the cards (Puck), no band part", s.sel === "try-feed-cards" && !s.part, JSON.stringify(s));
  await clickIn(`${C} h2`);
  s = await st();
  ok("second click picks the cards' own heading", s.sel === "try-feed-cards" && s.part?.part === "heading", JSON.stringify(s));
  ok("the cards' heading mark is drawn", (await f.locator('[data-eac-part-mark="heading"][data-on]').count()) === 1);
  ok("repeated part shows its count in the chips", /×\d/.test(await p.locator('[data-eac-part-chip="card"]:visible').innerText().catch(() => "")));
  await p.screenshot({ path: "/h/shots/pk-04-nested.png" });

  ok("resolvers fetched rows on open", fetched.length > 0, fetched.slice(0, 3).join(" "));

  // 8. Publish.
  await p.locator("header").getByText("Publish", { exact: true }).click(); await p.waitForTimeout(1200);
  const pub = await p.evaluate(() => globalThis.__published);
  ok("publish handed the document out", !!pub);
  if (pub) {
    const banner = pub.content.find((n) => n.props.id === "try-banner");
    const bm = banner?.props?.morph;
    ok("published banner carries the morph", bm?.parts?.title?.size === 64 && bm?.parts?.title?.fill === "#b85c3a", JSON.stringify(bm));
    const cleaned = await p.evaluate((d) => JSON.stringify(globalThis.__lib.cleanBoxDoc(d).content.find((n) => n.props.id === "try-banner").props.morph), pub);
    ok("cleanBoxDoc keeps the morph (css cleaned)", JSON.parse(cleaned)?.parts?.title?.size === 64, cleaned);
    fs.writeFileSync("/h/published.json", JSON.stringify(pub, null, 1));
  }

  // 9. Phone viewport.
  await p.evaluate(() => { const s = globalThis.__getPuck(); s.dispatch({ type: "setUi", ui: { viewports: { ...s.appState.ui.viewports, current: { width: 360, height: "auto" } } } }); });
  await p.waitForTimeout(900);
  await clickIn(`${B} h1`); await clickIn(`${B} h1`, { modifiers: ["Alt"] });
  ok("part pick works at phone width", (await st()).part?.part === "title", JSON.stringify(await st()));
  const markOk = await f.evaluate(() => { const m = document.querySelector('[data-eac-part-mark="title"]'); const t = document.querySelector('[data-puck-component="try-banner"] h1'); if (!m || !t) return false; const a = m.getBoundingClientRect(), b = t.getBoundingClientRect(); return Math.abs(a.x - b.x) < 2 && Math.abs(a.width - b.width) < 2; });
  ok("outline sits on the title at phone width", markOk);
  await p.screenshot({ path: "/h/shots/pk-05-phone.png" });

  const realErrs = errs.filter((e) => !/ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(e));
  ok("no page errors (offline image loads excluded)", realErrs.length === 0, [...new Set(realErrs)].slice(0, 4).join(" | "));
  console.log(`  warnings: ${warns.length}; "set is expensive": ${warns.filter((w) => /expensive/.test(w)).length}`);
  console.log(`\nparity ${pass}/${pass + fail}`);
  await b.close(); srv.close(); process.exit(0);
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
