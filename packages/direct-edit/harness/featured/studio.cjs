// Drives elktours' Puck Studio for site pages (2026-11-06). Run: ALIAS=<actions stubs> W=<scratch> bash ../frankenstein/run.sh featured/entry-studio.tsx:fs.js -- studio.cjs
const { chromium } = require("playwright-core");
const fs = require("fs");
const { serve } = require("./serve.cjs");
// The CSS inline: Puck's canvas waits for each mirrored <link> to fire load, which did not happen in this sandbox (2026-11-06); <style> counts at once.
const page = `<!doctype html><meta charset=utf-8><style>${fs.readFileSync("/h/fs.css", "utf8").replace(/@import[^;]*;/g, "")}</style><body><div id="host"></div><script src=/fs.js></script>`;
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { cond ? pass++ : fail++; console.log(`${cond ? "pass" : "  FAIL"} ${name}${extra ? "  " + extra : ""}`); };
const DANA = "user:4eebc495-1db6-4b1e-a5b3-399326c78fe6", GURU = "user:fbf699b9-c708-440a-9abd-40f8953978e5";

(async () => {
  const srv = await serve("/h", page); fs.mkdirSync("/h/shots", { recursive: true });
  const b = await chromium.connectOverCDP("http://127.0.0.1:9222"); const p = b.contexts()[0].pages()[0];
  p.setDefaultTimeout(9000); await p.setViewportSize({ width: 1500, height: 950 });
  const errs = []; p.on("pageerror", (e) => errs.push((e.stack || e.message).slice(0, 300))); p.on("console", (m) => { if (m.type() === "error" && !/ERR_INTERNET_DISCONNECTED|404|Failed to load resource/.test(m.text())) errs.push("console: " + m.text().slice(0, 200)); });
  p.on("dialog", (d) => d.accept());
  await p.goto("http://127.0.0.1:8123/", { waitUntil: "domcontentloaded", timeout: 60000 });
  const frameEl = await p.waitForSelector("iframe", { timeout: 30000 }); const f = await frameEl.contentFrame();
  const FP = '[data-puck-component="fp-s"]';
  await f.waitForSelector(FP, { timeout: 30000 }); await p.waitForTimeout(1500);
  const fpText = async () => (await f.locator(FP).first().innerText()).replace(/\s+/g, " ").trim();
  // Puck zooms the iframe (CSS scale): canvas coordinates are scaled to page coordinates.
  const at = async (sel) => { const r = await f.$eval(sel, (e) => { e.scrollIntoView({ block: "center" }); const b = e.getBoundingClientRect(); return { x: b.x + Math.min(b.width / 2, 40), y: b.y + Math.min(b.height / 2, 20), iw: innerWidth }; }); const fb = await frameEl.boundingBox(); const k = fb.width / r.iw; await p.waitForTimeout(150); return { x: fb.x + r.x * k, y: fb.y + r.y * k }; };

  ok("catalogue blocks draw (heading, text)", /Walking notes/.test(await f.locator('[data-puck-component="hd"]').innerText()) && /look for/.test(await f.locator('[data-puck-component="pr"]').innerText()));
  ok("Featured person resolves in Studio", /Dana McCool/.test(await fpText()), await fpText());
  await p.screenshot({ path: "/h/shots/fs-0.png" });

  // Select the block: its fields in the right panel.
  const c = await at(FP); await p.mouse.click(c.x, c.y); await p.waitForTimeout(700);
  await p.screenshot({ path: "/h/shots/fs-sel.png" });
  ok("right panel: Who and Opens with the chooser, not text boxes", (await p.locator("[data-person-open]:visible").count()) === 2, String(await p.locator("[data-person-open]").count()));
  ok("says who it is now", /Dana McCool/.test(await p.locator("[data-person-now]:visible").first().innerText().catch(() => "")), await p.locator("[data-person-now]:visible").first().innerText().catch(() => ""));
  await p.locator("[data-person-open]:visible").first().click();
  await p.waitForSelector('.de-person-chooser [data-rec-source="org"]');
  ok("From what? in the panel", /From what\?/.test(await p.locator(".de-person-chooser").innerText()));
  await p.click('.de-person-chooser [data-rec-source="org"]'); await p.waitForSelector(`.de-person-chooser [data-rec-value="${GURU}"]`);
  await p.click(`.de-person-chooser [data-rec-value="${GURU}"]`); await p.waitForTimeout(1200);
  ok("block redraws with the chosen person", /Guru Dharam Singh/.test(await fpText()), await fpText());
  ok("panel follows", /Guru Dharam Singh/.test(await p.locator("[data-person-now]:visible").first().innerText().catch(() => "")));
  await p.screenshot({ path: "/h/shots/fs-1-chosen.png" });

  // Popup: double-click, choose Dana inside it, hand back.
  const d = await at(FP); await p.mouse.dblclick(d.x, d.y); await p.waitForTimeout(900);
  ok("double-click opens the popup", (await p.locator(".de-popup").count()) === 1);
  if (await p.locator(".de-popup").count()) {
    const pop = ".de-popup";
    if (!(await p.locator(`${pop} [data-f="bind-open-person"]`).count())) { await p.locator(`${pop} .de-layer`).filter({ hasText: "Featured person" }).first().click().catch(() => {}); await p.waitForTimeout(300); }
    ok("popup has the chooser", (await p.locator(`${pop} [data-f="bind-open-person"]`).count()) === 1);
    ok("popup knows who without asking again", /Guru Dharam Singh/.test(await p.locator(`${pop} [data-f="bind-person"]`).innerText().catch(() => "")));
    await p.click(`${pop} [data-f="bind-open-person"]`); await p.waitForSelector(`${pop} [data-rec-source="org"]`);
    await p.click(`${pop} [data-rec-source="org"]`); await p.waitForSelector(`${pop} [data-rec-value="${DANA}"]`);
    await p.click(`${pop} [data-rec-value="${DANA}"]`); await p.waitForTimeout(500);
    ok("popup draws Dana", /Dana McCool/.test(await p.locator(`${pop} .de-popup-stage`).innerText()));
    await p.screenshot({ path: "/h/shots/fs-2-popup.png" });
    await p.locator(`${pop} button:visible`, { hasText: "Use on this page" }).first().click(); await p.waitForTimeout(1500);
    ok("popup closes", (await p.locator(".de-popup").count()) === 0);
    ok("Studio redraws the handed-back person", /Dana McCool/.test(await fpText()), await fpText());
  }

  // Publish: the reference, not the person.
  await p.locator("header").getByText("Publish", { exact: true }).first().click().catch(() => {}); await p.waitForTimeout(1200);
  const pub = await p.evaluate(() => globalThis.__published);
  const node = pub && (pub.data.content || []).find((n) => n.props && n.props.id === "fp-s");
  ok("published with the reference", !!node && node.props.person === DANA, JSON.stringify(node && node.props).slice(0, 200));
  ok("what the resolver drew is sent too (the server action strips it)", !!node && "who" in node.props);

  ok("no page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
  await p.screenshot({ path: "/h/shots/fs-3-end.png" });
  console.log(`\n${pass} passed, ${fail} failed`);
  srv.close(); await b.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
