// Drives the parts plugin inside Puck's editor. Run with ../run.sh drive.cjs (isolated Chromium, no network).
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
  const errs = []; p.on("pageerror", (e) => errs.push((e.stack || e.message).slice(0, 300))); p.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 200)); });
  await p.goto("http://127.0.0.1:8123/", { waitUntil: "domcontentloaded", timeout: 60000 });
  const frameEl = await p.waitForSelector("iframe", { timeout: 20000 });
  const f = await frameEl.contentFrame();
  await f.waitForSelector('[data-puck-component="try-banner"]', { timeout: 20000 }).catch(async () => { console.log("no banner; errors", errs.slice(0, 5)); await p.screenshot({ path: "/h/shots/fk-00-fail.png" }); process.exit(1); });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: "/h/shots/fk-01-open.png" });
  const fbox = await frameEl.boundingBox();
  const st = () => p.evaluate(() => { const s = globalThis.__getPuck(); return { sel: s.selectedItem?.props?.id ?? null, part: globalThis.__parts(), canUndo: s.history.hasPast, idx: s.history.index }; });
  const morphOf = (id) => p.evaluate((id) => globalThis.__getPuck().getItemById(id)?.props?.morph ?? null, id);
  // Click at the centre of an element inside the canvas, in page coordinates.
  // Puck zooms the iframe (CSS scale), so canvas coordinates are scaled to page coordinates.
  const clickIn = async (sel) => { const r = await f.$eval(sel, (e) => { e.scrollIntoView({ block: "center" }); const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + Math.min(b.height / 2, 20), iw: innerWidth }; }); const fb = await frameEl.boundingBox(); const k = fb.width / r.iw; await p.mouse.click(fb.x + r.x * k, fb.y + r.y * k); await p.waitForTimeout(400); };
  const css = (sel, prop) => f.$eval(sel, (e, prop) => getComputedStyle(e)[prop], prop);
  const B = '[data-puck-component="try-banner"]';

  // 1. Selection: Puck selects the block, the second click picks a part.
  await clickIn(`${B} h1`);
  let s = await st();
  ok("first click selects the banner (Puck)", s.sel === "try-banner" && !s.part, JSON.stringify(s));
  ok("block fields show (no part panel)", (await p.locator(".fk-part-panel").count()) === 0);
  await clickIn(`${B} h1`);
  s = await st();
  ok("second click on the heading picks part title", s.part?.part === "title", JSON.stringify(s.part));
  ok("part panel shows, block fields hidden", (await p.locator(".fk-part-panel:visible").count()) === 1);
  ok("outline marks drawn in canvas", (await f.locator("[data-fk-mark]").count()) >= 3, String(await f.locator("[data-fk-mark]").count()));
  ok("selected mark is the title", (await f.locator('[data-fk-mark="title"][data-fk-on]').count()) === 1);
  await p.screenshot({ path: "/h/shots/fk-02-part.png" });

  // Smallest part wins: a click on the button picks button, not copy/root.
  await clickIn(`${B} a`);
  ok("click on the button picks part button", (await st()).part?.part === "button", JSON.stringify((await st()).part));
  await p.locator('[data-fk-part="title"]:visible').click();
  ok("part list in the panel selects title", (await st()).part?.part === "title");

  // 2. Edit: fill and size, written as morph through Puck's replace.
  const before = (await st()).idx;
  const before0 = { bg: await css(`${B} h1`, "backgroundColor"), fs: await css(`${B} h1`, "fontSize") };
  await p.locator('[data-fk-ctl="fill"]:visible').fill("#b85c3a"); await p.keyboard.press("Enter"); await p.waitForTimeout(400);
  ok("fill drawn on the title", (await css(`${B} h1`, "backgroundColor")) === "rgb(184, 92, 58)", await css(`${B} h1`, "backgroundColor"));
  await p.locator('[data-fk-ctl="size"]:visible').fill("64"); await p.waitForTimeout(400);
  ok("size drawn on the title", (await css(`${B} h1`, "fontSize")) === "64px", await css(`${B} h1`, "fontSize"));
  let m = await morphOf("try-banner");
  ok("stored as props.morph", JSON.stringify(m) === JSON.stringify({ v: 1, parts: { title: { fill: "#b85c3a", size: 64 } } }), JSON.stringify(m));
  ok("other parts untouched", (await css(`${B} a`, "fontSize")) !== "64px");
  ok("part stays selected after the edit", (await st()).part?.part === "title");
  const expected = await p.evaluate(() => { const o = {}; globalThis.__lib.setPartLook(o, "title", { fill: "#b85c3a", size: 64 }); return o.morph; });
  ok("same morph as direct-edit's setPartLook", JSON.stringify(expected) === JSON.stringify(m));
  ok("survives the server cleaner (cleanMorph), same values", canon(await p.evaluate((m) => globalThis.__lib.cleanMorph(m), m)) === canon(m));
  ok("history grew", (await st()).idx > before, `${before} -> ${(await st()).idx}`);

  // 3. Undo / redo through Puck's own history.
  await p.evaluate(() => globalThis.__getPuck().history.back()); await p.waitForTimeout(400);
  ok("undo removes the size", (await css(`${B} h1`, "fontSize")) === before0.fs && (await css(`${B} h1`, "backgroundColor")) === "rgb(184, 92, 58)", await css(`${B} h1`, "fontSize"));
  ok("panel field follows undo", (await p.locator('[data-fk-ctl="size"]:visible').inputValue()) === "", await p.locator('[data-fk-ctl="size"]:visible').inputValue().catch(() => "?"));
  await p.evaluate(() => globalThis.__getPuck().history.back()); await p.waitForTimeout(400);
  ok("second undo removes the morph", (await morphOf("try-banner")) === null && (await css(`${B} h1`, "backgroundColor")) === before0.bg, JSON.stringify(await morphOf("try-banner")));
  await p.evaluate(() => { const h = globalThis.__getPuck().history; h.forward(); h.forward(); }); await p.waitForTimeout(400);
  ok("redo brings both back", JSON.stringify(await morphOf("try-banner")) === JSON.stringify(m));
  // Keyboard undo as an artist would press it (focus on the canvas).
  await clickIn(`${B} h1`);
  await p.keyboard.press("Control+z"); await p.waitForTimeout(400);
  ok("Ctrl+Z undoes (Puck hotkey)", (await css(`${B} h1`, "fontSize")) === before0.fs, await css(`${B} h1`, "fontSize"));
  await p.keyboard.press("Control+Shift+z"); await p.waitForTimeout(400);
  ok("Ctrl+Shift+Z redoes", (await css(`${B} h1`, "fontSize")) === "64px", await css(`${B} h1`, "fontSize"));

  // 4. Nested: a block inside a band's slot. Clicks needed to reach a part.
  const nested = await f.$$eval("[data-puck-component] [data-puck-component]", (l) => l.map((e) => e.getAttribute("data-puck-component")));
  const cards = nested.includes("try-feed-cards") ? "try-feed-cards" : nested[0];
  const C = `[data-puck-component="${cards}"]`;
  const parts = await p.evaluate((t) => Object.keys(globalThis.__contract[t]?.parts ?? {}), await p.evaluate((id) => globalThis.__getPuck().getItemById(id)?.type, cards));
  const target = (await f.$(`${C} h3`)) ? `${C} h3` : (await f.$(`${C} h2`)) ? `${C} h2` : C;
  await clickIn('[data-puck-component="try-banner"] p'); // somewhere else first
  let n = 0;
  for (; n < 4; n++) { await clickIn(target); if ((await st()).part?.id === cards) break; }
  s = await st();
  ok(`nested block ${cards}: part reached in ${n + 1} clicks`, s.part?.id === cards, JSON.stringify(s) + " parts " + parts.join(","));
  await p.screenshot({ path: "/h/shots/fk-03-nested.png" });

  // 5. Resolvers: Puck re-runs them on replace; changing a data setting refetches.
  ok("resolvers fetched rows on open", fetched.length > 0, fetched.slice(0, 4).join(" "));

  // 6. Save through PuckEditor's Publish.
  console.log("  publish element:", await p.locator("header").getByText("Publish", { exact: true }).evaluate((e) => e.closest("button,a,[role=button]")?.outerHTML.slice(0, 160) ?? e.outerHTML.slice(0, 160)));
  await p.locator("header").getByText("Publish", { exact: true }).click(); await p.waitForTimeout(1200);
  console.log("  header after publish:", (await p.locator("header").first().innerText().catch(() => "?")).replace(/\s+/g, " ").slice(0, 120));
  const pub = await p.evaluate(() => globalThis.__published);
  ok("publish handed the document out", !!pub);
  if (pub) {
    const banner = pub.content.find((n) => n.props.id === "try-banner");
    ok("published banner carries the morph", JSON.stringify(banner?.props?.morph) === JSON.stringify(m), JSON.stringify(banner?.props?.morph));
    const seed = await p.evaluate(() => globalThis.__seed);
    // Compare the authored shape: drop resolver keys (read-only) and the one morph.
    const strip = (d, dropMorph) => JSON.stringify(d, (k, v) => (k === "readOnly" ? undefined : k === "morph" && dropMorph ? undefined : v));
    const ro = new Set(); JSON.stringify(pub, (k, v) => { if (v && typeof v === "object" && v.readOnly) Object.keys(v.readOnly).forEach((x) => ro.add(x)); return v; });
    const clean = (d) => JSON.parse(JSON.stringify(d, (k, v) => (ro.has(k) || k === "readOnly" ? undefined : v)));
    const a = strip(clean(seed), true), c = strip(clean(pub), true);
    const diffs = []; const walk = (x, y, path) => { if (canon(x) === canon(y)) return; if (x && y && typeof x === "object" && typeof y === "object") { for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) walk(x[k], y[k], `${path}.${k}`); return; } diffs.push(`${path}: ${JSON.stringify(x)?.slice(0, 60)} -> ${JSON.stringify(y)?.slice(0, 60)}`); };
    walk(JSON.parse(a), JSON.parse(c), "");
    ok("nothing else in the document changed (key order ignored)", diffs.length === 0, diffs.slice(0, 5).join(" | "));
    ok("same bytes with key order", a === c, a === c ? "" : "differs only in key order: " + (diffs.length === 0));
    const cleaned = await p.evaluate((d) => JSON.stringify(globalThis.__lib.cleanBoxDoc(d).content.find((n) => n.props.id === "try-banner").props.morph), pub);
    ok("cleanBoxDoc keeps the morph", canon(JSON.parse(cleaned)) === canon(m), cleaned);
    fs.writeFileSync("/h/published.json", JSON.stringify(pub, null, 1));
  }

  // 7. Phone viewport: Puck's iframe at 360px, @media rules fire.
  const wide = await f.evaluate(() => ({ w: innerWidth, sm: matchMedia("(min-width: 640px)").matches }));
  await p.evaluate(() => { const s = globalThis.__getPuck(); s.dispatch({ type: "setUi", ui: { viewports: { ...s.appState.ui.viewports, current: { width: 360, height: "auto" } } } }); });
  await p.waitForTimeout(900);
  const narrow = await f.evaluate(() => ({ w: innerWidth, sm: matchMedia("(min-width: 640px)").matches }));
  ok("phone viewport narrows the iframe", narrow.w <= 400 && wide.w > 640, `${wide.w} -> ${narrow.w}`);
  ok("(min-width: 640px) flips to false", wide.sm && !narrow.sm);
  const h1fs = await css(`${B} h1`, "fontSize");
  ok("title keeps its morph at phone width (min(64px, 11vw))", Math.abs(parseFloat(h1fs) - 0.11 * narrow.w) < 1, h1fs);
  await clickIn(`${B} h1`); await clickIn(`${B} h1`);
  ok("part pick still works at phone width", (await st()).part?.part === "title");
  const markOk = await f.evaluate(() => { const m = document.querySelector('[data-fk-mark="title"]'); const t = document.querySelector('[data-puck-component="try-banner"] h1'); if (!m || !t) return false; const a = m.getBoundingClientRect(), b = t.getBoundingClientRect(); return Math.abs(a.x - b.x) < 2 && Math.abs(a.width - b.width) < 2; });
  ok("outline sits on the title at phone width", markOk);
  await p.screenshot({ path: "/h/shots/fk-04-phone.png" });

  const realErrs = errs.filter((e) => !/ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(e));
  ok("no page errors (offline image loads excluded)", realErrs.length === 0, [...new Set(realErrs)].slice(0, 4).join(" | "));
  console.log(`\nparity ${pass}/${pass + fail}`);
  await b.close(); srv.close(); process.exit(0);
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
