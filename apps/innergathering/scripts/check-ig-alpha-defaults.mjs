// Asserts every --ig-a-* default in site-style-ig-alpha.ts equals the :root value in globals.css, exactly.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const css = readFileSync(join(root, "app/globals.css"), "utf8");
const ts = readFileSync(join(root, "lib/site-style-ig-alpha.ts"), "utf8");
const inRoot = new Map([...css.matchAll(/^\s*(--ig-a-[0-9a-f]{6}-\d+):\s*(rgba\([^)]*\));/gm)].map((m) => [m[1], m[2]]));
const schema = new Map([...ts.matchAll(/name: "(--ig-a-[^"]+)".*?default: "([^"]+)"/g)].map((m) => [m[1], m[2]]));
let bad = 0;
for (const [n, v] of inRoot) if (schema.get(n) !== v) { bad++; console.log("MISMATCH", n, JSON.stringify(v), JSON.stringify(schema.get(n))); }
for (const n of schema.keys()) if (!inRoot.has(n)) { bad++; console.log("NOT IN :root", n); }
console.log(`:root ${inRoot.size}, schema ${schema.size}, mismatches ${bad}`);
process.exit(bad ? 1 : 0);
