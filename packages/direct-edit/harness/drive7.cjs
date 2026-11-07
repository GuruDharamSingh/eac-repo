const { chromium } = require("playwright-core");
const http = require("http"), fs = require("fs"), path = require("path");
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==", "base64");
let uploads = 0;
const srv = http.createServer((q, r) => {
  const u = q.url.split("?")[0];
  if (u === "/api/upload" && q.method === "POST") { uploads++; q.resume(); q.on("end", () => { r.writeHead(200, { "content-type": "application/json" }); r.end(JSON.stringify({ url: "/api/media/EAC_Network/x/Media/Images/uploaded.png" })); }); return; }
  if (u === "/api/media/library") { r.writeHead(200, { "content-type": "application/json" }); r.end(JSON.stringify({ items: [{ name: "River.png", url: "/api/media/EAC_Network/x/Media/Images/river.png" }, { name: "Secret.png", url: "/api/media/EAC_Network/x/Private/Media/secret.png" }] })); return; }
  if (u === "/api/media/library/mine") { r.writeHead(200, { "content-type": "application/json" }); r.end(JSON.stringify({ items: [{ name: "Mine.png", url: "/api/media/users/me/Mine.png" }] })); return; }
  if (u.startsWith("/api/media/")) { r.writeHead(200, { "content-type": "image/png" }); r.end(PNG); return; }
  fs.readFile(path.join("/h", u), (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { "content-type": u.endsWith(".css") ? "text/css" : u.endsWith(".js") ? "text/javascript" : "text/html" }); r.end(d); });
});
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else { fail++; console.log("FAIL", n, x === undefined ? "" : JSON.stringify(x)); } };
(async () => {
  await new Promise((r) => srv.listen(8123, "127.0.0.1", r));
  const b = await chromium.connectOverCDP("http://127.0.0.1:9222"); const p = b.contexts()[0].pages()[0];
  p.setDefaultTimeout(15000); p.on("pageerror", (e) => ok("pageerror", false, e.message)); await p.setViewportSize({ width: 1500, height: 950 });
  await p.goto("http://127.0.0.1:8123/pick.html"); await p.waitForSelector(".de-vpanel .de-tabs");
  const bg = () => p.$eval("#band", (e) => getComputedStyle(e).backgroundImage);
  const box = await p.locator("#h2a").boundingBox(); const x = box.x + 10, y = box.y + 8;
  await p.mouse.click(x, y); await p.mouse.click(x, y);
  ok("section selected", (await p.$eval(".de-vpanel .de-head b", (e) => e.textContent)) === "Section");
  ok("no address box", (await p.$$("#de-image")).length === 0);
  await p.click('[data-f="choose"]'); await p.waitForSelector(".eac-picker");
  ok("drawer open", await p.$eval(".de-vdrawer", (e) => !e.hidden));
  const tabs = await p.$$eval(".eac-picker-tabs button", (e) => e.map((x) => x.textContent)); ok("sources", tabs.join() === "Upload,This site,My files", tabs);
  await p.screenshot({ path: "/h/shots/k-upload.png" });
  // Library pick
  await p.click('.eac-picker-tabs button:has-text("This site")'); await p.waitForSelector('.de-vdrawer button[title="River.png"]');
  await p.screenshot({ path: "/h/shots/k-library.png" });
  // Private refused
  await p.click('.de-vdrawer button[title="Secret.png"]');
  await p.waitForTimeout(80);
  ok("private refused", !(await bg()).includes("secret"), await bg());
  ok("private explained", (await p.textContent(".de-editbar-hint")).includes("private"), await p.textContent(".de-editbar-hint"));
  ok("drawer stays", await p.$eval(".de-vdrawer", (e) => !e.hidden));
  await p.click('.de-vdrawer button[title="River.png"]'); await p.waitForTimeout(80);
  ok("library picture applied", (await bg()).includes("river.png"), await bg());
  ok("drawer closed", await p.$eval(".de-vdrawer", (e) => e.hidden));
  ok("thumb and fit shown", (await p.$$(".de-picture-thumb")).length === 1 && (await p.$$('[data-f="fit-contain"]')).length === 1);
  await p.screenshot({ path: "/h/shots/k-applied.png" });
  await p.click("[data-a=undo]"); ok("undo", !(await bg()).includes("river"), await bg());
  // Upload
  await p.click('[data-f="choose"]'); await p.waitForSelector(".eac-picker input[type=file]", { state: "attached" });
  await p.setInputFiles(".eac-picker input[type=file]", { name: "new.png", mimeType: "image/png", buffer: PNG }); await p.waitForFunction(() => document.querySelector(".de-vdrawer").hidden);
  ok("upload applied", (await bg()).includes("uploaded.png") && uploads === 1, [await bg(), uploads]);
  // Remove
  await p.click('[data-f="clear-picture"]'); ok("removed", (await bg()) === "none", await bg());
  // Esc closes the drawer only
  await p.click('[data-f="choose"]'); await p.waitForSelector(".eac-picker");
  await p.keyboard.press("Escape"); await p.waitForTimeout(40);
  ok("esc closes drawer", await p.$eval(".de-vdrawer", (e) => e.hidden));
  ok("esc kept selection", (await p.$eval(".de-vpanel .de-head b", (e) => e.textContent)) === "Section");
  // Another box closes the drawer
  await p.click('[data-f="choose"]'); await p.waitForSelector(".eac-picker");
  await p.mouse.click(x, y); await p.waitForTimeout(40);
  ok("selecting closes drawer", await p.$eval(".de-vdrawer", (e) => e.hidden));
  ok("no uploads leaked", uploads === 1);
  await p.setViewportSize({ width: 400, height: 800 }); await p.click('[data-f="choose"]'); await p.waitForSelector(".eac-picker"); await p.waitForTimeout(80);
  await p.screenshot({ path: "/h/shots/k-phone.png" });
  ok("phone no sideways scroll", await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  console.log(`pass ${pass} fail ${fail}`); srv.close(); await b.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERR", e.message.slice(0, 400)); process.exit(2); });
