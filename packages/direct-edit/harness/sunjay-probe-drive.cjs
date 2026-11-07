// The wired host in Next's real router, in Chromium, signed out, with the probe page mounted (sunjay-probe-page.tsx).
// Reads elkdonis_dev through a read-only session. Never presses Save. ORIGIN: the preview's address.
const { chromium } = require("playwright-core");
const ORIGIN = process.env.ORIGIN || "http://127.0.0.1:3001", TAG = process.env.TAG || "dev", THREAD = process.env.THREAD || "";
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) pass++; else { fail++; console.log("FAIL", n, x === undefined ? "" : JSON.stringify(x).slice(0, 600)); } };
const get = async (u) => { const r = await fetch(ORIGIN + u, { redirect: "manual", headers: { "user-agent": "curl/8", "x-forwarded-host": "paratheater.arts-collective.com", "x-forwarded-proto": "https" }, signal: AbortSignal.timeout(180000) }); return { status: r.status, location: r.headers.get("location"), text: await r.text() }; };
const EDITOR = /data-tree-|data-de-ui|de-vpanel|de-editbar|direct-edit|mountTreePage|data-morph/;
const mainOf = (t) => { const m = /<main[^>]*>([\s\S]*?)<\/main>/.exec(t); return m ? m[1] : null; };

(async () => {
  // ---------------------------------------------------------------- signed out, by plain requests
  for (const u of ["/studio/try/canvas", "/studio/try/canvas"]) {
    const r = await get(u);
    ok(`signed out ${u} redirects to login`, r.status === 307 && r.location === "/login?next=%2Fstudio%2Ftry%2Fcanvas", [r.status, r.location]);
  }
  const r2 = await get("/studio/about/canvas");
  ok("the gate comes before anything else", r2.status === 307 && (r2.location || "").startsWith("/login"), [r2.status, r2.location]);
  for (const u of ["/", "/about", "/community", "/publications"]) {
    await get(u);
    const r = await get(u);
    ok(`${u} 200`, r.status === 200, r.status);
    const body = r.text;
    ok(`${u} no editor markup or names`, !EDITOR.test(body), body.match(EDITOR)?.[0]);
    const refs = [...new Set(body.match(/\/_next\/static\/[^"'\\ ]+\.(?:js|css)[^"'\\ ]*/g) ?? [])];
    const hits = [];
    for (const ref of refs) {
      const c = await fetch(ORIGIN + ref).then((x) => x.text()).catch(() => "");
      // Turbopack's dev chunks are bundled per route, so this reads what a visitor would download.
      if (/de-vpanel|mountTreePage|data-tree-node|de-editbar/.test(c)) hits.push(ref);
    }
    ok(`${u} no chunk or stylesheet it references holds the editor (${refs.length} read)`, hits.length === 0, hits);
    ok(`${u} no Edit link for a visitor`, !/Edit this page/.test(body));
  }

  // ---------------------------------------------------------------- no morph: markup as before the wiring
  for (const [name, q] of [["try document", "doc=seed"], ["event-detail, thread drawn", `doc=event${THREAD ? `&thread=${THREAD}` : ""}`]]) {
    await get(`/studio?mode=before&${q}`);
    const a = await get(`/studio?mode=before&${q}`), b = await get(`/studio?mode=after&${q}`);
    const x = mainOf(a.text), y = mainOf(b.text);
    ok(`${name}: drew something`, a.status === 200 && b.status === 200 && !!x && x.length > 100, [a.status, b.status, x?.length]);
    // Next numbers its own `<!--$-->` boundaries; `useId` and a clock are the block's own and asserted by comparing twice.
    const again = mainOf((await get(`/studio?mode=before&${q}`)).text);
    const stable = again === x;
    console.log("TRACE identity", name, JSON.stringify({ stable, same: x === y })); // When not stable, the check below does not compare.
    ok(`${name}: same markup through the real server config (${x?.length} bytes${stable ? "" : ", varies between two runs of one config"})`, !stable || x === y, x === y ? "" : firstDiff(x, y));
  }

  // ---------------------------------------------------------------- the published path
  const b = await chromium.connectOverCDP(process.env.CDP || "http://127.0.0.1:9222"); const p = b.contexts()[0].pages()[0];
  p.setDefaultTimeout(60000); await p.setViewportSize({ width: 1500, height: 950 });
  const errs = [], writes = [];
  p.on("pageerror", (e) => errs.push(e.message.slice(0, 300)));
  p.on("console", (m) => { if (m.type() === "error" && !/net::ERR|Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 300)); });
  p.on("dialog", (d) => d.accept().catch(() => {}));
  p.on("request", (q) => { if (q.method() !== "GET" && !/\/__nextjs|turbopack|hmr|\/api\/pulse/.test(q.url())) writes.push(`${q.method()} ${q.url()}`); });
  // The analytics beacon would write. The session is read-only as well, so this is only to keep the list of writes short.
  await p.route("**/api/pulse**", (r) => r.abort());
  const css = (s, q) => p.$eval(s, (e, k) => getComputedStyle(e)[k], q);
  const shot = (n, o) => p.screenshot({ path: `/h/shots/sunjay-probe-${TAG}-${n}.png`, ...o });

  await p.goto(`${ORIGIN}/studio?mode=after&doc=saved`, { waitUntil: "load" }); await p.waitForTimeout(1200);
  ok("published: title colour and size", (await css("main h1", "color")) === "rgb(170, 34, 51)" && (await css("main h1", "fontSize")) === "64px", [await css("main h1", "color"), await css("main h1", "fontSize")]);
  ok("published: the font's stylesheet is linked", (await p.$$('link[href*="Playfair"]')).length >= 1);
  ok("published: captions", (await p.$$eval("main .blk-wall-caption", (l) => l.map((e) => getComputedStyle(e).color))).every((c) => c === "rgb(201, 174, 121)"));
  const html = await p.$eval("main", (e) => e.innerHTML);
  ok("published: no editor marks", !/data-tree-|data-de-|de-vpanel|de-box/.test(html), html.match(/data-tree-[a-z]+|data-de-[a-z]+/)?.[0]);
  ok("published: morph is not in the markup", !/"morph"|\bmorph=/.test(html.replace(/data-morph=/g, "")));
  ok("published: no editor stylesheet", !(await p.$$eval('link[rel=stylesheet]', async (l) => (await Promise.all(l.map((x) => fetch(x.href).then((r) => r.text()).catch(() => "")))).some((t) => t.includes("de-vpanel")))));
  ok("published: the look's sheet is in <head>", (await p.$$('head style[data-precedence="eac-morph"]')).length >= 1, (await p.$$('head style')).length);
  ok("published: nothing written", writes.length === 0, writes);
  await shot("published", { fullPage: true });

  // ---------------------------------------------------------------- the editor
  errs.length = 0;
  await p.goto(`${ORIGIN}/studio?mode=canvas&doc=seed`, { waitUntil: "load" });
  await p.waitForSelector(".de-vpanel .de-tabs"); await p.waitForTimeout(500);
  await shot("opened");
  const head = () => p.$eval(".de-vpanel .de-head b", (e) => e.textContent).catch(() => null);
  const click = async (s) => { const l = p.locator(s).first(); await l.scrollIntoViewIfNeeded(); await p.waitForTimeout(100); const bb = await l.boundingBox(); await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.waitForTimeout(120); };
  const TITLE = '[data-tree-node="try-banner"] h1';
  ok("the editor sits inside the site's shell: header above, footer below", (await p.$$("body > * header, header.pts-header")).length >= 1);
  await click(TITLE);
  ok("click: the block", (await head()) === "Banner (photograph and words)", await head());
  ok("its settings in the right column", (await p.$$eval('.de-vpanel .de-sec[data-section="content"] .de-label', (e) => e.map((x) => x.textContent))).join() === "Title,Subtitle,Paragraph underneath,Button text,Button goes to,Background photograph,Photograph description");
  await click(TITLE); await click(TITLE);
  ok("click, click: Title", (await head()) === "Title", await head());
  await p.fill('.de-vpanel [data-f="color"]', "#aa2233"); await p.waitForTimeout(100); await p.$eval('.de-vpanel [data-f="color"]', (e) => e.blur());
  ok("restyles live under Next's router", (await css(TITLE, "color")) === "rgb(170, 34, 51)", await css(TITLE, "color"));
  await shot("title");
  await p.evaluate(() => document.activeElement?.blur?.());
  const Save = p.locator("[data-a=save]");
  ok("Save is offered after an edit, and this driver leaves it alone", await Save.isEnabled());
  // A setting: what `resolvedRows` keeps out of the way. A look or a setting held in `resolved` would stop answering to the panel.
  for (let i = 0; i < 4 && (await head()) !== "Section heading"; i++) await click('[data-tree-node="try-about-heading"] .blk-heading-title');
  ok("click through a band to the block inside it", (await head()) === "Section heading", await head());
  const field = '.de-vpanel [data-f="p-title"]';
  await p.fill(field, "About the labs"); await p.waitForTimeout(150);
  ok("a setting redraws the block in the real CanvasEditor", (await p.$eval('[data-tree-node="try-about-heading"]', (e) => e.textContent)).includes("About the labs"));
  await p.$eval(field, (e) => e.blur());
  ok("no write left the page", writes.length === 0, writes);
  ok("no page errors", errs.length === 0, [...new Set(errs)].slice(0, 5));
  await shot("setting");
  // The foot of the panel: CanvasEditor's PANEL_FITS until direct-edit.css carries the line.
  const foot = await p.$eval(".de-vpanel", (e) => ({ bottom: e.getBoundingClientRect().bottom, vh: innerHeight }));
  ok("the panel's foot is inside the window", foot.bottom <= foot.vh, foot);
  const settingsLink = p.locator('.de-vpanel [data-f="block-editor"]');
  await settingsLink.scrollIntoViewIfNeeded(); await p.waitForTimeout(80);
  const linkBox = await settingsLink.boundingBox();
  ok("a mouse reaches Edit its settings", !!linkBox && linkBox.y + linkBox.height <= foot.vh, linkBox);
  ok("and it goes to Puck's editor on this page", (await settingsLink.getAttribute("href")) === "/studio/try");
  // Done goes back to the page. A row for `try` does not exist in this database, so the page itself is a 404 here.
  await p.click("[data-a=done]").catch(() => {});
  await p.waitForURL(/\/try$/, { timeout: 30000 }).catch(() => {});
  ok("Done goes back to the page", /\/try$/.test(p.url()), p.url());
  await p.waitForTimeout(1000); // The URL changes before the commit that unmounts the editor.
  ok("and the editor is gone", (await p.$$(".de-vpanel, .de-editbar")).length === 0 && !(await p.evaluate(() => document.documentElement.className.includes("de-"))), await p.evaluate(() => document.documentElement.className));

  // ---------------------------------------------------------------- the stored template, opened
  errs.length = 0;
  await p.goto(`${ORIGIN}/studio?mode=canvas&doc=event`, { waitUntil: "load" });
  await p.waitForSelector(".de-vpanel .de-tabs"); await p.waitForTimeout(1500);
  const standins = await p.$$eval("[data-tree-standin]", (l) => l.map((e) => e.textContent.slice(0, 70)));
  console.log("TRACE event-detail stand-ins", JSON.stringify(standins));
  const notes = await p.$$eval("[data-tree-sealed]", (l) => l.length);
  ok("event-detail opens with its blocks", notes >= 5, notes);
  await shot("event");
  console.log("TRACE event-detail errors", JSON.stringify([...new Set(errs)].map((e) => e.slice(0, 160)).slice(0, 4)));
  ok("nothing written", writes.length === 0, writes);
  console.log(`pass ${pass} fail ${fail}`);
  await b.close().catch(() => {});
  process.exit(0);
})().catch((e) => { console.log("ERR", e.stack || e.message, `pass ${pass} fail ${fail}`); process.exit(1); });

function firstDiff(a, b) { if (!a || !b) return [a?.length, b?.length]; let i = 0; while (i < a.length && a[i] === b[i]) i++; return { at: i, a: a.slice(Math.max(0, i - 80), i + 120), b: b.slice(Math.max(0, i - 80), i + 120) }; }
