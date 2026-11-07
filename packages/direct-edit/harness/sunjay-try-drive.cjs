// Para Theater's canvas editor, driven in Chromium with no network: every block's rows, click into a part, restyle it,
// Save through the host's save path short of the database, reload, then the published path with no editor marks.
// Run with sunjay-try-run.sh. Prints `pass N fail M`, as the other drivers do. Shots go in shots/sunjay-*.png.
const { chromium } = require("playwright-core");
const http = require("http"), fs = require("fs"), path = require("path");
const TYPES = { ".css": "text/css", ".js": "text/javascript", ".html": "text/html", ".json": "application/json", ".jpg": "image/jpeg", ".png": "image/png", ".woff2": "font/woff2" };
const PUBLIC_PIC = "/api/media/EAC_Network/sunjay/Media/Images/20181117-234733-yt3fbk.jpg", PRIVATE_PIC = "/api/media/EAC_Network/sunjay/Private/Secret.jpg";
const LIBRARY = { browsable: false, items: [{ name: "Public.jpg", url: PUBLIC_PIC }, { name: "Secret.jpg", url: PRIVATE_PIC }] };
const asked = [];
const srv = http.createServer((q, r) => {
  const u = q.url.split("?")[0];
  asked.push(u);
  if (u === "/api/media/library" || u === "/api/media/library/mine") { r.writeHead(200, { "content-type": "application/json" }); r.end(JSON.stringify(LIBRARY)); return; }
  const f = u.startsWith("/api/media/") ? path.join("/h/pics", path.basename(u)) : u.startsWith("/_next/static/") ? path.join("/h/next-static", u.slice("/_next/static/".length)) : u === "/" ? "/h/sunjay-try.html" : path.join("/h", u);
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { "content-type": TYPES[path.extname(f)] ?? "application/octet-stream" }); r.end(d); });
});
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) pass++; else { fail++; console.log("FAIL", n, x === undefined ? "" : JSON.stringify(x)); } };
const seedOf = () => JSON.parse(fs.readFileSync("/h/sunjay-try-page.json", "utf8"));
const walk = (list, fn) => { for (const n of list ?? []) { fn(n); for (const v of Object.values(n.props)) if (Array.isArray(v) && v[0]?.type) walk(v, fn); } };
const nodeIn = (d, id) => { let hit = null; walk(d.content, (n) => { if (n.props.id === id) hit = n; }); return hit; };

(async () => {
  await new Promise((r) => srv.listen(8123, "127.0.0.1", r));
  fs.mkdirSync("/h/shots", { recursive: true });
  const b = await chromium.connectOverCDP("http://127.0.0.1:9222"); const p = b.contexts()[0].pages()[0];
  p.setDefaultTimeout(20000); await p.setViewportSize({ width: 1500, height: 950 });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message.slice(0, 300)));
  p.on("console", (m) => { if (m.type() === "error" && !/net::ERR|Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 300)); });
  p.on("dialog", (d) => d.accept().catch(() => {}));
  const URL0 = "http://127.0.0.1:8123/";
  const open = async (hash = "") => { await p.goto("about:blank"); await p.goto(URL0 + hash); await p.waitForFunction(() => window.ready || window.failed).catch((e) => { throw new Error(`${e.message.split("\n")[0]} ${JSON.stringify(errs.slice(-4))}`); }); const failed = await p.evaluate(() => window.failed); if (failed) throw new Error(failed); };
  const editor = async (hash = "") => { await open(hash); await p.waitForSelector(".de-vpanel .de-tabs"); await p.waitForTimeout(250); };
  const doc = () => p.evaluate(() => window.ed.doc());
  const head = () => p.$eval(".de-vpanel .de-head b", (e) => e.textContent).catch(() => null);
  const sub = () => p.$eval(".de-vpanel .de-head span", (e) => e.textContent).catch(() => null);
  const sel = async (ref) => { await p.evaluate((i) => window.ed.select(i), ref); await p.waitForTimeout(60); };
  const labels = (s) => p.$$eval(`.de-vpanel .de-sec[data-section="${s}"] .de-label`, (e) => e.map((x) => x.textContent));
  const sections = () => p.$$eval(".de-vpanel .de-sec[data-section]", (e) => e.map((x) => x.dataset.section));
  const css = (selector, prop) => p.$eval(selector, (e, q) => getComputedStyle(e)[q], prop);
  const shot = (n, o) => p.screenshot({ path: `/h/shots/sunjay-${n}.png`, ...o });
  const hex = async (id, v) => { await p.fill(`.de-vpanel [data-f="${id}"]`, v); await p.waitForTimeout(60); await p.$eval(`.de-vpanel [data-f="${id}"]`, (e) => e.blur()); await p.waitForTimeout(40); };
  const click = async (selector) => { const l = p.locator(selector).first(); await l.scrollIntoViewIfNeeded(); await p.waitForTimeout(90); const bb = await l.boundingBox(); await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.waitForTimeout(90); };
  /** Clicks a spot until the panel's heading is `label`, as a person clicks through. Returns the headings on the way. */
  const clickTo = async (selector, label) => { const seen = []; for (let i = 0; i < 5; i++) { await click(selector); seen.push(await head()); if (seen[seen.length - 1] === label) return seen; } return seen; };

  // ------------------------------------------------------------- rows of every block
  await editor();
  const seed = seedOf(), contract = await p.evaluate(() => window.kit.contract);
  await shot("1-opened");
  const report = {};
  const ids = []; walk(seed.content, (n) => ids.push([n.props.id, n.type]));
  ok("every block in the try document is in sunjay's catalogue", ids.every(([, t]) => contract[t]), ids.filter(([, t]) => !contract[t]));
  for (const [id, type] of ids) {
    await sel(id);
    const name = await head(), secs = await sections(), content = secs.includes("content") ? await labels("content") : [];
    report[id] = { type, head: name, sections: secs, content };
    ok(`${id}: the panel names the block`, name === contract[type].label, name);
    const want = contract[type].props.filter((x) => x.group === "content").map((x) => x.label);
    ok(`${id}: settings first, as declared`, JSON.stringify(content) === JSON.stringify(want), [content, want]);
    ok(`${id}: nothing draws in its place`, (await p.$$(`[data-tree-node="${id}"].de-tree-empty, [data-tree-node="${id}"][data-tree-standin]`)).length === 0);
  }
  console.log("TRACE rows", JSON.stringify(report));
  await sel(null);

  // ------------------------------------------------------------- settings answer to the panel
  await sel("try-about-heading");
  const titleField = '.de-vpanel [data-f="p-title"]';
  await p.fill(titleField, "About the labs"); await p.waitForTimeout(80);
  ok("a setting redraws the block", (await p.$eval('[data-tree-node="try-about-heading"]', (e) => e.textContent)).includes("About the labs"));
  ok("and is stored on the node", nodeIn(await doc(), "try-about-heading").props.title === "About the labs");
  ok("and the selection holds", (await head()) === contract["section-heading"].label);
  await p.fill(titleField, "About"); await p.waitForTimeout(80);
  await p.$eval(titleField, (e) => e.blur());

  // ------------------------------------------------------------- click into pt-banner, restyle the title
  const TITLE = '[data-tree-node="try-banner"] h1';
  const path1 = await clickTo(TITLE, "Title");
  ok("pt-banner: click, click, click reaches Title", JSON.stringify(path1) === JSON.stringify([contract["pt-banner"].label, "Words", "Title"]), path1);
  ok("under it the block", (await sub()) === contract["pt-banner"].label, await sub());
  const before = { color: await css(TITLE, "color"), size: await css(TITLE, "fontSize") };
  await shot("2-title-chosen");
  await hex("color", "#aa2233");
  ok("colour restyles live and beats the block's inline colour", (await css(TITLE, "color")) === "rgb(170, 34, 51)", [before, await css(TITLE, "color")]);
  await p.fill('.de-vpanel [data-f="size"]', "64"); await p.waitForTimeout(80);
  ok("size restyles live", (await css(TITLE, "fontSize")) === "64px", await css(TITLE, "fontSize"));
  await p.$eval('.de-vpanel [data-f="size"]', (e) => e.blur());
  await p.click('.de-vpanel [data-f="pop-font"]'); await p.waitForTimeout(60);
  await p.fill(".de-vpanel [data-fontq]", "Playfair Display"); await p.waitForTimeout(60);
  await p.click('.de-vpanel .de-fontitem[data-font="Playfair Display"]'); await p.waitForTimeout(100);
  ok("font restyles live", (await css(TITLE, "fontFamily")).includes("Playfair Display"), await css(TITLE, "fontFamily"));
  ok("the selection holds through all three", (await head()) === "Title");
  ok("stored on the part", JSON.stringify(nodeIn(await doc(), "try-banner").props.morph?.parts?.title) === JSON.stringify({ color: "#aa2233", size: 64, font: "Playfair Display" }), nodeIn(await doc(), "try-banner").props.morph);
  await shot("3-title-restyled");

  // ------------------------------------------------------------- the subtitle hides, a button restyles
  const BUTTON = '[data-tree-node="try-banner"] a';
  await clickTo(BUTTON, "Button");
  ok("pt-banner: reaches Button", (await head()) === "Button", await head());
  await hex("color", "#ffffff");
  ok("the button's colour moves", (await css(BUTTON, "color")) === "rgb(255, 255, 255)", await css(BUTTON, "color"));

  // ------------------------------------------------------------- a block inside a band
  const HEAD = '[data-tree-node="try-about-heading"] .blk-heading-title';
  await sel(null);
  const partsOf = contract["section-heading"].parts;
  const titleLabel = Object.values(partsOf).find((x) => x.sel.includes("title"))?.label;
  const path2 = await clickTo(HEAD, titleLabel);
  ok("section-heading in a band: reaches its title", (await head()) === titleLabel, path2);
  await hex("color", "#e4cf9c");
  ok("it restyles", (await css(HEAD, "color")) === "rgb(228, 207, 156)", await css(HEAD, "color"));

  // ------------------------------------------------------------- all captions at once
  const CAP = '[data-tree-node="try-wall"] .blk-wall-caption';
  await sel(null);
  await clickTo(CAP, "Caption");
  ok("picture-wall: reaches Caption", (await head()) === "Caption", await head());
  ok("the panel says all of them change", (await p.$eval(".de-vpanel", (e) => e.textContent)).includes("All 4 change together"));
  await hex("color", "#c9ae79");
  ok("all four captions change", (await p.$$eval(CAP, (l) => l.map((e) => getComputedStyle(e).color))).every((c) => c === "rgb(201, 174, 121)"), await p.$$eval(CAP, (l) => l.map((e) => getComputedStyle(e).color)));
  await shot("4-captions");

  // ------------------------------------------------------------- blocks with no parts: the whole block
  await sel("try-about-link");
  await hex("color", "#d9c08a");
  const LINK = '[data-tree-node="try-about-link"]';
  await p.waitForTimeout(400); // The button look carries a transition.
  ok("pt-link with no parts: restyled as a whole", (await css(LINK, "color")) === "rgb(217, 192, 138)", await css(LINK, "color"));
  ok("stored on root, not `look`", !!nodeIn(await doc(), "try-about-link").props.morph?.parts?.root && nodeIn(await doc(), "try-about-link").props.look === "button", nodeIn(await doc(), "try-about-link").props);

  // ------------------------------------------------------------- a band's ground: a slot-bearing block as a whole
  await sel("try-about");
  await hex("fill", "#2b3033");
  ok("pt-band's fill moves, its contents stay", (await css('[data-tree-node="try-about"]', "backgroundColor")) === "rgb(43, 48, 51)" && !!(await p.$('[data-tree-node="try-about-text"]')), await css('[data-tree-node="try-about"]', "backgroundColor"));
  ok("a band's slot still holds its nodes", nodeIn(await doc(), "try-about").props.content.length === 3);

  // ------------------------------------------------------------- Tweaks: a token on one block
  await sel("try-about-heading");
  await p.click('.de-vpanel [data-tab="tweaks"]'); await p.waitForTimeout(80);
  await p.fill('.de-vpanel [data-f="t-blk-accent"]', "#7fb069"); await p.waitForTimeout(80);
  await p.$eval('.de-vpanel [data-f="t-blk-accent"]', (e) => e.blur());
  ok("Tweaks writes a token on this block", nodeIn(await doc(), "try-about-heading").props.morph?.tokens?.["--blk-accent"]?.toLowerCase() === "#7fb069", nodeIn(await doc(), "try-about-heading").props.morph);
  await p.click('.de-vpanel [data-tab="props"]'); await p.waitForTimeout(60);

  // ------------------------------------------------------------- a Private picture is refused
  await sel("try-banner");
  const IMG = '.de-vpanel [data-f="p-imageUrl"]';
  const wasImg = nodeIn(await doc(), "try-banner").props.imageUrl;
  await p.fill(IMG, PRIVATE_PIC); await p.waitForTimeout(60); await p.$eval(IMG, (e) => e.blur()); await p.waitForTimeout(100);
  ok("a typed Private path is not stored", nodeIn(await doc(), "try-banner").props.imageUrl === wasImg, nodeIn(await doc(), "try-banner").props.imageUrl);
  ok("and it says why", (await p.$eval("body", (e) => e.textContent)).includes("private"));
  await sel(null);

  // ------------------------------------------------------------- the host's picture routes, on a box
  await sel("try-quote");
  // By script: `.de-vpanel` inherits `height: 100%` from `.de-panel` (direct-edit.css:13), so its foot sits below the viewport and a mouse cannot reach this button. Checked on its own below.
  const panelBox = await p.$eval(".de-vpanel", (e) => { const r = e.getBoundingClientRect(); return { bottom: r.bottom, vh: innerHeight }; });
  ok("the panel's foot is inside the window", panelBox.bottom <= panelBox.vh, panelBox);
  if (panelBox.bottom > panelBox.vh) {
    // What the fix would do, on this page only: the one line asked of direct-edit.css.
    await p.addStyleTag({ content: ".de-vpanel{height:auto}" }); await p.waitForTimeout(60);
    const fixed = await p.$eval(".de-vpanel", (e) => e.getBoundingClientRect().bottom);
    ok("with height: auto on .de-vpanel it fits", fixed <= panelBox.vh, fixed);
    const foot = p.locator('.de-vpanel [data-f="wrap-block"]'); await foot.scrollIntoViewIfNeeded();
    const fb = await foot.boundingBox();
    ok("and a mouse reaches its last button", fb && fb.y + fb.height <= panelBox.vh, fb);
  }
  await p.$eval('.de-vpanel [data-f="wrap-block"]', (e) => e.click()); await p.waitForTimeout(150);
  const boxId = await p.evaluate(() => { let id = null; const go = (l) => { for (const n of l ?? []) { if (n.type === "box") id = n.props.id; for (const v of Object.values(n.props)) if (Array.isArray(v) && v[0]?.type) go(v); } }; go(window.ed.doc().content); return id; });
  ok("Put it in a box", !!boxId);
  await sel(boxId);
  await p.click('.de-vpanel [data-f="choose"]'); await p.waitForSelector(".eac-picker");
  ok("the site's own picker opens", await p.$eval(".de-vdrawer", (e) => !e.hidden));
  await p.click('.eac-picker-tabs button:has-text("This site")'); await p.waitForSelector('.de-vdrawer button[title="Secret.jpg"]');
  ok("it reads /api/media/library", asked.includes("/api/media/library"));
  await p.click('.de-vdrawer button[title="Secret.jpg"]'); await p.waitForTimeout(100);
  ok("a Private picture is refused in the drawer", !nodeIn(await doc(), boxId).props.image && await p.$eval(".de-vdrawer", (e) => !e.hidden), nodeIn(await doc(), boxId).props);
  await shot("5-picker");
  await p.click('.de-vdrawer button[title="Public.jpg"]'); await p.waitForTimeout(150);
  ok("a public one is stored", nodeIn(await doc(), boxId).props.image === PUBLIC_PIC, nodeIn(await doc(), boxId).props);

  // ------------------------------------------------------------- Save, through the host's save path
  ok("Edit its settings goes to Puck's editor on this page", await (async () => { await sel("try-wall"); return p.$eval('.de-vpanel [data-f="block-editor"]', (e) => e.getAttribute("href")) === "/studio/try"; })() || (await p.$eval('.de-vpanel [data-f="block-editor"]', (e) => e.getAttribute("href"))) === "/studio/try");
  await sel(null);
  await p.click("[data-a=save]"); await p.waitForFunction(() => document.querySelector(".de-editbar-hint")?.textContent.includes("Saved"));
  const saved = await p.evaluate(() => window.saved[window.saved.length - 1]);
  ok("the save path changes nothing the editor holds", JSON.stringify(await p.evaluate((d) => window.kit.chain(d).out, saved)) === JSON.stringify(saved));
  ok("it validates", await p.evaluate((d) => window.kit.chain(d).check.ok, saved));
  const lost = [];
  walk(seed.content, (n) => { const s = nodeIn(saved, n.props.id); if (!s) { lost.push(n.props.id); return; } for (const k of Object.keys(n.props)) if (!(k in s.props)) lost.push(`${n.props.id}.${k}`); });
  ok("no node and no prop lost", lost.length === 0, lost);
  ok("root props kept: title, noindex", saved.root.props.title === seed.root.props.title && saved.root.props.noindex === true, saved.root.props);
  ok("zones kept", !!saved.zones);
  const morphs = []; walk(saved.content, (n) => { if (n.props.morph) morphs.push([n.props.id, n.props.morph]); });
  ok("morph is parts and tokens, no selector", morphs.every(([, m]) => m.v === 1 && Object.keys(m).every((k) => ["v", "parts", "tokens"].includes(k)) && !JSON.stringify(m).match(/[{>].*sel|\.blk-|h1\b/)), morphs);
  console.log("TRACE morphs", JSON.stringify(morphs));
  fs.writeFileSync("/h/saved.json", JSON.stringify(saved, null, 2));

  // ------------------------------------------------------------- reload the saved document
  await p.reload(); await p.waitForFunction(() => window.ready || window.failed); await p.waitForSelector(".de-vpanel .de-tabs"); await p.waitForTimeout(250);
  ok("the editor reopens on what was saved", JSON.stringify(await doc()) === JSON.stringify(saved));
  ok("the title draws from the document", (await css(TITLE, "color")) === "rgb(170, 34, 51)" && (await css(TITLE, "fontSize")) === "64px", [await css(TITLE, "color"), await css(TITLE, "fontSize")]);
  ok("the captions too", (await css(CAP, "color")) === "rgb(201, 174, 121)");
  await shot("6-reloaded");
  await shot("6-reloaded-full", { fullPage: true });

  // ------------------------------------------------------------- the published path
  await open("#published"); await p.waitForTimeout(400);
  const PUB_TITLE = "#host h1", PUB_CAP = "#host .blk-wall-caption";
  ok("published: the title's colour, size and font", (await css(PUB_TITLE, "color")) === "rgb(170, 34, 51)" && (await css(PUB_TITLE, "fontSize")) === "64px" && (await css(PUB_TITLE, "fontFamily")).includes("Playfair Display"), [await css(PUB_TITLE, "color"), await css(PUB_TITLE, "fontSize"), await css(PUB_TITLE, "fontFamily")]);
  ok("published: the captions", (await p.$$eval(PUB_CAP, (l) => l.map((e) => getComputedStyle(e).color))).every((c) => c === "rgb(201, 174, 121)"));
  ok("published: the button", (await css("#host section a", "color")) === "rgb(255, 255, 255)");
  ok("published: a marker per morphed node", (await p.$$("#host template[data-morph]")).length === morphs.length, [(await p.$$("#host template[data-morph]")).length, morphs.length]);
  const pub = await p.$eval("#host", (e) => e.innerHTML);
  ok("published: no editor marks", !/data-tree-|data-de-|de-tree-|de-vpanel|de-box|contenteditable/.test(pub), pub.match(/data-tree-[a-z]+|data-de-[a-z]+|de-[a-z-]+/g)?.slice(0, 8));
  ok("published: no editor stylesheet", (await p.$$('link[href*="visual.css"]')).length === 0 && (await p.$$(".de-vpanel, .de-editbar")).length === 0);
  ok("published: morph is not in the markup", !/\bmorph"|"morph|parts\b/.test(pub.replace(/data-morph=/g, "")));
  ok("published: the look's sheet sits in <head>", (await p.$$('head style[data-precedence="eac-morph"]')).length >= 1, (await p.$$('head style')).length);
  ok("published: the band's fill", (await p.$$eval("#host section", (l) => l.some((e) => getComputedStyle(e).backgroundColor === "rgb(43, 48, 51)"))));
  ok("published: the box's background picture", (await p.$$eval("#host [style*='background']", (l) => l.some((e) => e.getAttribute("style").includes("20181117")))));
  await shot("7-published");
  await shot("7-published-full", { fullPage: true });

  // ------------------------------------------------------------- with no morph, today's markup
  const same = await p.evaluate(async () => {
    const { seed, toHtml, publishedConfig, beforeConfig } = window.kit;
    const event = await (await fetch("/sunjay-event-detail.json")).json();
    const one = (d) => { let a, b; try { a = toHtml(beforeConfig, d); } catch (e) { a = `threw ${e.message}`; } try { b = toHtml(publishedConfig, d); } catch (e) { b = `threw ${e.message}`; } return { same: a === b, a: a.length, b: b.length, threw: a.startsWith("threw") ? a : null }; };
    return { seed: one(seed), event: one(event) };
  });
  ok("no morph, try document: markup as before the wiring", same.seed.same && !same.seed.threw, same.seed);
  // Not asserted here: its data blocks need Next's router outside Next, so both throw. sunjay-probe-drive.cjs compares it through the real server config.
  console.log("TRACE identity", JSON.stringify(same));

  // ------------------------------------------------------------- the stored template, opened and saved
  const errsBefore = errs.length;
  await editor("#doc=sunjay-event-detail.json");
  errs.splice(errsBefore); // Blocks that need Next's router draw a stand-in here, and React logs what the boundary caught. They are listed below.
  const stored = JSON.parse(fs.readFileSync("/h/sunjay-event-detail.json", "utf8"));
  const roundTrip = await p.evaluate((d) => window.kit.chain(d).out, stored);
  const sortKeys = (v) => Array.isArray(v) ? v.map(sortKeys) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])])) : v;
  ok("event-detail through the save path: no prop lost", JSON.stringify(sortKeys(roundTrip)) === JSON.stringify(sortKeys(stored)));
  const standins = await p.$$eval("[data-tree-standin]", (l) => l.map((e) => e.textContent.slice(0, 60)));
  console.log("TRACE event-detail stand-ins", JSON.stringify(standins));
  await shot("8-event-detail");

  // ------------------------------------------------------------- the way back: Puck's editor keeps morph
  await p.evaluate(() => sessionStorage.getItem("sunjay-try-saved"));
  await open("#puck"); await p.waitForTimeout(1500);
  await shot("9-puck");
  await p.getByText("Publish", { exact: true }).first().click(); // By its words: a block's description in the drawer also says Publish.
  await p.waitForFunction(() => window.published?.length > 0, null, { timeout: 8000 }).catch(() => {});
  const data = await p.evaluate(() => window.published?.[0]);
  ok("Puck's Publish reaches the host", !!data, await p.evaluate(() => window.published));
  if (data) {
    const m = []; walk(data.content, (n) => { if (n.props.morph) m.push(n.props.id); });
    ok("Puck's editor keeps morph on save", m.length === morphs.length, m);
    ok("and the page's noindex", data.root?.props?.noindex === true, data.root?.props);
    const chained = await p.evaluate((d) => window.kit.chain(d).out, data);
    ok("and it survives the save path", JSON.stringify(nodeIn(chained, "try-banner").props.morph) === JSON.stringify(nodeIn(saved, "try-banner").props.morph), nodeIn(chained, "try-banner").props.morph);
  }

  ok("no page errors", errs.length === 0, [...new Set(errs)].slice(0, 6));
  console.log(`pass ${pass} fail ${fail}`);
  await b.close().catch(() => {});
  process.exit(0);
})().catch((e) => { console.log("ERR", e.stack || e.message, `pass ${pass} fail ${fail}`); process.exit(1); });
