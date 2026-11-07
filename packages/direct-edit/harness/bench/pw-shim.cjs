// Preloaded (node --require) in front of an unchanged harness driver. The drivers do
//   const { chromium } = require("playwright-core");
//   const b = await chromium.connectOverCDP("http://127.0.0.1:9222"); const p = b.contexts()[0].pages()[0];
// Here that launches the profile's browser instead (bench/profiles.cjs) and hands back its page.
//
// On a touch profile the page and its locators are wrapped so a mouse action becomes a touch action:
//   click, mouse.click        real tap (Playwright's tap; touchscreen.tap)
//   right click               long press. Chromium: its touch emulator, which fires contextmenu as Android does. WebKit:
//                             Playwright has no long press, so a contextmenu event is dispatched and "TRACE SYNTHETIC" is
//                             written to the log: that step shows what follows the menu, not that a finger can open it.
//   mouse.down/move/up        one finger. Chromium: its touch emulator. WebKit: dispatched pointer and touch events, traced.
//   hover, mouse.move         nothing: a finger does not hover.
//   setViewportSize           nothing on a locked profile.
//   scrollIntoViewIfNeeded    also moves the element clear of a bottom sheet, as a person would.
//
// With SOFT=1 a failed action does not end the driver: it writes "ACTION-FAIL", takes a screenshot and carries on, so
// one blocked step does not hide the steps after it. The checks after it may then fail as a consequence; read in order.
const Module = require("module"), fs = require("fs");
const real = require(process.env.PW_CORE || "/v/node_modules/playwright-core");
const PROFILES = require("./profiles.cjs");
const profile = PROFILES[process.env.PROFILE];
if (!profile) throw new Error(`unknown PROFILE ${process.env.PROFILE}`);
const SOFT = process.env.SOFT === "1";
const SOFT_TIMEOUT = Number(process.env.SOFT_TIMEOUT || 7000);
const say = (s) => console.log(s);
const tally = { actionFail: 0, synthetic: 0, clamped: 0, hoverDropped: 0 };
let failShot = 0;

const SOFT_METHODS = new Set(["click", "tap", "dblclick", "fill", "press", "type", "selectOption", "focus", "hover", "check", "uncheck",
  "waitForSelector", "waitForFunction", "textContent", "innerText", "inputValue", "getAttribute", "$eval", "scrollIntoViewIfNeeded", "isDisabled", "evaluate", "boundingBox"]);

const isLocator = (r) => r && r.constructor && r.constructor.name === "Locator";
const isHandle = (r) => r && r.constructor && r.constructor.name === "ElementHandle";

function softly(page, name, target, fn) {
  if (!SOFT || !SOFT_METHODS.has(name)) return fn();
  let pr;
  try { pr = fn(); } catch (e) { return report(page, name, target, e); }
  return Promise.resolve(pr).catch((e) => report(page, name, target, e));
}
async function report(page, name, target, e) {
  tally.actionFail++;
  const first = String(e.message || e).split("\n").filter(Boolean);
  // The line naming what covered the target is the useful one; keep it.
  const covered = first.find((l) => /intercepts pointer events/.test(l));
  say(`ACTION-FAIL ${name} ${String(target).slice(0, 110)}: ${first[0].slice(0, 140)}${covered ? ` [${covered.trim().slice(0, 170)}]` : ""}`);
  try { fs.mkdirSync("/h/shots", { recursive: true }); await page.screenshot({ path: `/h/shots/action-fail-${String(++failShot).padStart(3, "0")}.png`, timeout: 4000 }); } catch {}
  if (name === "boundingBox") return { x: 1, y: 1, width: 1, height: 1 };
  return undefined;
}

const clampPoint = (page, x, y) => {
  const v = page.viewportSize() || { width: 1e6, height: 1e6 };
  const cx = Math.max(4, Math.min(x, v.width - 4)), cy = Math.max(4, Math.min(y, v.height - 4));
  if (cx !== x || cy !== y) { tally.clamped++; say(`TRACE CLAMP point ${Math.round(x)},${Math.round(y)} is off a ${v.width}x${v.height} screen (the driver assumes a desktop)`); }
  return [cx, cy];
};

function fingers(page, cdp) {
  // Chromium's own touch emulator, as in DevTools device mode: it runs gesture recognition, so a held finger gives a
  // contextmenu and a moving finger can scroll the page. Input.dispatchTouchEvent does neither (checked 2026-11-04: a hold
  // through it ends in a click), and Input.synthesizeTapGesture with a long duration gives no contextmenu.
  const emulate = (on) => cdp.send("Emulation.setEmitTouchEventsForMouse", on ? { enabled: true, configuration: "mobile" } : { enabled: false });
  const send = (type, x, y) => cdp.send("Input.dispatchMouseEvent", { type, x, y, button: type === "mouseMoved" ? "none" : "left", buttons: type === "mouseReleased" ? 0 : 1, clickCount: 1 });
  const dispatch = (kind, x, y) => page.evaluate(([k, px, py]) => {
    const el = document.elementFromPoint(px, py) || document.body;
    const pointer = { start: "pointerdown", move: "pointermove", end: "pointerup" }[k], t = { start: "touchstart", move: "touchmove", end: "touchend" }[k];
    el.dispatchEvent(new PointerEvent(pointer, { bubbles: true, cancelable: true, composed: true, clientX: px, clientY: py, pointerId: 11, pointerType: "touch", isPrimary: true, button: k === "move" ? -1 : 0, buttons: k === "end" ? 0 : 1 }));
    try { const to = new Touch({ identifier: 11, target: el, clientX: px, clientY: py }); el.dispatchEvent(new TouchEvent(t, { bubbles: true, cancelable: true, composed: true, touches: k === "end" ? [] : [to], changedTouches: [to] })); } catch {}
  }, [kind, x, y]);
  const synth = (what) => { tally.synthetic++; say(`TRACE SYNTHETIC ${what}: ${profile.browser} has no such input in Playwright`); };
  return {
    tap: (x, y) => page.touchscreen.tap(x, y),
    async longPress(x, y) {
      if (cdp) { await emulate(true); await send("mousePressed", x, y); await page.waitForTimeout(1000); await send("mouseReleased", x, y); await emulate(false); await page.waitForTimeout(60); return; }
      synth(`long press at ${Math.round(x)},${Math.round(y)}, contextmenu dispatched`);
      await page.evaluate(([px, py]) => { (document.elementFromPoint(px, py) || document.body).dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, composed: true, clientX: px, clientY: py, button: 2, buttons: 2 })); }, [x, y]);
    },
    async start(x, y) { if (cdp) { await emulate(true); return send("mousePressed", x, y); } synth("finger down"); return dispatch("start", x, y); },
    async move(x, y) { if (cdp) return send("mouseMoved", x, y); return dispatch("move", x, y); },
    async end(x, y) { if (cdp) { await send("mouseReleased", x, y); return emulate(false); } return dispatch("end", x, y); },
  };
}

function wrapLocator(page, l, f) {
  return new Proxy(l, {
    get(t, k) {
      if (typeof k !== "string") return t[k];
      if (f) {
        if (k === "click") return (o = {}) => softly(page, "click", t, () => (o.button === "right" ? pressLocator(t, f, o) : t.tap(strip(o))));
        if (k === "dblclick") return (o = {}) => softly(page, "dblclick", t, async () => { await t.tap(strip(o)); await page.waitForTimeout(70); await t.tap(strip(o)); });
        if (k === "hover") return async () => { tally.hoverDropped++; };
        if (k === "scrollIntoViewIfNeeded") return (o) => softly(page, k, t, async () => { await t.scrollIntoViewIfNeeded(o); await clearOfSheet(t); });
      }
      const v = t[k];
      if (typeof v !== "function") return v;
      return (...a) => {
        const r = softly(page, k, t, () => v.apply(t, a));
        return isLocator(r) ? wrapLocator(page, r, f) : r;
      };
    },
  });
}
const strip = (o) => { const { button, clickCount, delay, ...rest } = o || {}; return rest; };
async function pressLocator(l, f, o) {
  await l.scrollIntoViewIfNeeded(); const bb = await l.boundingBox();
  const x = bb.x + (o.position?.x ?? bb.width / 2), y = bb.y + (o.position?.y ?? bb.height / 2);
  await f.longPress(x, y);
}
// A person scrolls until the thing is above the sheet. Only a bottom sheet moves anything; a side panel has top 0.
const clearOfSheet = (l) => l.evaluate((el) => {
  const sheet = document.querySelector(".de-vpanel"); const top = sheet ? sheet.getBoundingClientRect().top : 0;
  if (top <= 0) return; const r = el.getBoundingClientRect();
  if (r.top < 70 || r.top > top - 80) window.scrollBy({ top: r.top - 70, behavior: "instant" });
}).catch(() => {});

function wrapHandle(page, h, f) {
  return new Proxy(h, {
    get(t, k) {
      if (typeof k !== "string") return t[k];
      if (f && k === "click") return (o = {}) => softly(page, "click", "handle", () => t.tap(strip(o)));
      if (f && k === "hover") return async () => { tally.hoverDropped++; };
      const v = t[k]; return typeof v === "function" ? v.bind(t) : v;
    },
  });
}

function wrapPage(page, cdp) {
  const f = profile.touch ? fingers(page, cdp) : null;
  let at = [0, 0], down = false;
  const mouse = f && {
    move: async (x, y) => { [x, y] = clampPoint(page, x, y); at = [x, y]; if (down) await f.move(x, y); },
    down: async () => { down = true; await f.start(...at); },
    up: async () => { down = false; await f.end(...at); },
    click: async (x, y, o = {}) => { [x, y] = clampPoint(page, x, y); at = [x, y]; if (o.button === "right") return f.longPress(x, y); await f.tap(x, y); },
    dblclick: async (x, y) => { [x, y] = clampPoint(page, x, y); await f.tap(x, y); await page.waitForTimeout(70); await f.tap(x, y); },
    wheel: (a, b) => page.mouse.wheel(a, b),
  };
  return new Proxy(page, {
    get(t, k) {
      if (typeof k !== "string") return t[k];
      if (k === "setDefaultTimeout" && SOFT) return (ms) => t.setDefaultTimeout(Math.min(ms, SOFT_TIMEOUT));
      if (k === "setViewportSize" && profile.lock) return async () => {};
      if (f) {
        if (k === "mouse") return mouse;
        if (k === "click") return (s, o = {}) => softly(page, "click", s, () => (o.button === "right" ? pressLocator(t.locator(s).first(), f, o) : t.tap(s, strip(o))));
        if (k === "dblclick") return (s, o = {}) => softly(page, "dblclick", s, async () => { await t.tap(s, strip(o)); await t.waitForTimeout(70); await t.tap(s, strip(o)); });
        if (k === "hover") return async () => { tally.hoverDropped++; };
      }
      const v = t[k];
      if (typeof v !== "function") return v;
      return (...a) => {
        const r = softly(page, k, a[0], () => v.apply(t, a));
        if (isLocator(r)) return wrapLocator(page, r, f);
        if (r && typeof r.then === "function" && (k === "$" || k === "$$" || k === "waitForSelector")) {
          return r.then((x) => (Array.isArray(x) ? x.map((h) => (isHandle(h) ? wrapHandle(page, h, f) : h)) : isHandle(x) ? wrapHandle(page, x, f) : x));
        }
        return r;
      };
    },
  });
}

async function connect() {
  const browser = await real[profile.browser].launch({ headless: true });
  const ctx = await browser.newContext({ ...profile.context, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  const cdp = profile.touch && profile.browser === "chromium" ? await ctx.newCDPSession(page) : null;
  say(`TRACE profile ${process.env.PROFILE}: ${profile.browser} ${browser.version()}, viewport ${JSON.stringify(page.viewportSize())}, touch ${!!profile.touch}, soft ${SOFT}`);
  const wrapped = wrapPage(page, cdp);
  const sumUp = () => say(`TRACE tally ${JSON.stringify(tally)}`);
  return {
    contexts: () => [{ pages: () => [wrapped] }],
    version: () => browser.version(),
    isConnected: () => browser.isConnected(),
    close: async () => { sumUp(); await browser.close(); },
  };
}

const patched = { ...real, chromium: { ...real.chromium, connectOverCDP: connect, launch: real.chromium.launch.bind(real.chromium) } };
const load = Module._load;
Module._load = function (request, ...rest) {
  if (request === "playwright-core") return patched;
  return load.call(this, request, ...rest);
};
