// Lane LIVE (2026-11-20): the When and Screen switches in the look panel, headless, on Para Theater's real editor config.
//   in Puck's right column (direct-edit's mountLookPanel, as sunjay mounts it) and in the block popup (the canvas's own panel).
// Run: W=<scratch> bash run.sh frankenstein/entry-where.tsx:fkw.js -- drive-where.cjs
const { chromium } = require("playwright-core");
const fs = require("fs");
const { serve } = require("./serve.cjs");
const page = `<!doctype html><meta charset=utf-8><link rel=stylesheet href=/site.css><link rel=stylesheet href=/fkw.css><body><div id="host"></div><script src=/fkw.js></script>`;
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { cond ? pass++ : fail++; console.log(`${cond ? "pass" : "  FAIL"} ${name}${extra ? "  " + extra : ""}`); };

(async () => {
  const srv = await serve("/h", page); fs.mkdirSync("/h/shots", { recursive: true });
  const b = await chromium.connectOverCDP("http://127.0.0.1:9222"); const p = b.contexts()[0].pages()[0];
  p.setDefaultTimeout(9000); await p.setViewportSize({ width: 1500, height: 950 });
  const errs = []; p.on("pageerror", (e) => errs.push((e.stack || e.message).slice(0, 300))); p.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 200)); });
  let f, frameEl;
  const open = async (q = "") => {
    await p.goto(`http://127.0.0.1:8123/${q}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    frameEl = await p.waitForSelector("iframe", { timeout: 20000 }); f = await frameEl.contentFrame();
    await f.waitForSelector('[data-puck-component="try-banner"]', { timeout: 20000 }); await p.waitForTimeout(1500);
  };
  const st = () => p.evaluate(() => { const s = globalThis.__getPuck(); return { sel: s.selectedItem?.props?.id ?? null, part: globalThis.__parts(), idx: s.history.index }; });
  const morphOf = (id) => p.evaluate((id) => globalThis.__getPuck().getItemById(id)?.props?.morph ?? null, id);
  const clickIn = async (sel, opts = {}) => { const r = await f.$eval(sel, (e) => { e.scrollIntoView({ block: "center" }); const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + Math.min(b.height / 2, 20), iw: innerWidth }; }); const fb = await frameEl.boundingBox(); const k = fb.width / r.iw; const alt = (opts.modifiers ?? []).includes("Alt"); if (alt) await p.keyboard.down("Alt"); await p.mouse.click(fb.x + r.x * k, fb.y + r.y * k); if (alt) await p.keyboard.up("Alt"); await p.waitForTimeout(400); };
  const css = (sel, prop) => f.$eval(sel, (e, prop) => getComputedStyle(e)[prop], prop);
  const attr = (sel, name) => f.$eval(sel, (e, name) => e.getAttribute(name), name);
  const P = ".eac-look-panel:visible";
  const B = '[data-puck-component="try-banner"]';
  const W = `${P} .de-where`;
  const toTitle = async () => { await clickIn(`${B} h1`); await clickIn(`${B} h1`, { modifiers: ["Alt"] }); };
  const pressed = () => p.locator(`${W} button[aria-pressed="true"]`).allInnerTexts();
  const sw = (pick) => p.locator(`${W} [data-where="${pick}"]`);
  const choose = async (pick) => { await sw(pick).click(); await p.waitForTimeout(450); };
  const setSize = async (n) => { await p.locator(`${P} input[data-k="size"]`).fill(String(n)); await p.keyboard.press("Enter"); await p.waitForTimeout(500); };
  const baseSize = async () => (await morphOf("try-banner"))?.parts?.title?.size;

  // ── A. Puck's right column ─────────────────────────────────────────────────
  await open();
  await toTitle();
  ok("Alt+click into the banner's Title", (await st()).part?.part === "title", JSON.stringify(await st()));
  const text = (await p.locator(P).innerText()).replace(/\s+/g, " ");
  ok("the switches are in the panel, in plain words", ["When", "Screen", "Always", "On hover", "On focus", "On press", "Every size", "Phones", "Tablets"].every((w) => text.includes(w)), text.slice(0, 200));
  ok("no jargon on them", !/media quer|pseudo|:hover|focus-visible|breakpoint|CSS/i.test(await p.locator(W).innerText()));
  ok("the default is Always and Every size", JSON.stringify((await pressed()).map((s) => s.trim())) === JSON.stringify(["Always", "Every size"]), JSON.stringify(await pressed()));
  ok("a part with no look has no dots", (await p.locator(`${W} .de-dot`).count()) === 0);

  // Default behaviour: exactly what the panel did before.
  const i0 = (await st()).idx;
  await setSize(60);
  ok("Always + Every size: a Size draws and is stored as morph.parts.title.size, as before", (await css(`${B} h1`, "fontSize")) === "60px" && (await baseSize()) === 60, JSON.stringify(await morphOf("try-banner")));
  ok("…with no states and no sizes in the stored look", (() => { return true; })() && !("states" in ((await morphOf("try-banner")).parts.title)) && !("at" in ((await morphOf("try-banner")).parts.title)));
  ok("…one history step", (await st()).idx === i0 + 1);
  ok("a dot marks Always and Every size now (the base holds a look)", (await p.locator(`${W} .de-dot`).count()) === 2);

  // On hover.
  const i1 = (await st()).idx;
  await choose("state:hover");
  ok("On hover is pressed, Every size still is", JSON.stringify((await pressed()).map((s) => s.replace(/\s+/g, " ").trim())) === JSON.stringify(["On hover", "Every size"]), JSON.stringify(await pressed()));
  ok("choosing a switch writes nothing and takes no history step", (await st()).idx === i1 && (await baseSize()) === 60);
  ok("the editor shows the state: the title is marked while it is edited", (await attr(`${B} h1`, "data-de-force")) === "hover", String(await attr(`${B} h1`, "data-de-force")));
  await setSize(80);
  const mh = await morphOf("try-banner");
  ok("a Size typed on hover is stored under states.hover and the base look is kept", mh?.parts?.title?.states?.hover?.size === 80 && mh?.parts?.title?.size === 60, JSON.stringify(mh));
  ok("the preview shows the hover look without a mouse over it", (await css(`${B} h1`, "fontSize")) === "80px", await css(`${B} h1`, "fontSize"));
  ok("one history step", (await st()).idx === i1 + 1);
  ok("a dot on On hover now", (await p.locator(`${W} [data-where="state:hover"] .de-dot`).count()) === 1 && (await p.locator(`${W} [data-where="state:focus"] .de-dot`).count()) === 0);
  await p.screenshot({ path: "/h/shots/where-01-hover.png" });
  await choose("state:");
  ok("back to Always: the mark is gone and the title draws its base look", (await attr(`${B} h1`, "data-de-force")) === null && (await css(`${B} h1`, "fontSize")) === "60px", `${await attr(`${B} h1`, "data-de-force")} ${await css(`${B} h1`, "fontSize")}`);
  await p.locator(`${P} input[data-k="size"]`).waitFor();
  ok("the Size field is the base look's again", (await p.locator(`${P} input[data-k="size"]`).inputValue()) === "60", await p.locator(`${P} input[data-k="size"]`).inputValue());

  // Phones and tablets: one at a time with a state.
  await choose("at:sm");
  ok("Phones: pressed, and On hover is not (a state and a size are never chosen together)", (await pressed()).map((s) => s.replace(/\s+/g, " ").trim()).join() === "Always,Phones", JSON.stringify(await pressed()));
  ok("phones are drawn as phones in the editor (both sizes in force)", (await attr(`${B} h1`, "data-de-at")) === "sm md");
  await setSize(24);
  const ms = await morphOf("try-banner");
  ok("a Size typed on Phones is stored under at.sm", ms?.parts?.title?.at?.sm?.size === 24 && ms?.parts?.title?.states?.hover?.size === 80 && ms?.parts?.title?.size === 60, JSON.stringify(ms));
  ok("the editor canvas (wider than a phone) shows the phone look while it is edited", (await css(`${B} h1`, "fontSize")) === "24px", await css(`${B} h1`, "fontSize"));
  await choose("at:md");
  ok("Tablets: only the tablet size is in force", (await attr(`${B} h1`, "data-de-at")) === "md" && (await css(`${B} h1`, "fontSize")) === "60px", `${await attr(`${B} h1`, "data-de-at")} ${await css(`${B} h1`, "fontSize")}`);
  await setSize(40);
  ok("tablets stored under at.md", (await morphOf("try-banner"))?.parts?.title?.at?.md?.size === 40);
  ok("the two sizes and the state keep a dot each, nothing else does", (await p.locator(`${W} [data-where="at:sm"] .de-dot`).count()) === 1 && (await p.locator(`${W} [data-where="at:md"] .de-dot`).count()) === 1 && (await p.locator(`${W} [data-where="state:hover"] .de-dot`).count()) === 1 && (await p.locator(`${W} [data-where="state:active"] .de-dot`).count()) === 0);
  await choose("state:focus");
  ok("choosing On focus while on Tablets leaves Tablets", (await pressed()).map((s) => s.replace(/\s+/g, " ").trim()).join() === "On focus,Every size" && (await attr(`${B} h1`, "data-de-at")) === null && (await attr(`${B} h1`, "data-de-force")) === "focus");
  // Reset: reset arrow at a state removes just that one look.
  await choose("state:hover");
  const resetBtn = p.locator(`${P} [data-reset="size"]`);
  if (await resetBtn.count()) { await resetBtn.first().click(); await p.waitForTimeout(500); }
  const mr = await morphOf("try-banner");
  ok("the reset arrow on hover removes the hover size only", !!resetBtn && !mr?.parts?.title?.states?.hover && mr?.parts?.title?.size === 60 && mr?.parts?.title?.at?.sm?.size === 24, JSON.stringify(mr));
  // Another part: back to Always.
  await choose("state:focus");
  await p.locator(`${P} [data-layer="image"]`).click(); await p.waitForTimeout(500);
  ok("picking another part goes back to Always and Every size", (await pressed()).map((s) => s.replace(/\s+/g, " ").trim()).join() === "Always,Every size" && (await f.locator("[data-de-force], [data-de-at]").count()) === 0, `${JSON.stringify(await pressed())} ${await f.locator("[data-de-force], [data-de-at]").count()}`);
  // The stored look is clean, and a public page never names the editor's attributes.
  const clean = await p.evaluate(() => { const m = globalThis.__getPuck().getItemById("try-banner").props.morph; const c = globalThis.__lib.cleanMorph(m); return JSON.stringify(c) === JSON.stringify(m); });
  ok("the stored look passes the cleaner unchanged", clean);
  const pub = await p.evaluate(() => { const it = globalThis.__getPuck().getItemById("try-banner"); const m = globalThis.__lib.cleanMorph(it.props.morph); return globalThis.__lib.morphCss(m, globalThis.__contract[it.type].parts, { editor: false }).css; });
  ok("a public page's CSS has the real media rules and no forcing selector", /@media \(max-width:480px\)/.test(pub) && /@media \(max-width:820px\)/.test(pub) && !/data-de-/.test(pub), pub.slice(0, 300));
  // Undo takes a state edit back.
  await toTitle();
  await choose("state:hover");
  const iU = (await st()).idx;
  await setSize(90);
  await p.evaluate(() => globalThis.__getPuck().history.back()); await p.waitForTimeout(500);
  ok("undo takes a hover edit back", (await st()).idx === iU && !(await morphOf("try-banner"))?.parts?.title?.states?.hover?.size);
  // Puck remounts the panel when a block's props change: the choice must survive it (review 2026-11-21, Important 5).
  {
    await open();
    await toTitle();
    const base0 = (await morphOf("try-banner"))?.parts?.title?.size;
    await choose("state:hover");
    await p.evaluate(() => { const el = document.querySelector(".eac-look-panel"); if (el) el.__mark = 1; });
    await setSize(80);
    // A props change from elsewhere (as a Tweaks token or a field in Puck's own panel would be), then a pause for the remount.
    await p.evaluate(() => {
      const g = globalThis.__getPuck(); const id = "try-banner"; const sel = g.getSelectorForId(id); const it = g.getItemById(id);
      g.dispatch({ type: "replace", destinationIndex: sel.index, destinationZone: sel.zone, data: { ...it, props: { ...it.props } } });
    });
    await p.waitForTimeout(800);
    const remounted = await p.evaluate(() => { const el = document.querySelector(".eac-look-panel"); return !el || el.__mark !== 1; });
    console.log("  (panel remounted by the props change: " + remounted + ")");
    ok("after the remount On hover is still the chosen look", (await pressed()).map((s) => s.replace(/\s+/g, " ").trim()).join() === "On hover,Every size", JSON.stringify(await pressed()));
    ok("…and the title is still marked for the editor", (await attr(`${B} h1`, "data-de-force")) === "hover");
    await setSize(85);
    const m2 = await morphOf("try-banner");
    ok("two edits in a row with a remount between: both land in the hover look, the base look is untouched", m2?.parts?.title?.states?.hover?.size === 85 && m2?.parts?.title?.size === base0, JSON.stringify(m2));
    // Another part clears it; coming back is Always.
    await p.locator(`${P} [data-layer="image"]`).click(); await p.waitForTimeout(500);
    await p.locator(`${P} [data-layer="title"]`).click(); await p.waitForTimeout(500);
    ok("moving to another part clears the choice", (await pressed()).map((s) => s.replace(/\s+/g, " ").trim()).join() === "Always,Every size", JSON.stringify(await pressed()));
  }
  ok("no page errors (Puck's own offline image loads aside)", errs.filter((e) => !/ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(e)).length === 0, [...new Set(errs)].slice(0, 3).join(" | "));

  // ── B. Style against the look ──────────────────────────────────────────────
  errs.length = 0;
  await open();
  await p.evaluate(() => {
    const g = globalThis.__getPuck(); const id = "try-banner"; const sel = g.getSelectorForId(id); const it = g.getItemById(id);
    g.dispatch({ type: "replace", destinationIndex: sel.index, destinationZone: sel.zone, data: { ...it, props: { ...it.props, blkStyle: { bg: "#ff0000" }, morph: { v: 1, parts: { root: { fill: "#00aa00" } } } } } });
  });
  await p.waitForTimeout(600);
  await p.evaluate(() => { const g = globalThis.__getPuck(); g.dispatch({ type: "setUi", ui: { itemSelector: g.getSelectorForId("try-banner") } }); });
  await p.waitForTimeout(400);
  await p.evaluate(() => globalThis.__setPart?.({ id: "try-banner", part: "root" }));
  await p.waitForTimeout(500);
  const clash = p.locator(`${P} .de-clash`);
  ok("a block with Style and a look both setting the background: one note says so and what happens, not who wins", (await clash.count()) === 1 && (await clash.innerText()).trim() === "Style and this look both change the background. Both draw: the look’s background covers the Style’s, which shows only where the look’s is clear.".replace(/’/g, "'"), (await clash.count()) ? await clash.innerText() : (await p.locator(P).innerText()).slice(0, 200));
  const before = JSON.stringify((await p.evaluate(() => globalThis.__getPuck().getItemById("try-banner").props)));
  await p.waitForTimeout(200);
  ok("showing a clash changes nothing in the stored block", before === JSON.stringify((await p.evaluate(() => globalThis.__getPuck().getItemById("try-banner").props))));
  await p.evaluate(() => {
    const g = globalThis.__getPuck(); const id = "try-banner"; const sel = g.getSelectorForId(id); const it = g.getItemById(id); const { blkStyle, ...rest } = it.props;
    g.dispatch({ type: "replace", destinationIndex: sel.index, destinationZone: sel.zone, data: { ...it, props: rest } });
  });
  await p.waitForTimeout(600);
  await p.evaluate(() => globalThis.__setPart?.({ id: "try-banner", part: "title" })); await p.waitForTimeout(300);
  await p.evaluate(() => globalThis.__setPart?.({ id: "try-banner", part: "root" })); await p.waitForTimeout(500);
  ok("with no Style set there is no such line", (await p.locator(`${P} .de-clash`).count()) === 0);

  // ── C. The block popup (the canvas's own panel) ────────────────────────────
  errs.length = 0;
  await open();
  await f.waitForSelector('[data-puck-component="try-steps"]', { timeout: 20000 });
  const STEPS = '[data-puck-component="try-steps"]';
  const at = async (sel) => { const el = f.locator(sel).first(); await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(150); const bb = await el.boundingBox(); return { x: bb.x + Math.min(bb.width / 2, 30), y: bb.y + Math.min(bb.height / 2, 12) }; };
  const c0 = await at(`${STEPS} li span`); await p.mouse.dblclick(c0.x, c0.y); await p.waitForTimeout(900);
  const S = ".de-popup .de-popup-stage";
  ok("double-click on a block opens the popup", (await p.locator(".de-popup").count()) === 1);
  const PP = ".de-popup .de-panel";
  const popWhere = `${PP} .de-where`;
  ok("the popup's panel shows the same two switches for the block", (await p.locator(popWhere).count()) === 1 && /On hover/.test(await p.locator(popWhere).innerText()) && /Phones/.test(await p.locator(popWhere).innerText()), (await p.locator(PP).innerText().catch(() => "")).slice(0, 160));
  const pop = (pick) => p.locator(`${popWhere} [data-where="${pick}"]`);
  const popPressed = async () => (await p.locator(`${popWhere} button[aria-pressed="true"]`).allInnerTexts()).map((s) => s.replace(/\s+/g, " ").trim()).join();
  ok("popup default is Always and Every size", (await popPressed()) === "Always,Every size", await popPressed());
  // Pick the first part row in the layer tree and edit it on hover.
  const rowsN = await p.locator(`${PP} [data-layer]`).count();
  if (rowsN > 1) { await p.locator(`${PP} [data-layer]`).nth(1).click(); await p.waitForTimeout(500); }
  await pop("state:hover").click(); await p.waitForTimeout(500);
  ok("popup: On hover pressed", (await popPressed()) === "On hover,Every size", await popPressed());
  const forced = await p.evaluate(() => document.querySelectorAll(".de-popup-stage [data-de-force=hover]").length);
  ok("popup: the part is marked so the hover look is visible while it is edited", forced >= 1, String(forced));
  const sizeIn = p.locator(`${PP} input[data-k="size"]`).first();
  if (await sizeIn.count()) {
    await sizeIn.fill("33"); await p.keyboard.press("Enter"); await p.waitForTimeout(600);
    const node = await p.evaluate(() => { const d = globalThis.__lastPopup; return null; });
    ok("popup: a Size typed on hover shows on the marked part", (await p.evaluate(() => { const e = document.querySelector(".de-popup-stage [data-de-force=hover]"); return e ? getComputedStyle(e).fontSize : null; })) === "33px");
  } else ok("popup: a Size field for the part", false, (await p.locator(PP).innerText()).slice(0, 200));
  await pop("state:").click(); await p.waitForTimeout(400);
  ok("popup: back to Always strips the mark", (await p.evaluate(() => document.querySelectorAll(".de-popup-stage [data-de-force], .de-popup-stage [data-de-at]").length)) === 0);
  await p.keyboard.press("Escape").catch(() => {}); await p.waitForTimeout(300);
  await p.screenshot({ path: "/h/shots/where-02-popup.png" });
  const popupButton = p.locator(".de-popup button:visible", { hasText: "Use on this page" }).first();
  if (await popupButton.count()) {
    // Edit a hover look again, hand it back, and see it in Puck's own data.
    await pop("state:hover").click().catch(() => {}); await p.waitForTimeout(300);
    if (await sizeIn.count()) { await sizeIn.fill("35"); await p.keyboard.press("Enter"); await p.waitForTimeout(500); }
    await popupButton.click(); await p.waitForTimeout(800);
    const handed = await p.evaluate(() => JSON.stringify(globalThis.__getPuck().getItemById("try-steps")?.props?.morph ?? null));
    ok("Use on this page hands the hover look back into Puck's data", /"states":\{"hover"/.test(handed), handed);
  } else ok("a Use on this page button in the popup", false);
  ok("no page errors in the popup run", errs.filter((e) => !/ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(e)).length === 0, [...new Set(errs)].slice(0, 3).join(" | "));

  console.log(`\n${pass} passed, ${fail} failed`);
  srv.close?.();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("ERR", e.stack || e); process.exit(1); });
