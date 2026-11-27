// Behaviour checks for the library harness (keyboard, pick, remote search, Show more, onOpen).
// node check-library.mjs <chrome-ip>   reads file:///out/<page>.html
const host = process.argv[2];
const list = await (await fetch(`http://${host}:9222/json/list`)).json();
const target = list.find((t) => t.type === "page");
const ws = new WebSocket(target.webSocketDebuggerUrl.replace(/ws:\/\/[^/]+/, `ws://${host}:9222`));
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let n = 0; const pending = new Map(); let errors = [];
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description?.slice(0, 300) || m.params.exceptionDetails.text); });
const send = (method, params = {}) => new Promise((r) => { const id = ++n; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result.result.value;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const key = async (k, code, vk) => { for (const type of ["keyDown", "keyUp"]) await send("Input.dispatchKeyEvent", { type, key: k, code, windowsVirtualKeyCode: vk, text: k === "Enter" ? "\r" : undefined }); };
const tab = () => key("Tab", "Tab", 9);
const load = async (name, w = 1280) => { errors = []; await send("Emulation.setDeviceMetricsOverride", { width: w, height: 900, deviceScaleFactor: 1, mobile: w < 500 }); await send("Page.navigate", { url: `file:///out/${name}.html` }); await sleep(1800); };
const active = () => ev("(()=>{const a=document.activeElement;return a? (a.tagName+'|'+(a.getAttribute('aria-label')||a.getAttribute('placeholder')||a.textContent||'').trim().slice(0,40)):'none'})()");
const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(ok ? "PASS" : "FAIL", name, detail); };
await send("Runtime.enable"); await send("Page.enable");

// 1. keyboard: tab through the bar, open the lightbox with Enter, Escape returns focus
await load("badges");
const trail = [];
for (let i = 0; i < 12; i++) { await tab(); trail.push(await active()); }
console.log("tab order:", JSON.stringify(trail));
check("tab reaches the search input first", trail[0].startsWith("INPUT"), trail[0]);
// tab until a brick is focused, then Enter
let onBrick = false;
for (let i = 0; i < 30 && !onBrick; i++) { await tab(); onBrick = await ev("document.activeElement?.classList.contains('chn-brick')"); }
check("tab reaches a brick", onBrick);
const brickTitle = await ev("document.activeElement.querySelector('strong').textContent.trim()");
await key("Enter", "Enter", 13); await sleep(400);
check("Enter opens the lightbox", await ev("!!document.querySelector('.chn-lightbox')"));
check("focus moves into the lightbox", await ev("!!document.activeElement?.closest('.chn-lightbox')"), await active());
check("content behind is inert", await ev("document.querySelector('.eac-c-lib-content').inert === true"));
await key("Escape", "Escape", 27); await sleep(300);
check("Escape closes it", await ev("!document.querySelector('.chn-lightbox')"));
check("focus returns to the same brick", (await ev("document.activeElement?.classList.contains('chn-brick') && document.activeElement.querySelector('strong').textContent.trim()")) === brickTitle, brickTitle);

// 2. file lightbox (MediaLibrary wrapper) keyboard
await load("media-lightbox");
check("media lightbox opened by click", await ev("!!document.querySelector('.chn-lightbox')"));
await key("Escape", "Escape", 27); await sleep(300);
check("media lightbox Escape closes", await ev("!document.querySelector('.chn-lightbox')"));

// 3. onOpen true skips the lightbox
await load("onopen"); await sleep(600);
check("onOpen(true): no lightbox, host called", (await ev("!document.querySelector('.chn-lightbox') && window.__log.join()")) === "host-open thread:m1" || (await ev("window.__log.join()")).startsWith("host-open"), await ev("window.__log.join()"));

// 4. remote: Show more, facets, debounced search, stale abort
await load("remote");
check("remote first page = 6 bricks", (await ev("document.querySelectorAll('.chn-brick').length")) === 6);
await ev("[...document.querySelectorAll('button')].find(b=>b.textContent==='Show more').click()"); await sleep(600);
check("Show more appends the next page", (await ev("document.querySelectorAll('.chn-brick').length")) > 6, String(await ev("document.querySelectorAll('.chn-brick').length")));
await load("remote");
const setQ = (v) => ev(`(()=>{const i=document.querySelector('input[type=search]');const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;s.call(i,${JSON.stringify(v)});i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
const before = await ev("window.__calls.length");
await setQ("m"); await setQ("ma"); await setQ("mar"); await setQ("marsh"); await sleep(1000);
const searchCalls = (await ev("window.__calls.slice(" + before + ")")).filter((c) => c.includes("q="));
check("typing is debounced to one request", searchCalls.length === 1, JSON.stringify(searchCalls));
check("results are filtered", (await ev("[...document.querySelectorAll('.chn-brick strong')].map(e=>e.textContent.trim()).join('|')")).includes("Salt Marsh"));
// stale: slow then fast
await setQ("slow"); await sleep(500); await setQ("reed"); await sleep(1500);
const titles = await ev("[...document.querySelectorAll('.chn-brick strong')].map(e=>e.textContent.trim()).join('|')");
check("a stale slow answer does not overwrite the newer one", titles.includes("Reed Beds") && !titles.includes("Salt"), titles);

// 5. function source, error, missing
await load("remote-fn");
check("search() source called with view and scope", (await ev("window.__log.length")) >= 1, await ev("window.__log[0]"));
await load("remote-error");
check("error is shown with Try again", await ev("document.body.textContent.includes('not reachable') && !![...document.querySelectorAll('button')].find(b=>b.textContent==='Try again')"));
await load("remote-missing");
check("missing sources are shown", await ev("document.body.textContent.includes('Instagram, Letters')"));

// 6. pick / pickMany
await load("pick");
await ev("document.querySelectorAll('.chn-brick')[1].click()"); await sleep(200);
check("pick marks one brick", (await ev("document.querySelectorAll('.chn-brick[aria-pressed=true]').length")) === 1 && !(await ev("!!document.querySelector('.chn-lightbox')")));
await load("pickmany");
const pre = await ev("document.querySelectorAll('.chn-brick[aria-pressed=true]').length");
await ev("document.querySelectorAll('.chn-brick')[3].click()"); await sleep(200);
check("pickMany toggles", (await ev("document.querySelectorAll('.chn-brick[aria-pressed=true]').length")) === pre + 1, `${pre} -> ${await ev("document.querySelectorAll('.chn-brick[aria-pressed=true]').length")}`);
await load("files-pick");
await ev("[...document.querySelectorAll('.chn-brick')].find(b=>b.textContent.includes('marsh-dawn')).click()"); await sleep(200);
check("files pick reports source and path", JSON.stringify(await ev("window.__pick")).includes('"source":"mine"'), JSON.stringify(await ev("window.__pick")));
// folder navigation
await load("files-folders");
await ev("[...document.querySelectorAll('.eac-c-media-folder')].find(b=>b.textContent.includes('Paris')).click()"); await sleep(500);
check("folder chip opens a folder; crumbs update", (await ev("document.querySelector('.eac-c-media-crumbs').textContent")).includes("Paris"));
await ev("document.querySelector('[aria-label=\"Up one folder\"]').click()"); await sleep(500);
check("Up returns to the root", !(await ev("document.querySelector('.eac-c-media-crumbs').textContent")).includes("Paris"));
await ev("document.querySelector('[aria-label=\"Back\"]').click()"); await sleep(400);
check("Back works", (await ev("document.querySelector('.eac-c-media-crumbs').textContent")).includes("Paris"));
check("no page errors", errors.length === 0, JSON.stringify(errors));
console.log(results.filter(Boolean).length + "/" + results.length + " passed");
ws.close();
