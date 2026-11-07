// Drives Featured person in elktours' landing editor (2026-11-06).
// Run: ALIAS='{"@/lib/featured-person-actions":"/app/packages/direct-edit/harness/featured/actions-stub.ts"}' W=<scratch> \
//   bash ../frankenstein/run.sh featured/entry.tsx:fp.js -- featured.cjs   (with featured.cjs copied to $W/h and elk.css there)
const { chromium } = require("playwright-core");
const fs = require("fs");
const { serve } = require("./serve.cjs");
const page = `<!doctype html><meta charset=utf-8><link rel=stylesheet href=/elk.css><link rel=stylesheet href=/fp.css><body><main><div class="elk-landing"></div></main><script src=/fp.js></script>`;
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { cond ? pass++ : fail++; console.log(`${cond ? "pass" : "  FAIL"} ${name}${extra ? "  " + extra : ""}`); };
const DANA = "user:4eebc495-1db6-4b1e-a5b3-399326c78fe6", GURU = "user:fbf699b9-c708-440a-9abd-40f8953978e5", TOUR = "thread:elkNapol001tour000003";

(async () => {
  const srv = await serve("/h", page); fs.mkdirSync("/h/shots", { recursive: true });
  const b = await chromium.connectOverCDP("http://127.0.0.1:9222"); const p = b.contexts()[0].pages()[0];
  p.setDefaultTimeout(8000); await p.setViewportSize({ width: 1440, height: 900 });
  const errs = []; p.on("pageerror", (e) => errs.push((e.stack || e.message).slice(0, 300))); p.on("console", (m) => { if (m.type() === "error" && !/ERR_INTERNET_DISCONNECTED|404/.test(m.text())) errs.push("console: " + m.text().slice(0, 200)); });
  p.on("dialog", (d) => d.accept());
  await p.goto("http://127.0.0.1:8123/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForSelector('[data-tree-node="fp-b"]', { timeout: 30000 }); await p.waitForTimeout(500);
  const node = (id) => p.locator(`.de-tree-host [data-tree-node="${id}"], [data-tree-node="${id}"]`).first();
  const text = async (id) => (await node(id).innerText()).replace(/\s+/g, " ").trim();
  const calls = () => p.evaluate(() => ({ ...globalThis.__calls }));
  // A click on the page selects the outermost box first (click deeper for more); select by id, as the layer tree does.
  const clickNode = async (id) => { await p.evaluate((id) => globalThis.__editor.select(id), id); await p.waitForTimeout(250); };
  const panel = ".de-vpanel";

  ok("stored person drawn from what the page handed over", /Dana McCool/.test(await text("fp-b")), await text("fp-b"));
  ok("no fetch for a stored person", (await calls()).who === 0, JSON.stringify(await calls()));
  ok("unchosen block shows the editor's note", /choose who it shows/.test(await text("fp-a")), await text("fp-a"));
  await p.screenshot({ path: "/h/shots/fp-0.png" });

  // Choose from this site's people.
  await clickNode("fp-a");
  ok("panel names the block", /Featured person/.test(await p.locator(`${panel} .de-head`).first().innerText()));
  ok("Who is a chooser, not a text box", (await p.locator(`${panel} [data-f="bind-person"]`).count()) === 1 && (await p.locator(`${panel} #de-p-person`).count()) === 0);
  ok("says nothing is chosen", /Not chosen yet/.test(await p.locator(`${panel} [data-f="bind-person"]`).innerText()));
  await p.click(`${panel} [data-f="bind-open-person"]`); await p.waitForSelector('.de-vdrawer [data-rec-source="org"]');
  ok("drawer asks From what?", /From what\?/.test(await p.locator(".de-vdrawer").innerText()));
  ok("sources: site people and the tours", (await p.locator(".de-vdrawer [data-rec-source]").count()) === 3);
  await p.fill(".de-vdrawer [data-f=rec-filter]", "napol"); await p.waitForTimeout(100);
  ok("filter narrows the sources", (await p.locator(".de-vdrawer [data-rec-source]").count()) === 1);
  await p.fill(".de-vdrawer [data-f=rec-filter]", ""); await p.waitForTimeout(100);
  await p.click('.de-vdrawer [data-rec-source="org"]'); await p.waitForSelector(`.de-vdrawer [data-rec-value="${GURU}"]`);
  await p.click(`.de-vdrawer [data-rec-value="${GURU}"]`); await p.waitForTimeout(400);
  ok("drawer closes on a choice", await p.locator(".de-vdrawer").isHidden());
  ok("block draws the chosen person", /Guru Dharam Singh/.test(await text("fp-a")), await text("fp-a"));
  ok("panel names them", /Guru Dharam Singh/.test(await p.locator(`${panel} [data-f="bind-person"]`).innerText()));
  ok("one fetch for the new value", (await calls()).who === 1);

  // Undo / redo follow the stored value.
  await p.click('[data-a="undo"]'); await p.waitForTimeout(300);
  ok("undo: no one again", /choose who it shows/.test(await text("fp-a")), await text("fp-a"));
  await p.click('[data-a="redo"]'); await p.waitForTimeout(300);
  ok("redo: the person again, no new fetch", /Guru Dharam Singh/.test(await text("fp-a")) && (await calls()).who === 1);

  // A choice that follows a tour; a person without a public profile cannot be chosen.
  await clickNode("fp-a");
  await p.click(`${panel} [data-f="bind-open-person"]`); await p.waitForSelector(`.de-vdrawer [data-rec-source="${TOUR}"]`);
  await p.click(`.de-vdrawer [data-rec-source="${TOUR}"]`); await p.waitForSelector(`.de-vdrawer [data-rec-value="${TOUR}:author"]`);
  ok("follows and fixed choices are apart", (await p.locator(".de-vdrawer [data-f=rec-follows] [data-rec-value]").count()) === 1 && (await p.locator(".de-vdrawer [data-f=rec-fixed] [data-rec-value]").count()) === 2);
  ok("no-public-profile person is disabled", await p.locator(".de-vdrawer [data-rec-value][disabled]").count() === 1);
  await p.locator(".de-vdrawer [data-rec-value][disabled]").click({ force: true }).catch(() => {}); await p.waitForTimeout(200);
  ok("clicking it does nothing", await p.locator(".de-vdrawer").isVisible());
  await p.click(`.de-vdrawer [data-rec-value="${TOUR}:author"]`); await p.waitForTimeout(400);
  ok("following choice draws today's person with their stored role", /Dana McCool/.test(await text("fp-a")) && /Author/i.test(await text("fp-a")), await text("fp-a"));
  ok("panel says it follows the tour", /Follows/.test(await p.locator(`${panel} [data-f="bind-person"]`).innerText()), await p.locator(`${panel} [data-f="bind-person"]`).innerText());
  await p.screenshot({ path: "/h/shots/fp-1-follow.png" });

  // Clear.
  await p.click(`${panel} [data-f="bind-open-person"]`); await p.waitForSelector(".de-vdrawer [data-f=rec-clear]");
  await p.click(".de-vdrawer [data-f=rec-clear]"); await p.waitForTimeout(300);
  ok("clear: no one shown", /choose who it shows/.test(await text("fp-a")));
  await p.click('[data-a="undo"]'); await p.waitForTimeout(300);

  // Popup: choose inside it, hand back.
  const bb = await node("fp-b").boundingBox(); await p.mouse.dblclick(bb.x + 30, bb.y + Math.min(bb.height / 2, 30));
  await p.waitForSelector(".de-popup", { timeout: 6000 }).catch(() => {});
  ok("double-click opens the popup", (await p.locator(".de-popup").count()) === 1);
  if (await p.locator(".de-popup").count()) {
    await p.waitForTimeout(500);
    const pop = ".de-popup";
    if (!(await p.locator(`${pop} [data-f="bind-open-person"]`).count())) { await p.locator(`${pop} .de-layer`).filter({ hasText: "Featured person" }).first().click().catch(() => {}); await p.waitForTimeout(300); }
    ok("popup panel has the chooser", (await p.locator(`${pop} [data-f="bind-open-person"]`).count()) === 1);
    await p.click(`${pop} [data-f="bind-open-person"]`); await p.waitForSelector(`${pop} [data-rec-source="org"]`);
    await p.click(`${pop} [data-rec-source="org"]`); await p.waitForSelector(`${pop} [data-rec-value="${GURU}"]`);
    await p.click(`${pop} [data-rec-value="${GURU}"]`); await p.waitForTimeout(400);
    ok("popup draws the new person", /Guru Dharam Singh/.test(await p.locator(`${pop} [data-tree-node="fp-b"]`).first().innerText()));
    ok("page under it still shows the old one", /Dana McCool/.test(await text("fp-b")));
    await p.screenshot({ path: "/h/shots/fp-2-popup.png" });
    await p.click(`${pop} [data-a="save"]`); await p.waitForTimeout(500);
    ok("Use on this page: popup closes", (await p.locator(".de-popup").count()) === 0);
    ok("page draws the handed-back person", /Guru Dharam Singh/.test(await text("fp-b")), await text("fp-b"));
    await p.click('[data-a="undo"]'); await p.waitForTimeout(300);
    ok("one undo returns the popup session", /Dana McCool/.test(await text("fp-b")), await text("fp-b"));
    // Discard: choose in the popup, close without using it.
    const b2 = await node("fp-b").boundingBox(); await p.mouse.dblclick(b2.x + 30, b2.y + Math.min(b2.height / 2, 30)); await p.waitForSelector(".de-popup");
    await p.waitForTimeout(400);
    if (!(await p.locator(`${pop} [data-f="bind-open-person"]`).count())) { await p.locator(`${pop} .de-layer`).filter({ hasText: "Featured person" }).first().click().catch(() => {}); await p.waitForTimeout(300); }
    await p.click(`${pop} [data-f="bind-open-person"]`); await p.waitForSelector(`${pop} [data-rec-source="org"]`);
    await p.click(`${pop} [data-rec-source="org"]`); await p.waitForSelector(`${pop} [data-rec-value="${GURU}"]`);
    await p.click(`${pop} [data-rec-value="${GURU}"]`); await p.waitForTimeout(300);
    // Escape with changes asks first: Use / Discard / Keep editing.
    await p.locator(`${pop} .de-vdrawer`).isHidden().then((h) => h || p.keyboard.press("Escape"));
    await p.keyboard.press("Escape"); await p.waitForSelector(`${pop} [data-ask="discard"]`, { state: "visible", timeout: 3000 }).catch(() => {});
    ok("leaving with a change asks first", await p.locator(`${pop} [data-ask="discard"]`).isVisible());
    await p.click(`${pop} [data-ask="discard"]`).catch(() => {}); await p.waitForTimeout(400);
    ok("discard closes the popup", (await p.locator(".de-popup").count()) === 0);
    ok("discard leaves the page's person", /Dana McCool/.test(await text("fp-b")), await text("fp-b"));
    await clickNode("fp-h1").catch(() => {});
    await clickNode("fp-b");
    ok("and its panel", /Dana McCool/.test(await p.locator(`${panel} [data-f="bind-person"]`).innerText()), await p.locator(`${panel} [data-f="bind-person"]`).innerText());
  }

  // Opens on the same block: a reviews popup with a Then step (2026-11-06).
  await clickNode("fp-b");
  ok("Opens is a chooser too", (await p.locator(`${panel} [data-f="bind-opens"]`).count()) === 1);
  await p.click(`${panel} [data-f="bind-open-opens"]`); await p.waitForSelector('.de-vdrawer [data-rec-source="reviews"]');
  ok("Opens asks: a page or a popup", /A page of this site/.test(await p.locator(".de-vdrawer").innerText()) && /Popup: reviews/.test(await p.locator(".de-vdrawer").innerText()));
  await p.click('.de-vdrawer [data-rec-source="reviews"]'); await p.waitForSelector('.de-vdrawer [data-rec-value*=">page:"]');
  await p.click('.de-vdrawer [data-rec-value*=">page:"]'); await p.waitForTimeout(400);
  ok("panel says what it opens", /reviews of L.h.ritage, then see the tour and book/i.test(await p.locator(`${panel} [data-f="bind-opens"]`).innerText()), await p.locator(`${panel} [data-f="bind-opens"]`).innerText());
  const link = await p.locator('[data-tree-node="fp-b"] a').first().evaluate((a) => ({ href: a.getAttribute("href"), opens: a.getAttribute("data-opens") })).catch(() => null);
  ok("the name now links to the record's page and carries the popup", !!link && link.href === "/tours/heritage" && /"key":"reviews"/.test(link.opens || ""), JSON.stringify(link));
  ok("the person is still drawn beside it", /Dana McCool/.test(await text("fp-b")));
  await p.click('[data-a="undo"]'); await p.waitForTimeout(300);
  const back = await p.locator('[data-tree-node="fp-b"] a').first().getAttribute("href").catch(() => null);
  ok("undo: the name links to the person again", back === "/about/dana-mccool", String(back));
  await p.click('[data-a="redo"]'); await p.waitForTimeout(300);

  // Save carries the references only.
  await p.click('.de-pill [data-a="save"], [data-a="save"]'); await p.waitForTimeout(500);
  const saved = await p.evaluate(() => globalThis.__saved);
  const fps = []; const walk = (l) => (l || []).forEach((n) => { if (n.type === "featured-person") fps.push(n.props); Object.values(n.props).forEach((v) => Array.isArray(v) && walk(v)); });
  walk(saved && saved.content);
  ok("saved: both blocks, references only", fps.length === 2 && fps.every((x) => !("who" in x)), JSON.stringify(fps));
  ok("saved values", fps.find((x) => x.id === "fp-a")?.person === `${TOUR}:author` && fps.find((x) => x.id === "fp-b")?.person === DANA, JSON.stringify(fps.map((x) => x.person)));
  ok("saved Opens, the reference only", fps.find((x) => x.id === "fp-b")?.opens === "popup:reviews:tour:elkNapol001tour000003>page:/tours/heritage" && fps.every((x) => !("opened" in x)), JSON.stringify(fps.map((x) => x.opens)));

  // Placing a new one from the right-click menu.
  await clickNode("box-hero");
  const hb = await node("box-hero").boundingBox(); await p.mouse.click(hb.x + 8, hb.y + 8, { button: "right" }); await p.waitForTimeout(300);
  const sub = p.locator("[data-open]").filter({ hasText: /Add/ }).first();
  if (await sub.count()) { await sub.hover(); await sub.click().catch(() => {}); await p.waitForTimeout(250); }
  const item = p.locator('[data-mi="add:featured-person"]');
  ok("right-click offers Featured person", (await item.count()) === 1, await p.locator("[data-mi]").evaluateAll((l) => l.map((e) => e.dataset.mi).join(",")).catch(() => ""));
  if (await item.count()) {
    await item.first().click(); await p.waitForTimeout(400);
    const n = await p.$$eval("[data-tree-type='featured-person']", (l) => l.length).catch(() => 0);
    const ids = await p.$$eval("[data-tree-type='featured-person']", (l) => l.map((e) => e.dataset.treeNode));
    const fresh = ids.find((i) => i !== "fp-a" && i !== "fp-b");
    ok("placed: a third Featured person, asking who", n === 3 && !!fresh && /choose who it shows/.test(await text(fresh)), `${n} ${fresh}`);
    ok("placed one is selected with the chooser", (await p.locator(`${panel} [data-f="bind-open-person"]`).count()) === 1);
  }

  // The block's own output, as a visitor's page gets it.
  const r = (props) => p.evaluate((x) => globalThis.__render(x), props);
  ok("visitor: no one, nothing drawn", (await r({ person: "user:x", who: null })) === "");
  const hostile = await r({ person: DANA, who: { displayName: "<b>x</b>", photoUrl: "javascript:alert(1)", href: "//evil.example/x", bio: "<script>1</script>" } });
  ok("hostile values escaped, unsafe links and pictures dropped", !/<script|<b>|javascript:|evil\.example/.test(hostile), hostile.slice(0, 200));
  const plain = await r({ person: DANA, showPortrait: false, showBio: false, who: { displayName: "Dana", roleTitle: "Guide", bio: "a", href: "/about/dana" } });
  ok("switches hide portrait and bio; link to the person's page", !/portrait|fperson-bio/.test(plain) && /href="\/about\/dana"/.test(plain), plain);

  ok("no page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
  await p.screenshot({ path: "/h/shots/fp-3-end.png" });
  console.log(`\n${pass} passed, ${fail} failed`);
  srv.close(); await b.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
