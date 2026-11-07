// Screenshots of the pages in /out/manifest.tsv, in one browser, signed out, one page at a time.
// Run by live-snapshot.sh inside the Playwright image; see there for the docker flags.
//
// How a browser reaches the edge: the container has <host> mapped to 127.0.0.1 (--add-host), this
// script listens on 127.0.0.1:443 and forwards to host.docker.internal:<edge port>. The browser
// therefore asks for https://<host>/ with the right SNI and no port, as a visitor does, and an
// absolute link to the site works. No browser flag or preference is involved, so it is the same
// for Chromium, Firefox and WebKit.
//
// What it refuses, in every browser:
//   anything but GET and HEAD (the analytics beacon POSTs to /api/pulse, which writes to the database);
//   navigator.sendBeacon, replaced before any page script runs;
//   router prefetches (a prefetch of a forum thread would run the page that records a view);
//   logout paths; any other host (recorded, so a page depends only on this site). Playwright's route
//   sees the first request of a redirect chain only, which is why the user agent below matters.
// It scrolls and it waits. It does not click, type or press anything.
const net = require("net"), fs = require("fs"), path = require("path");
const pw = require("playwright-core");

const HOST = process.env.HOST, EDGE_PORT = Number(process.env.EDGE_PORT || 30022), BROWSER = process.env.BROWSER || "chromium";
const WIDTHS = (process.env.WIDTHS || "1440 390").split(/\s+/).filter(Boolean).map(Number);
const OUT = process.env.OUT || "/out", MAX_H = 12000, PAUSE = Number(process.env.PAUSE || 250);
const log = (s) => console.log(s);

const forwarder = () => new Promise((resolve, reject) => {
  const srv = net.createServer((c) => {
    const up = net.connect(EDGE_PORT, "host.docker.internal");
    c.on("error", () => up.destroy()); up.on("error", () => c.destroy());
    c.pipe(up); up.pipe(c);
  });
  srv.on("error", reject); srv.listen(443, "127.0.0.1", () => resolve(srv));
});

const INIT = `
  try { navigator.sendBeacon = function () { window.__benchBeacons = (window.__benchBeacons || 0) + 1; return true; }; } catch (e) {}
  try { Object.defineProperty(navigator, "globalPrivacyControl", { get: function () { return true; } }); } catch (e) {}
`;

const manifest = () => fs.readFileSync(path.join(OUT, "manifest.tsv"), "utf8").trim().split("\n").filter(Boolean).map((l) => {
  const [n, key, p, status] = l.split("\t"); return { n: Number(n), key, path: p, status: Number(status) };
});

(async () => {
  const srv = await forwarder();
  const reach = { browser: BROWSER, how: `127.0.0.1:443 in the container forwarded to host gateway:${EDGE_PORT}; --add-host ${HOST}:127.0.0.1`, reachable: false };
  const shotsDir = path.join(OUT, "shots", BROWSER); fs.mkdirSync(shotsDir, { recursive: true });
  const browser = await pw[BROWSER].launch({ headless: true });
  reach.version = browser.version();

  // The site's arrival check (packages/auth-server/src/sso-proxy.ts) redirects a top-level visit through
  // arts-collective.com/api/auth/handoff unless the user agent reads as a robot. Headless Chromium's does, Firefox's and
  // WebKit's do not. The word "monitor" gives all three the same path and keeps every request on this one host.
  const probe = await browser.newPage(); const ua = await probe.evaluate(() => navigator.userAgent); await probe.close();
  reach.userAgent = `${ua} eac-bench-monitor`;
  const contextFor = async (width) => {
    const ctx = await browser.newContext({
      viewport: { width, height: 900 }, deviceScaleFactor: 1, reducedMotion: "reduce", colorScheme: "light",
      locale: "en-US", timezoneId: "UTC", ignoreHTTPSErrors: true, serviceWorkers: "block", userAgent: reach.userAgent,
    });
    await ctx.addInitScript(INIT);
    return ctx;
  };

  const shoot = async (ctx, page, file) => {
    const rec = { path: page.path, console: [], pageErrors: [], failed: [], refused: { nonGet: [], otherHost: [], prefetch: 0, logout: [] }, requests: 0, byType: {}, status: null, finalUrl: null };
    const p = await ctx.newPage();
    p.setDefaultTimeout(30000);
    await p.route("**/*", (route) => {
      const q = route.request(), url = q.url();
      if (!/^https?:/.test(url)) return route.continue();
      const u = new URL(url), m = q.method();
      if (m !== "GET" && m !== "HEAD") { rec.refused.nonGet.push(`${m} ${u.pathname}`); return route.abort(); }
      if (u.hostname !== HOST) { rec.refused.otherHost.push(u.hostname); return route.abort(); }
      if (u.searchParams.has("_rsc")) { rec.refused.prefetch++; return route.abort(); }
      if (/(^|\/)(logout|signout|sign-out)(\/|$)/i.test(u.pathname)) { rec.refused.logout.push(u.pathname); return route.abort(); }
      rec.requests++; const t = q.resourceType(); rec.byType[t] = (rec.byType[t] || 0) + 1;
      return route.continue();
    });
    // The bench's own refusals surface as console lines in Chromium; they are counted in rec.refused instead.
    p.on("console", (m) => { if (m.type() === "error" && !/net::ERR_FAILED/.test(m.text())) rec.console.push(m.text().slice(0, 240)); });
    p.on("pageerror", (e) => rec.pageErrors.push(e.message.slice(0, 240)));
    p.on("requestfailed", (q) => { const e = q.failure()?.errorText ?? ""; if (new URL(q.url()).hostname === HOST && !/aborted|NS_BINDING_ABORTED|cancelled|BLOCKED/i.test(e) && !/_rsc=/.test(q.url())) rec.failed.push(`${new URL(q.url()).pathname} ${e}`.slice(0, 200)); });
    p.on("response", (r) => { const s = r.status(); if (s >= 400 && new URL(r.url()).hostname === HOST) rec.failed.push(`${new URL(r.url()).pathname} ${s}`.slice(0, 200)); });
    try {
      const res = await p.goto(`https://${HOST}${page.path}`, { waitUntil: "load", timeout: 45000 });
      rec.status = res ? res.status() : null; rec.finalUrl = p.url();
      await p.waitForLoadState("networkidle", { timeout: 6000 }).catch(() => {});
      // Lazy pictures load only when near the viewport (docs/reference/testing.md, step 7).
      const height = await p.evaluate(async () => {
        const step = Math.max(300, innerHeight - 100), H = () => document.documentElement.scrollHeight;
        // "instant": a page's own scroll-behavior: smooth would leave the scroll mid-way when the picture is taken (seen in Firefox).
        for (let y = 0; y < H() && y < 30000; y += step) { window.scrollTo({ top: y, behavior: "instant" }); await new Promise((r) => setTimeout(r, 90)); }
        window.scrollTo({ top: 0, behavior: "instant" }); return H();
      });
      await p.waitForLoadState("networkidle", { timeout: 4000 }).catch(() => {});
      await p.evaluate(() => document.fonts?.ready).catch(() => {});
      await p.waitForTimeout(150);
      rec.height = height; rec.scrollWidth = await p.evaluate(() => document.documentElement.scrollWidth); rec.beacons = await p.evaluate(() => window.__benchBeacons || 0);
      const opts = { path: file, animations: "disabled", caret: "hide", timeout: 45000 };
      if (height > MAX_H) { await p.setViewportSize({ width: ctx.__w, height: 900 }); await p.screenshot({ ...opts, fullPage: true, clip: { x: 0, y: 0, width: ctx.__w, height: MAX_H } }); rec.clipped = MAX_H; }
      else await p.screenshot({ ...opts, fullPage: true });
    } catch (e) { rec.error = e.message.split("\n")[0].slice(0, 300); }
    rec.refused.otherHost = [...new Set(rec.refused.otherHost)].sort();
    await p.close();
    return rec;
  };

  // Reachability first: a browser that cannot load the home page says so and stops here.
  try {
    const ctx = await contextFor(1440); ctx.__w = 1440; const p = await ctx.newPage();
    await p.route("**/*", (r) => { const m = r.request().method(); return (m === "GET" || m === "HEAD") && new URL(r.request().url()).hostname === HOST && !new URL(r.request().url()).searchParams.has("_rsc") ? r.continue() : r.abort(); });
    const res = await p.goto(`https://${HOST}/`, { waitUntil: "domcontentloaded", timeout: 30000 });
    reach.status = res?.status(); reach.reachable = !!res && res.status() < 500; await ctx.close();
  } catch (e) { reach.error = e.message.split("\n")[0].slice(0, 300); }
  fs.writeFileSync(path.join(shotsDir, "reach.json"), JSON.stringify(reach, null, 2));
  log(`${BROWSER} ${reach.version}: reachable=${reach.reachable} ${reach.error ?? ""}`);
  if (!reach.reachable) { await browser.close(); srv.close(); process.exit(3); }

  const pages = manifest().filter((x) => x.status === 200);
  let done = 0, failed = 0;
  for (const w of WIDTHS) {
    const dir = path.join(shotsDir, String(w)); fs.mkdirSync(dir, { recursive: true });
    const ctx = await contextFor(w); ctx.__w = w;
    for (const page of pages) {
      const rec = await shoot(ctx, page, path.join(dir, `${page.key}.png`));
      fs.writeFileSync(path.join(dir, `${page.key}.json`), JSON.stringify(rec, null, 1));
      done++; if (rec.error) { failed++; log(`  error ${w} ${page.path}: ${rec.error}`); }
      await new Promise((r) => setTimeout(r, PAUSE));
    }
    const cookies = await ctx.cookies();
    fs.writeFileSync(path.join(dir, "_cookies.json"), JSON.stringify(cookies.map((c) => c.name), null, 1));
    await ctx.close();
    log(`  width ${w}: ${pages.length} pages`);
  }
  log(`${BROWSER}: ${done} screenshots attempted, ${failed} errors`);
  await browser.close(); srv.close(); process.exit(0);
})().catch((e) => { console.error("ERR", e.message); process.exit(2); });
