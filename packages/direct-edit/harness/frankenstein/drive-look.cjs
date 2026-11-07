// Drives direct-edit's look panel (src/puck/look-panel.ts) mounted by page-builder's parts plugin in PuckEditor,
// on Para Theater's real config. Run: W=<scratch> bash run.sh frankenstein/entry-pkg.tsx:fk.js -- drive-look.cjs
const { chromium } = require("playwright-core");
const fs = require("fs");
const { serve } = require("./serve.cjs");
const page = `<!doctype html><meta charset=utf-8><link rel=stylesheet href=/site.css><link rel=stylesheet href=/fk.css><body><div id="host"></div><script src=/fk.js></script>`;
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { cond ? pass++ : fail++; console.log(`${cond ? "pass" : "  FAIL"} ${name}${extra ? "  " + extra : ""}`); };

(async () => {
  const srv = await serve("/h", page); fs.mkdirSync("/h/shots", { recursive: true });
  const b = await chromium.connectOverCDP("http://127.0.0.1:9222"); const p = b.contexts()[0].pages()[0];
  p.setDefaultTimeout(9000); await p.setViewportSize({ width: 1500, height: 950 });
  const errs = []; p.on("pageerror", (e) => errs.push((e.stack || e.message).slice(0, 300))); p.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 200)); });
  let f, frameEl;
  const open = async (q) => {
    await p.goto(`http://127.0.0.1:8123/${q}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    frameEl = await p.waitForSelector("iframe", { timeout: 20000 }); f = await frameEl.contentFrame();
    await f.waitForSelector('[data-puck-component="try-banner"]', { timeout: 20000 }); await p.waitForTimeout(1500);
  };
  const st = () => p.evaluate(() => { const s = globalThis.__getPuck(); return { sel: s.selectedItem?.props?.id ?? null, part: globalThis.__parts(), idx: s.history.index }; });
  const morphOf = (id) => p.evaluate((id) => globalThis.__getPuck().getItemById(id)?.props?.morph ?? null, id);
  const clickIn = async (sel, opts = {}) => { const r = await f.$eval(sel, (e) => { e.scrollIntoView({ block: "center" }); const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + Math.min(b.height / 2, 20), iw: innerWidth }; }); const fb = await frameEl.boundingBox(); const k = fb.width / r.iw; const alt = (opts.modifiers ?? []).includes("Alt"); if (alt) await p.keyboard.down("Alt"); await p.mouse.click(fb.x + r.x * k, fb.y + r.y * k); if (alt) await p.keyboard.up("Alt"); await p.waitForTimeout(400); };
  const css = (sel, prop) => f.$eval(sel, (e, prop) => getComputedStyle(e)[prop], prop);
  const P = ".eac-look-panel:visible";
  const B = '[data-puck-component="try-banner"]';
  const toTitle = async () => { await clickIn(`${B} h1`); await clickIn(`${B} h1`, { modifiers: ["Alt"] }); };

  // A. Everyone (developer off).
  await open("?panel=look");
  await toTitle();
  ok("Alt+click into the banner's Title", (await st()).part?.part === "title", JSON.stringify(await st()));
  ok("direct-edit's panel mounted in Puck's right column", (await p.locator(".eac-look-panel.de-panel:visible").count()) === 1);
  const text = await p.locator(P).innerText();
  ok("Properties sections: Size, Layout, Text, Appearance, Effects", ["Size", "Layout", "Text", "Appearance", "Effects"].every((w) => text.includes(w)), text.slice(0, 160).replace(/\s+/g, " "));
  ok("layer tree: the block on top", /Banner/.test(await p.locator(`${P} [data-layer="root"]`).innerText().catch(() => "")));
  ok("layer tree: Title row present and selected", (await p.locator(`${P} li.on [data-layer="title"], ${P} [data-layer="title"].on`).count()) >= 1 || (await p.locator(`${P} [data-layer="title"]`).evaluate((e) => !!e.closest(".on"))).valueOf(), "");
  const depth = await p.locator(`${P} [data-layer="title"]`).evaluate((e) => { const li = e.closest("li"); return li ? getComputedStyle(li).paddingLeft + "|" + (li.getAttribute("style") ?? "") : "?"; });
  console.log("  title row indent:", depth);
  ok("no Code tab for everyone", (await p.locator(`${P} [data-tab="code"]`).count()) === 0);
  ok("live contrast shown for the text colour", /:1|AA|contrast/i.test(text), "");
  await p.screenshot({ path: "/h/shots/look-01-title.png" });

  // A change through the canvas panel's own field writes the morph through Puck: one step.
  const i0 = (await st()).idx;
  await p.locator(`${P} input[data-k="size"]`).fill("60"); await p.keyboard.press("Enter"); await p.waitForTimeout(500);
  ok("Size field draws on the title", (await css(`${B} h1`, "fontSize")) === "60px", await css(`${B} h1`, "fontSize"));
  ok("stored as morph.parts.title.size", (await morphOf("try-banner"))?.parts?.title?.size === 60, JSON.stringify(await morphOf("try-banner")));
  ok("one history step", (await st()).idx === i0 + 1, `${i0} -> ${(await st()).idx}`);
  await p.locator(`${P} input[data-k="size"]`).click(); await p.keyboard.press("Control+a");
  for (const ch of "72") { await p.keyboard.type(ch); await p.waitForTimeout(400); }
  await p.locator(`${P} .de-sec-title`).first().click(); await p.waitForTimeout(400);
  ok("typing slowly in a panel field: one more step", (await st()).idx === i0 + 2 && (await morphOf("try-banner"))?.parts?.title?.size === 72, `${(await st()).idx} ${JSON.stringify(await morphOf("try-banner"))}`);
  await p.evaluate(() => globalThis.__getPuck().history.back()); await p.waitForTimeout(400);
  ok("one undo takes the whole spell back to 60", (await morphOf("try-banner"))?.parts?.title?.size === 60);

  // Layer tree: select, hover, hide.
  await p.locator(`${P} [data-layer="image"]`).click(); await p.waitForTimeout(400);
  ok("row click selects the Photograph part", (await st()).part?.part === "image", JSON.stringify((await st()).part));
  await p.locator(`${P} [data-layer="button"]`).hover(); await p.waitForTimeout(300);
  ok("row hover outlines that part in the canvas", (await f.locator('[data-eac-part-mark="button"][data-over]').count()) >= 1);
  const i1 = (await st()).idx;
  await p.locator(`${P} [data-hide="subtitle"]`).click(); await p.waitForTimeout(400);
  ok("eye hides the Subtitle (faint in the editor)", (await morphOf("try-banner"))?.parts?.subtitle?.hide === true && Number(await css(`${B} h1 + p`, "opacity")) < 0.5, await css(`${B} h1 + p`, "opacity"));
  ok("hide is one step", (await st()).idx === i1 + 1);
  await p.evaluate(() => globalThis.__getPuck().history.back()); await p.waitForTimeout(400);
  ok("undo shows it again", !(await morphOf("try-banner"))?.parts?.subtitle?.hide);

  // Layout on a part: Words as a row.
  await p.locator(`${P} [data-layer="copy"]`).click(); await p.waitForTimeout(400);
  const layoutSel = p.locator(`${P} select[data-k="layout"]`);
  if (await layoutSel.count()) {
    await layoutSel.selectOption({ label: "Stack" }).catch(async () => layoutSel.selectOption("\"stack\""));
    await p.waitForTimeout(500);
    ok("Layout Stack on Words draws flex", (await css(`${B} section > div:last-child`, "display")) === "flex", await css(`${B} section > div:last-child`, "display"));
  } else ok("Layout field on Words", false, "no select[data-k=layout]");
  await p.screenshot({ path: "/h/shots/look-02-words.png" });
  const wf = await p.locator(`${P} input[data-k="wpx"]`).evaluate((e) => ({ v: e.value, cw: e.clientWidth, sw: e.scrollWidth, num: e.parentElement.getBoundingClientRect().width, row: e.closest(".de-row")?.getBoundingClientRect().width, panel: e.closest(".de-panel").getBoundingClientRect().width })).catch((e) => ({ err: String(e).slice(0, 80) }));
  ok("Width field shows its whole value in Puck's column", wf.sw !== undefined && wf.sw <= wf.cw + 1, JSON.stringify(wf));

  // Tweaks on a block that declares tokens.
  const tokType = await p.evaluate(() => Object.entries(globalThis.__contract).find(([, c]) => c?.tokens?.length && c.parts)?.[0]);
  const tokNode = await p.evaluate((t) => { const out = []; const walk = (l) => l.forEach((n) => { if (n.type === t) out.push(n.props.id); Object.values(n.props).forEach((v) => Array.isArray(v) && v[0]?.type && walk(v)); }); walk(globalThis.__getPuck().appState.data.content); return out[0]; }, tokType);
  if (tokNode) {
    // Selected through Puck's API: the block sits below the fold of the zoomed canvas.
    const first = await p.evaluate(([id, t]) => { const g = globalThis.__getPuck(); g.dispatch({ type: "setUi", ui: { itemSelector: g.getSelectorForId(id) } }); return Object.keys(globalThis.__contract[t].parts)[0]; }, [tokNode, tokType]);
    await p.waitForTimeout(400);
    await p.evaluate(([id, part]) => globalThis.__setPart({ id, part }), [tokNode, first]); await p.waitForTimeout(500);
    const tab = p.locator(`${P} [data-tab="tweaks"]`);
    ok(`Tweaks tab on ${tokType}`, (await tab.count()) === 1, JSON.stringify(await st()));
    if (await tab.count()) {
      await tab.click(); await p.waitForTimeout(300);
      const field = p.locator(`${P} input[data-k="t:--blk-accent"][data-hex], ${P} input[data-k="t:--blk-accent"]`).first();
      if (await field.count()) {
        await field.fill("#aa3300"); await p.keyboard.press("Enter"); await p.waitForTimeout(500);
        ok("Accent token stored in morph.tokens", (await morphOf(tokNode))?.tokens?.["--blk-accent"] === "#aa3300", JSON.stringify(await morphOf(tokNode)));
      } else ok("Accent token field", false, (await p.locator(P).innerText()).slice(0, 200));
      await p.screenshot({ path: "/h/shots/look-03-tweaks.png" });
    }
  } else console.log("  (no block in the seed declares tokens and parts; Tweaks not checked)");

  await p.locator("[data-eac-part-back]:visible").click(); await p.waitForTimeout(300);
  ok("← Block settings above the look panel goes back to Puck's fields", !(await st()).part && (await p.locator(".eac-look-panel:visible").count()) === 0);
  ok("no page errors", errs.filter((e) => !/ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(e)).length === 0, [...new Set(errs)].slice(0, 3).join(" | "));

  // B. Developer on: the Code tab.
  errs.length = 0;
  await open("?panel=look&dev=1");
  await toTitle();
  const code = p.locator(`${P} [data-tab="code"]`);
  ok("Code tab for developers", (await code.count()) === 1);
  if (await code.count()) {
    await code.click(); await p.waitForTimeout(300);
    const sheet = p.locator(`${P} textarea[data-cssall]`);
    ok("Code tab has the editable sheet", (await sheet.count()) === 1);
    if (await sheet.count()) {
      await sheet.fill("letter-spacing: 0.05em;\nposition: fixed;"); await p.waitForTimeout(700);
      ok("refused line named Not kept while typing", /Not kept: position/.test(await p.locator(P).innerText()));
      await code.click(); await p.waitForTimeout(400); // blur
      const m = await morphOf("try-banner");
      ok("typed declarations kept in the look, refused dropped", /letter-spacing/.test(m?.parts?.title?.css ?? "") && !/position/.test(m?.parts?.title?.css ?? ""), JSON.stringify(m));
      ok("after leaving the sheet, only what was kept is stored and shown", (await sheet.inputValue()).includes("letter-spacing") && !(await sheet.inputValue()).includes("position"), await sheet.inputValue());
      // Give the banner (its root part) an ink: Words then takes its colour from the section, "From <section>" with "+".
      // (Values that come from the page's body are not listed, as on the canvas.)
      await p.locator(`${P} [data-layer="root"]`).click(); await p.waitForTimeout(400);
      await p.locator(`${P} [data-tab="props"]`).click(); await p.waitForTimeout(200);
      const ink = p.locator(`${P} input[data-k="color"][data-hex]`).first();
      if (!(await ink.count())) await p.locator(`${P} .de-sec`).filter({ hasText: "Text" }).locator("[data-more], button[title*='more' i], .de-plus").first().click().catch(() => {});
      await ink.fill("#ffeecc"); await p.keyboard.press("Enter"); await p.waitForTimeout(400);
      console.log("  banner look:", JSON.stringify((await morphOf("try-banner"))?.parts?.root));
      await p.locator(`${P} [data-layer="copy"]`).click(); await p.waitForTimeout(400);
      await p.locator(`${P} [data-tab="code"]`).click(); await p.waitForTimeout(300);
      const from = await p.locator(`${P} .de-from`).allInnerTexts();
      ok("From groups listed with + (Words)", from.length > 0 && (await p.locator(`${P} [data-adopt-prop]`).count()) > 0, from.join(" | ").replace(/\s+/g, " ").slice(0, 160));
    }
    await p.screenshot({ path: "/h/shots/look-04-code.png" });
  }
  ok("no page errors (developer)", errs.filter((e) => !/ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(e)).length === 0, [...new Set(errs)].slice(0, 3).join(" | "));
  console.log(`\nlook ${pass}/${pass + fail}`);
  await b.close(); srv.close(); process.exit(0);
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
