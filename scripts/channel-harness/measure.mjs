// node measure.mjs <ip> <page> <selector>: elements wider than their scroll container
const [host, name, sel] = process.argv.slice(2);
const list = await (await fetch(`http://${host}:9222/json/list`)).json();
const ws = new WebSocket(list.find((t) => t.type === "page").webSocketDebuggerUrl.replace(/ws:\/\/[^/]+/, `ws://${host}:9222`));
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let n = 0; const p = new Map();
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && p.has(m.id)) { p.get(m.id)(m); p.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const id = ++n; p.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: `file:///out/${name}.html` });
await new Promise((r) => setTimeout(r, 2500));
const v = (await send("Runtime.evaluate", { returnByValue: true, expression: `(()=>{const c=document.querySelector(${JSON.stringify(sel)});const lim=c.clientWidth;const out=[];c.querySelectorAll('*').forEach(e=>{const r=e.getBoundingClientRect();const cr=c.getBoundingClientRect();if(r.right-cr.left>lim-0&&r.width>0)out.push(e.tagName+'.'+String(e.className).slice(0,50)+' right='+Math.round(r.right-cr.left))});return JSON.stringify({client:c.clientWidth,scroll:c.scrollWidth,out:out.slice(0,12)})})()` })).result.result.value;
console.log(v);
ws.close();
