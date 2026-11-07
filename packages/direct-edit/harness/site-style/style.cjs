// Drives the site style editor on elktours' header and footer. Run: ALIAS=... W=... bash ../frankenstein/run.sh site-style/entry.tsx:ss.js -- style.cjs
const { chromium } = require("playwright-core");
const fs = require("fs");
const { serve } = require("./serve.cjs");
const page = `<!doctype html><meta charset=utf-8><link rel=stylesheet href=/elk.css><body class="flex min-h-screen flex-col"><div id="host" style="display:contents"></div><script src=/ss.js></script>`;
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { cond ? pass++ : fail++; console.log(`${cond ? "pass" : "  FAIL"} ${name}${extra ? "  " + extra : ""}`); };

(async () => {
  const srv = await serve("/h", page); fs.mkdirSync("/h/shots", { recursive: true });
  const b = await chromium.connectOverCDP("http://127.0.0.1:9222"); const p = b.contexts()[0].pages()[0];
  p.setDefaultTimeout(9000); await p.setViewportSize({ width: 1440, height: 900 });
  const errs = []; p.on("pageerror", (e) => errs.push((e.stack || e.message).slice(0, 300))); p.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 200)); });
  const load = async () => { await p.goto("http://127.0.0.1:8123/", { waitUntil: "domcontentloaded", timeout: 60000 }); await p.waitForSelector('[data-chrome="header"]', { timeout: 30000 }); await p.waitForTimeout(500); };
  await p.goto("http://127.0.0.1:8123/", { waitUntil: "domcontentloaded", timeout: 60000 }); await p.evaluate(() => localStorage.clear()); await load();
  const cs = (sel, prop) => p.$eval(sel, (e, prop) => getComputedStyle(e)[prop], prop);
  const fillText = async (sel, v) => { await p.locator(sel).first().fill(v); await p.locator(sel).first().press("Enter"); await p.waitForTimeout(150); };
  const url0 = p.url();
  const bg0 = await cs("body", "backgroundImage");
  ok("site as designed: the page's own gradient", /gradient/.test(bg0), bg0.slice(0, 60));
  ok("no site style sheet for visitors yet", (await p.locator("style[data-site-style]").count()) === 0);
  await p.screenshot({ path: "/h/shots/ss-0-before.png" });

  // Open.
  await p.click("[data-site-style-open]"); await p.waitForSelector('[aria-label="Site style"]');
  ok("drawer opens, page makes room", (await cs("body", "marginRight")) === "360px");

  // Theme.
  await fillText('[data-ctl-text="--background"]', "#f4efe6");
  ok("page colour previews", (await cs("body", "backgroundColor")) === "rgb(244, 239, 230)", await cs("body", "backgroundColor"));
  const warn = await p.locator('[data-contrast="--foreground"]').innerText();
  ok("ivory text on cream warns", /hard to read/.test(warn), warn);
  await fillText('[data-ctl-text="--foreground"]', "#1b1e23");
  ok("dark text clears the warning", !/hard to read/.test(await p.locator('[data-contrast="--foreground"]').innerText()), await p.locator('[data-contrast="--foreground"]').innerText());
  ok("text colour previews", (await cs("main h1", "color")) === "rgb(27, 30, 35)", await cs("main h1", "color"));
  await p.selectOption('[data-ctl="--site-font-heading"]', { label: "Playfair Display" });
  ok("heading font previews", /Playfair Display/.test(await cs("main h1", "fontFamily")), await cs("main h1", "fontFamily"));
  await fillText('[data-ctl="--radius"]', "0.5rem");
  const radius = () => p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--radius").trim());
  ok("corners preview (--radius)", (await radius()) === "0.5rem", await radius());
  await fillText('[data-ctl="--radius"]', "1px; } body { display:none");
  ok("a hostile length is refused, the last good one stays", (await cs("body", "display")) !== "none" && (await radius()) === "0.5rem", await radius());
  ok("refusal is said", /Not kept/.test(await p.locator("[data-site-style-status]").innerText()), await p.locator("[data-site-style-status]").innerText());
  await fillText('[data-ctl="--radius"]', "0.5rem");

  // Header: pick by clicking the page.
  await p.click('[data-chrome="header"] [data-part="brand"]');
  ok("clicking the site name picks it, link does not navigate", p.url() === url0 && (await p.locator('[data-site-style-part="brand"]').evaluate((e) => getComputedStyle(e).fontWeight)) === "600");
  ok("outline on the site name", (await p.locator('[data-site-style-outline="brand"]').count()) === 1);
  await fillText('[data-ctl-text="color"]', "#b85c3a");
  ok("site name colour previews", (await cs('[data-part="brand"]', "color")) === "rgb(184, 92, 58)", await cs('[data-part="brand"]', "color"));
  await p.locator('[data-ctl="size"]').fill("28"); await p.waitForTimeout(150);
  ok("site name size previews", (await cs('[data-part="brand"]', "fontSize")) === "28px", await cs('[data-part="brand"]', "fontSize"));
  await p.locator('[data-ctl="css"]').fill("letter-spacing: 0.3em; position: fixed; background: url(https://x.example/a.png); z-index: 9"); await p.locator('[data-ctl="css"]').blur(); await p.waitForTimeout(200);
  const kept = await p.locator("[data-site-style-kept]").innerText();
  ok("CSS keeps spacing, refuses position, url and z-index", /letter-spacing/.test(kept) && !/position|url|z-index/.test(kept), kept);
  ok("refused position not drawn", (await cs('[data-part="brand"]', "position")) === "static" && (await cs('[data-chrome="header"]', "position")) === "sticky");
  await p.click('[data-chrome="header"] [data-part="active"]');
  ok("current page link picked", (await p.locator('[data-site-style-part="active"]').evaluate((e) => getComputedStyle(e).fontWeight)) === "600");
  await fillText('[data-ctl-text="fill"]', "#c9a25c");
  ok("current link fill previews", (await cs('[data-part="active"]', "backgroundColor")) === "rgb(201, 162, 92)");
  await p.click('[data-site-style-part="root"]');
  await fillText('[data-ctl-text="fill"]', "#10223a");
  ok("whole header fill previews", (await cs('[data-chrome="header"]', "backgroundColor")) === "rgb(16, 34, 58)", await cs('[data-chrome="header"]', "backgroundColor"));
  await p.screenshot({ path: "/h/shots/ss-1-header.png" });

  // Footer.
  await p.click('[data-chrome="footer"] [data-part="note"]');
  ok("clicking the footer note opens the Footer tab", (await p.locator('[data-site-style-tab="footer"]').evaluate((e) => getComputedStyle(e).backgroundColor)) === "rgb(29, 33, 41)");
  await p.check('[data-ctl="hide"]'); await p.waitForTimeout(150);
  ok("hidden note stays visible and faint while editing", (await cs('[data-part="note"]', "display")) !== "none" && Number(await cs('[data-part="note"]', "opacity")) < 0.5);
  await p.click('button[title="Undo"]'); await p.waitForTimeout(150);
  ok("undo shows the note again", Number(await cs('[data-part="note"]', "opacity")) === 1);
  await p.click('button[title="Redo"]'); await p.waitForTimeout(150);
  ok("redo hides it again", Number(await cs('[data-part="note"]', "opacity")) < 0.5);
  await p.screenshot({ path: "/h/shots/ss-2-footer.png" });

  // Save and close.
  await p.click("[data-site-style-save]"); await p.waitForTimeout(400);
  const saved = await p.evaluate(() => globalThis.__saved);
  ok("save hands over a cleaned style", !!saved?.theme?.["--background"] && saved?.chrome?.header?.brand?.color === "#b85c3a" && saved?.chrome?.footer?.note?.hide === true, JSON.stringify(saved).slice(0, 160));
  ok("stored CSS kept only the spacing", saved?.chrome?.header?.brand?.css === "letter-spacing: 0.3em;", saved?.chrome?.header?.brand?.css);
  ok("hsl stored as the site's triplet", saved?.theme?.["--background"] === "39 39% 93%", saved?.theme?.["--background"]);
  await p.click("[data-site-style-close]"); await p.waitForTimeout(300);
  ok("closed: drawer gone, margin back", (await p.locator('[aria-label="Site style"]').count()) === 0 && (await cs("body", "marginRight")) === "0px");
  ok("closed: saved look stays without a reload", (await cs('[data-part="brand"]', "color")) === "rgb(184, 92, 58)" && (await cs('[data-part="note"]', "display")) === "none");

  // Reload: drawn from storage the way the layout draws it.
  await load();
  ok("reload: page colour", (await cs("body", "backgroundColor")) === "rgb(244, 239, 230)");
  ok("reload: site name colour and size", (await cs('[data-part="brand"]', "color")) === "rgb(184, 92, 58)" && (await cs('[data-part="brand"]', "fontSize")) === "28px");
  ok("reload: footer note hidden for visitors", (await cs('[data-part="note"]', "display")) === "none");
  ok("reload: header still sticky", (await cs('[data-chrome="header"]', "position")) === "sticky");
  await p.screenshot({ path: "/h/shots/ss-3-reload.png" });
  // Phone width: the header's own phone menu still works and keeps its look.
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(200);
  await p.click('button[aria-label="Open menu"]'); await p.waitForTimeout(200);
  ok("phone: menu opens with the header fill", (await p.locator('[data-part="menu"]').count()) === 1 && (await cs('[data-chrome="header"]', "backgroundColor")) === "rgb(16, 34, 58)");
  await p.screenshot({ path: "/h/shots/ss-4-phone.png" });
  await p.setViewportSize({ width: 1440, height: 900 });

  // Hostile stored data.
  await p.evaluate(() => localStorage.setItem("stored", JSON.stringify({ v: 1, theme: { "--background": "red;}</style><script>alert(1)</script>", "--evil": "#000000", "--radius": "url(x)" }, chrome: { header: { brand: { color: "#ff0000", css: "x:y}body{display:none", pos: "absolute" }, constructor: { color: "#00ff00" } }, evil: { root: { color: "#000" } }, "__proto__": { root: { fill: "#000" } } } })));
  await load();
  const css = await p.evaluate(() => globalThis.__css);
  ok("hostile: no tag, no unknown variable, no unknown region", !/<|script|--evil|evil"|url\(|display:none/.test(css), css.slice(0, 200));
  ok("hostile: the one good value survives", /\[data-part="brand"\]\{color:#ff0000 !important\}/.test(css));
  ok("hostile: page still drawn with its own gradient", (await cs("body", "display")) !== "none" && /gradient/.test(await cs("body", "backgroundImage")));

  const real = errs.filter((e) => !/Failed to load resource|ERR_INTERNET_DISCONNECTED/.test(e));
  ok("no page errors", real.length === 0, [...new Set(real)].slice(0, 3).join(" | "));
  console.log(`\nsite-style ${pass}/${pass + fail}`);
  await b.close(); srv.close(); process.exit(0);
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
