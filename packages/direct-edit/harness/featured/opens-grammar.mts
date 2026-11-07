// parseOpens (apps/elktours/src/lib/opens.ts): accepted and refused references (2026-11-06).
import { parseOpens } from "../../../../apps/elktours/src/lib/opens.ts";
const U = "4eebc495-1db6-4b1e-a5b3-399326c78fe6";
const good = ["page:/walking-notes", "page:/tours/heritage#book", "popup:tour:elkNapol001tour000003", `popup:reviews:place:${U}`, "popup:reviews:tour:abc>page:/tours/abc", `popup:person:${U}>page:/about/dana`];
const bad = ["page://evil.example", "page:https://x", "page:/a b", "page:/../x", "popup:tour:abc>page:/x", "popup:reviews:place:abc", "popup:person:x", "popup:reviews:tour:a>page:/x>page:/y", "javascript:alert(1)", "popup:reviews:tour:a>https://x", 'page:/x"onmouseover=1'];
let f = 0;
for (const g of good) { const ok = parseOpens(g) !== null; if (!ok) f++; console.log(ok ? "pass" : "  FAIL", "accepts", g); }
for (const b of bad) { const ok = parseOpens(b) === null; if (!ok) f++; console.log(ok ? "pass" : "  FAIL", "refuses", b); }
console.log(f ? `${f} failed` : "all passed");
