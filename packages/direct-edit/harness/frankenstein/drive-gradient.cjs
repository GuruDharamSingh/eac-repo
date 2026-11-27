// Lane GRADIENT (2026-11-22): Fill: Colour / Fade in the look panel, headless, on Para Theater's real editor config
// (direct-edit's mountLookPanel in Puck's right column, as sunjay mounts it).
// Run: W=<scratch> bash run.sh frankenstein/entry-where.tsx:fkw.js -- drive-gradient.cjs
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
  const title = async () => (await morphOf("try-banner"))?.parts?.title ?? {};
  const clickIn = async (sel, opts = {}) => { const r = await f.$eval(sel, (e) => { e.scrollIntoView({ block: "center" }); const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + Math.min(b.height / 2, 20), iw: innerWidth }; }); const fb = await frameEl.boundingBox(); const k = fb.width / r.iw; const alt = (opts.modifiers ?? []).includes("Alt"); if (alt) await p.keyboard.down("Alt"); await p.mouse.click(fb.x + r.x * k, fb.y + r.y * k); if (alt) await p.keyboard.up("Alt"); await p.waitForTimeout(400); };
  const css = (sel, prop) => f.$eval(sel, (e, prop) => getComputedStyle(e)[prop], prop);
  const P = ".eac-look-panel:visible";
  const B = '[data-puck-component="try-banner"]';
  const H = `${B} h1`;
  const W = `${P} .de-where`;
  const toTitle = async () => { await clickIn(`${B} h1`); await clickIn(`${B} h1`, { modifiers: ["Alt"] }); };
  const choose = async (pick) => { await p.locator(`${W} [data-where="${pick}"]`).click(); await p.waitForTimeout(450); };
  const mode = async (m) => { await p.locator(`${P} [data-fade-mode="${m}"]`).click(); await p.waitForTimeout(600); };
  const bg = () => css(H, "backgroundImage");
  const idx = async () => (await st()).idx;

  await open();
  await toTitle();
  ok("Alt+click into the banner's Title", (await st()).part?.part === "title");

  // The control is under Fill, in plain words. Appearance may hide Fill behind its "+".
  if (!(await p.locator(`${P} [data-fade-mode="fade"]`).count())) { const more = p.locator(`${P} [data-more="appearance"]`); if (await more.count()) { await more.click(); await p.waitForTimeout(300); } }
  ok("Fill has Colour and Fade", (await p.locator(`${P} [data-fade-mode="colour"]`).count()) === 1 && (await p.locator(`${P} [data-fade-mode="fade"]`).count()) === 1);
  const panelText = (await p.locator(P).innerText()).replace(/\s+/g, " ");
  ok("plain words: no 'gradient' anywhere in the panel", !/gradient/i.test(panelText) && /Colour/.test(panelText) && /Fade/.test(panelText));
  ok("starts on Colour: no fade controls yet", (await p.locator(`${P} .de-fade`).count()) === 0 && (await p.locator(`${P} [data-fade-mode="colour"][aria-pressed="true"]`).count()) === 1);
  ok("the title has no background image yet", (await bg()) === "none", await bg());

  // A flat colour first, to prove a fade replaces it.
  const hexIn = p.locator(`${P} input[data-hex][data-k="fill"]`);
  if (await hexIn.count()) { await hexIn.first().fill("#336699"); await p.keyboard.press("Enter"); await p.waitForTimeout(500); }
  ok("a flat fill is stored first", (await title()).fill === "#336699", JSON.stringify(await title()));

  // Choose Fade: one step, the flat colour goes, a fade starts from it.
  const i0 = await idx();
  await mode("fade");
  let t = await title();
  ok("Fade: one history step", (await idx()) === i0 + 1, `${i0} -> ${await idx()}`);
  ok("Fade: a fade is stored and the flat colour is gone", !!t.grad && t.fill === undefined, JSON.stringify(t));
  ok("Fade: it starts from the colour that was there, straight", t.grad.kind === "linear" && t.grad.stops[0].color.toLowerCase() === "#336699", JSON.stringify(t.grad));
  ok("the page draws it: background-image is a linear-gradient", /^linear-gradient\(/.test(await bg()), (await bg()).slice(0, 80));
  ok("the controls show: strip, presets, shape, colours, angle", (await p.locator(`${P} .de-fade-strip`).count()) === 1 && (await p.locator(`${P} .de-fade-preset`).count()) >= 5 && (await p.locator(`${P} [data-fade-colour]`).count()) === 2 && (await p.locator(`${P} [data-fade-angle]`).count()) === 1);
  await p.screenshot({ path: "/h/shots/gradient-01-fade.png" });

  // Change a colour (live) and the angle; the page follows each time.
  await p.locator(`${P} input[data-fade-colour][data-fade-stop="0"]`).fill("#ff0000"); await p.waitForTimeout(600);
  t = await title();
  ok("a colour changed in the panel: stored and drawn", t.grad.stops[0].color.toLowerCase() === "#ff0000" && /rgb\(255, 0, 0\)/.test(await bg()), (await bg()).slice(0, 120));
  await p.locator(`${P} input[data-fade-angle]`).fill("45"); await p.waitForTimeout(600);
  t = await title();
  ok("the angle: stored and drawn as 45deg", t.grad.angle === 45 && /^linear-gradient\(45deg/.test(await bg()), (await bg()).slice(0, 60));
  await p.locator(`${P} input[data-fade-at][data-fade-stop="1"]`).fill("60"); await p.keyboard.press("Enter"); await p.waitForTimeout(700);
  t = await title();
  ok("a place typed for the second colour is stored", t.grad.stops[1].at === 60, JSON.stringify(t.grad.stops));
  ok("the Add control offers a third colour; adding one stores three", await (async () => { await p.locator(`${P} [data-fade-add]`).click(); await p.waitForTimeout(600); return (await title()).grad.stops.length === 3; })());
  ok("…and three colour inputs show", (await p.locator(`${P} [data-fade-colour]`).count()) === 3);
  await p.locator(`${P} [data-fade-remove="1"]`).click(); await p.waitForTimeout(600);
  ok("remove takes it back to two, and with two there is no remove", (await title()).grad.stops.length === 2 && (await p.locator(`${P} [data-fade-remove]`).count()) === 0);

  // Shapes.
  await p.locator(`${P} [data-fade-shape="radial"]`).click(); await p.waitForTimeout(600);
  ok("Round: stored radial, drawn radial, no angle field", (await title()).grad.kind === "radial" && /^radial-gradient\(/.test(await bg()) && (await p.locator(`${P} [data-fade-angle]`).count()) === 0, (await bg()).slice(0, 50));
  await p.locator(`${P} [data-fade-shape="conic"]`).click(); await p.waitForTimeout(600);
  ok("Sweep: drawn conic, with a start angle field", /^conic-gradient\(/.test(await bg()) && (await p.locator(`${P} [data-fade-angle]`).count()) === 1);
  await p.locator(`${P} [data-fade-shape="linear"]`).click(); await p.waitForTimeout(600);

  // A preset from the lab.
  const preset = p.locator(`${P} .de-fade-preset`).first();
  const presetId = await preset.getAttribute("data-fade-preset");
  await preset.click(); await p.waitForTimeout(600);
  const labPreset = await p.evaluate((id) => globalThis.__fadePresets?.find?.((x) => x.id === id) ?? null, presetId);
  t = await title();
  ok("a preset from the lab: stored, drawn, still no flat colour", !!t.grad && t.fill === undefined && /gradient\(/.test(await bg()), `${presetId} ${JSON.stringify(t.grad)}`);

  // One undo step per adjustment spell: type an angle slowly.
  await p.locator(`${P} [data-fade-shape="linear"]`).click(); await p.waitForTimeout(500);
  const iS = await idx();
  const ang = p.locator(`${P} input[data-fade-angle]`);
  await ang.click(); await p.keyboard.press("Control+A"); await p.keyboard.type("1", { delay: 120 }); await p.keyboard.type("5", { delay: 400 }); await p.keyboard.type("0", { delay: 400 });
  await p.waitForTimeout(500);
  ok("typing an angle slowly draws as it goes", (await title()).grad.angle === 150 && /150deg/.test(await bg()), `${(await title()).grad.angle} ${(await bg()).slice(0, 40)}`);
  await p.locator(`${P} [data-fade-shape="linear"]`).focus(); await p.waitForTimeout(500);
  ok("…and the spell is one history step", (await idx()) === iS + 1, `${iS} -> ${await idx()}`);
  await p.evaluate(() => globalThis.__getPuck().history.back()); await p.waitForTimeout(600);
  ok("one undo takes the whole spell back", (await idx()) === iS && (await title()).grad.angle !== 150, `${(await title()).grad.angle}`);

  // Colour again: the fade goes, the colour field is back.
  await mode("colour");
  t = await title();
  ok("Colour: the fade is gone from the stored look", t.grad === undefined, JSON.stringify(t));
  ok("Colour: the page has no background image", (await bg()) === "none", await bg());
  ok("Colour: the colour row is back", (await p.locator(`${P} input[data-hex][data-k="fill"]`).count()) >= 1 && (await p.locator(`${P} .de-fade`).count()) === 0);
  await mode("fade");
  ok("Fade again brings the same fade back (kept for the session)", !!(await title()).grad && (await title()).grad.kind === "linear", JSON.stringify((await title()).grad));
  // A colour typed while a fade exists replaces the fade (reverse exclusivity), via Colour then a colour.
  await mode("colour");
  await p.locator(`${P} input[data-hex][data-k="fill"]`).first().fill("#abcdef"); await p.keyboard.press("Enter"); await p.waitForTimeout(500);
  t = await title();
  ok("Colour then a colour: only the flat colour is stored", t.fill === "#abcdef" && t.grad === undefined, JSON.stringify(t));
  ok("…and the page shows it flat", (await css(H, "backgroundColor")) === "rgb(171, 205, 239)" && (await bg()) === "none", await css(H, "backgroundColor"));

  // The stored look is clean.
  await mode("fade");
  const clean = await p.evaluate(() => { const m = globalThis.__getPuck().getItemById("try-banner").props.morph; const c = globalThis.__lib.cleanMorph(m); return JSON.stringify(c) === JSON.stringify(m); });
  ok("the stored look passes the cleaner unchanged", clean);
  const pub = await p.evaluate(() => { const it = globalThis.__getPuck().getItemById("try-banner"); const m = globalThis.__lib.cleanMorph(it.props.morph); return globalThis.__lib.morphCss(m, globalThis.__contract[it.type].parts, { editor: false }).css; });
  ok("a public page's CSS carries the fade with no url( and no forcing selector", /background:linear-gradient\(/.test(pub) && !/url\(|data-de-/.test(pub), pub.slice(0, 200));

  // When: a hover-only fade. Base stays as it is.
  await mode("colour");
  await p.locator(`${P} input[data-hex][data-k="fill"]`).first().fill("#abcdef"); await p.keyboard.press("Enter"); await p.waitForTimeout(500);
  await choose("state:hover");
  ok("On hover starts on Colour (the hover look holds nothing)", (await p.locator(`${P} [data-fade-mode="colour"][aria-pressed="true"]`).count()) === 1 && (await p.locator(`${P} .de-fade`).count()) === 0);
  await mode("fade");
  t = await title();
  ok("a hover-only fade is stored under states.hover; the base colour is kept", !!t.states?.hover?.grad && t.grad === undefined && t.fill === "#abcdef", JSON.stringify(t));
  ok("the editor shows it while the hover look is edited", /gradient\(/.test(await bg()), (await bg()).slice(0, 50));
  await p.locator(`${P} input[data-fade-colour][data-fade-stop="0"]`).fill("#00aa44"); await p.waitForTimeout(600);
  // As a person closing the colour picker: the field is left, which ends the spell, before the next click.
  await p.evaluate(() => document.activeElement?.blur?.()); await p.waitForTimeout(700);
  await choose("state:");
  ok("back on Always: the page shows the flat base colour, no fade", (await bg()) === "none" && (await css(H, "backgroundColor")) === "rgb(171, 205, 239)", `force=${await f.$eval(H, (e) => e.getAttribute("data-de-force"))} where=${JSON.stringify(await p.locator(`${W} button[aria-pressed="true"]`).allInnerTexts())} ${(await bg()).slice(0, 40)} ${await css(H, "backgroundColor")}`);
  // A real hover.
  await p.mouse.move(5, 5);
  const fb = await frameEl.boundingBox();
  const r = await f.$eval(H, (e) => { const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, iw: innerWidth }; });
  const k = fb.width / r.iw;
  await p.mouse.move(fb.x + r.x * k, fb.y + r.y * k); await p.waitForTimeout(500);
  ok("with the pointer over the title the hover fade is drawn", /gradient\(/.test(await bg()) && /rgb\(0, 170, 68\)/.test(await bg()), (await bg()).slice(0, 100));
  await p.mouse.move(5, 5); await p.waitForTimeout(400);
  await p.locator(`${P} [data-layer="title"]`).click().catch(() => {});

  // Screen: a phones-only fade.
  await choose("at:sm");
  await mode("fade");
  t = await title();
  ok("a phones fade is stored under at.sm", !!t.at?.sm?.grad && !!t.states?.hover?.grad, JSON.stringify(t).slice(0, 300));
  await choose("at:");
  const pubAll = await p.evaluate(() => { const it = globalThis.__getPuck().getItemById("try-banner"); const m = globalThis.__lib.cleanMorph(it.props.morph); return globalThis.__lib.morphCss(m, globalThis.__contract[it.type].parts, { editor: false }).css; });
  ok("the public CSS has the phones fade inside the 480px rule and the hover fade under :hover", /:hover\{background:linear-gradient\(/.test(pubAll) && /@media \(max-width:480px\)\{[^@]*gradient\(/.test(pubAll), pubAll.slice(0, 200));
  await p.screenshot({ path: "/h/shots/gradient-02-states.png" });

  // A hostile stored fade (hand-written JSON) draws nothing and does not break the page.
  await p.evaluate(() => {
    const g = globalThis.__getPuck(); const id = "try-banner"; const sel = g.getSelectorForId(id); const it = g.getItemById(id);
    const props = JSON.parse(JSON.stringify(it.props));
    props.morph.parts.title = { grad: { kind: "linear", angle: 0, stops: [{ color: "url(http://e/x)", at: 0 }, { color: "#fff;}*{display:none", at: 50 }] }, size: 33 };
    g.dispatch({ type: "replace", destinationIndex: sel.index, destinationZone: sel.zone, data: { ...it, props } });
  });
  await p.waitForTimeout(800);
  ok("a hostile stored fade: the title still draws its size, no background image, no request for x", (await css(H, "fontSize")) === "33px" && (await bg()) === "none");

  ok("no page errors (Puck's own offline image loads aside)", errs.filter((e) => !/ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(e)).length === 0, [...new Set(errs)].slice(0, 3).join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  srv.close?.();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("ERR", e.stack || e); process.exit(1); });
