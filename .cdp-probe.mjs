/**
 * Minimal CDP driver: open a page, collect console + errors, then report what
 * GrapesJS/Silex actually did. Run inside a container that can reach both the
 * chrome debug port and the silex origin.
 *
 *   node cdp-probe.mjs <chromeDebugHost:port> <pageUrl> [waitMs]
 */
import WebSocket from "/app/node_modules/.pnpm/ws@8.18.3/node_modules/ws/index.js";

const [debugAddr, pageUrl, waitMsRaw] = process.argv.slice(2);
const waitMs = Number(waitMsRaw ?? 30000);

const targets = await (await fetch(`http://${debugAddr}/json/new?about:blank`, { method: "PUT" })).json();
const ws = new WebSocket(targets.webSocketDebuggerUrl);

let id = 0;
const pending = new Map();
const logs = [];
const errors = [];

function send(method, params = {}) {
  return new Promise((resolve) => {
    const msgId = ++id;
    pending.set(msgId, resolve);
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });
}

ws.on("message", (raw) => {
  const msg = JSON.parse(raw.toString());
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg.result);
    pending.delete(msg.id);
    return;
  }
  if (msg.method === "Runtime.consoleAPICalled") {
    const text = (msg.params.args ?? [])
      .map((a) => a.value ?? a.description ?? (a.preview ? JSON.stringify(a.preview.properties?.reduce((o, p) => ((o[p.name] = p.value), o), {})) : a.type))
      .join(" ");
    logs.push(`[${msg.params.type}] ${text}`);
  }
  if (msg.method === "Runtime.exceptionThrown") {
    const d = msg.params.exceptionDetails;
    errors.push(`${d.text} ${d.exception?.description ?? ""}`.slice(0, 400));
  }
  if (msg.method === "Log.entryAdded") {
    const e = msg.params.entry;
    if (e.level === "error") errors.push(`[${e.source}] ${e.text}`.slice(0, 300));
  }
});

await new Promise((r) => ws.on("open", r));
await send("Runtime.enable");
await send("Log.enable");
await send("Page.enable");
await send("Page.navigate", { url: pageUrl });
await new Promise((r) => setTimeout(r, waitMs));

const probe = await send("Runtime.evaluate", {
  expression: `(() => {
    const ed = window.editor || (window.silex && window.silex.getEditor && window.silex.getEditor());
    const out = {
      bodyClass: document.body.className,
      hasSilexGlobal: typeof window.silex,
      hasEditor: !!ed,
      grapesVersion: (window.grapesjs && window.grapesjs.version) || (ed && ed.getModel && 'n/a') || null,
    };
    if (ed && ed.BlockManager) {
      const all = ed.BlockManager.getAll();
      out.blockCount = all.length;
      out.categories = [...new Set(all.map(b => {
        const c = b.get('category');
        return typeof c === 'string' ? c : (c && (c.id || c.get && c.get('id'))) || '(none)';
      }))];
      out.sampleLabels = all.map(b => b.get('label')).slice(0, 12);
    }
    return JSON.stringify(out);
  })()`,
  returnByValue: true,
});

console.log("=== PROBE ===");
console.log(probe?.result?.value ?? JSON.stringify(probe));
console.log("\n=== CONSOLE (eac / silex / grapes / error) ===");
for (const l of logs.filter((l) => /eac|silex|grapes|error|warn|fail/i.test(l)).slice(0, 40)) console.log("  " + l.slice(0, 260));
console.log(`\n(${logs.length} console messages total)`);
console.log("\n=== PAGE ERRORS ===");
for (const e of errors.slice(0, 15)) console.log("  " + e);
if (!errors.length) console.log("  (none)");
ws.close();
process.exit(0);
