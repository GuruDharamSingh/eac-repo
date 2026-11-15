// The piece picker in Para Theater's Puck Studio (2026-11-14). Run (from packages/direct-edit/harness):
//   ALIAS='{"@/lib/puck/writing-actions":"/app/packages/direct-edit/harness/event-detail/writing-actions-stub.ts"}' \
//   W=<scratch> bash frankenstein/run.sh event-detail/entry-studio.tsx:eds.js -- drive-studio.cjs
const { chromium } = require("playwright-core");
const fs = require("fs");
const { serve } = require("./serve.cjs");
const page = `<!doctype html><meta charset=utf-8><link rel=stylesheet href=/site.css><link rel=stylesheet href=/eds.css><body><div id="host"></div><script src=/eds.js></script>`;
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { cond ? pass++ : fail++; console.log(`${cond ? "pass" : "  FAIL"} ${name}${extra ? "  " + extra : ""}`); };
const CHOSEN = { post: { id: "p-why-masks", slug: "why-masks", title: "Why we wear masks", lede: "Its standfirst.", bodyHtml: "<p>Body.</p>", coverImageUrl: null, layout: "essay", series: "Notes from the lab", authorName: "Jason", bylineName: null, readingMinutes: 4, publishedAt: "2026-10-19T12:00:00.000Z" } };

(async () => {
  const srv = await serve("/h", page); fs.mkdirSync("/h/shots", { recursive: true });
  const b = await chromium.connectOverCDP("http://127.0.0.1:9222"); const p = b.contexts()[0].pages()[0];
  p.setDefaultTimeout(9000); await p.setViewportSize({ width: 1500, height: 950 });
  const errs = []; p.on("pageerror", (e) => errs.push((e.stack || e.message).slice(0, 300)));
  const asked = [];
  // The editor's resolver asks /api/blocks/pt-article with the chosen piece; the stand-in answers for it.
  await p.route(/\/api\/blocks\/pt-article/, (r) => { asked.push(r.request().url()); const piece = new URL(r.request().url()).searchParams.get("piece"); r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(piece === "why-masks" ? CHOSEN : {}) }); });
  await p.goto("http://127.0.0.1:8123/", { waitUntil: "domcontentloaded", timeout: 60000 });
  const f = await (await p.waitForSelector("iframe", { timeout: 20000 })).contentFrame();
  const ART = '[data-puck-component="st-article"]';
  await f.waitForSelector(ART, { timeout: 20000 }); await p.waitForTimeout(1500);
  const item = () => p.evaluate(() => globalThis.__getPuck().getItemById("st-article")?.props ?? null);
  ok("unchosen: the example piece is drawn (no piece on this site in the stand-in)", /A piece of writing/.test(await f.locator(ART).innerText()));

  const el = f.locator(`${ART} h1, ${ART} .eac-article__title`).first(); await el.scrollIntoViewIfNeeded(); const bb = await el.boundingBox();
  await p.mouse.click(bb.x + 20, bb.y + 10); await p.waitForTimeout(700);
  ok("the article is selected", (await p.evaluate(() => globalThis.__getPuck().selectedItem?.props?.id)) === "st-article");
  const now = p.locator("[data-person-now]:visible").first();
  if (!(await p.locator("[data-person-open]:visible").count())) console.log("  right column:", JSON.stringify(await p.evaluate(() => {
    const labels = [...document.querySelectorAll("label, [class*=Label], [class*=label]")].map((e) => e.textContent.trim()).filter((t) => t && t.length < 60);
    const inputs = [...document.querySelectorAll("input, textarea, select")].map((i) => `${i.tagName}:${i.name || ""}=${(i.value || "").slice(0, 30)}`);
    return { labels: [...new Set(labels)].slice(0, 30), inputs: inputs.slice(0, 20) };
  })));
  ok("Piece is a chooser in Puck's right column, not a text box", (await p.locator("[data-person-open]:visible").count()) === 1 && /Not chosen yet/.test(await now.innerText()));
  await p.click("[data-person-open]:visible"); await p.waitForSelector('.de-person-chooser:visible [data-rec-source="all"]');
  ok("From what? lists the site's writing and its series", (await p.locator(".de-person-chooser:visible [data-rec-source]").count()) === 2);
  await p.click('.de-person-chooser:visible [data-rec-source="all"]'); await p.waitForSelector('.de-person-chooser:visible [data-rec-value="why-masks"]');
  ok("…then its pieces, with date, author and series", /Why we wear masks/.test(await p.locator(".de-person-chooser:visible").innerText()) && /Notes from the lab/.test(await p.locator(".de-person-chooser:visible").innerText()));
  await p.click('.de-person-chooser:visible [data-rec-value="why-masks"]'); await p.waitForTimeout(1500);
  ok("Puck stores the slug", (await item())?.piece === "why-masks", JSON.stringify((await item())?.piece));
  ok("the resolver asked for that piece", asked.some((u) => /piece=why-masks/.test(u)), asked.slice(-2).join(" "));
  ok("the canvas draws it", /Why we wear masks/.test(await f.locator(ART).innerText()));
  ok("the panel names it and its series", /Why we wear masks \(Notes from the lab\)/.test(await p.locator("[data-person-now]:visible").first().innerText()), await p.locator("[data-person-now]:visible").first().innerText());
  await p.screenshot({ path: "/h/shots/studio-piece.png", timeout: 4000 }).catch(() => {});
  ok("no page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  srv.close(); await b.close().catch(() => {}); process.exit(0);
})().catch((e) => { console.log("CRASH", e.stack || e.message); console.log(`\n${pass} passed, ${fail + 1} failed`); process.exit(1); });
