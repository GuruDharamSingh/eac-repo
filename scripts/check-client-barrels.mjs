#!/usr/bin/env node
/**
 * Guards against a failure this repo has already hit once.
 *
 * A package barrel (src/index.ts) is all-or-nothing: when anything imports
 * from it, the bundler follows every export in it. So if a package containing
 * client components ("use client") also exposes, through its barrel, anything
 * that reaches @elkdonis/db or @elkdonis/services, then every client consumer
 * of that package pulls a Postgres driver into the browser bundle and fails
 * to build.
 *
 * What made it expensive the first time was not the fix — it was the
 * diagnosis. The build error named a component and a file that had not been
 * touched, in a different app from the one that changed, and only some pages
 * broke. This script turns that into one line, at the moment it is introduced.
 *
 * The fix is always the same: give the server-only module its own subpath
 * export instead of a line in the index, e.g.
 *   "exports": { ".": "./src/index.ts", "./theme": "./src/ThemeStyle.tsx" }
 *
 * Run: node scripts/check-client-barrels.mjs
 */

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const PACKAGES = join(ROOT, "packages");
const APPS = join(ROOT, "apps");
const SERVER_ONLY = ["@elkdonis/db", "@elkdonis/services"];

/** Every file under a directory, recursively. */
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(full)) out.push(full);
  }
  return out;
}

/** Resolve a relative import to an actual file on disk. */
function resolveLocal(fromFile, spec) {
  const base = resolve(dirname(fromFile), spec);
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function importsOf(file) {
  const src = readFileSync(file, "utf8");
  return [...src.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
}

/**
 * Everything the barrel drags in, following relative imports within the
 * package. Returns the first server-only import found, with the chain that
 * reached it — the chain is the part that makes this diagnosable.
 */
function findServerReach(entry) {
  const seen = new Set();
  const stack = [{ file: entry, chain: [entry] }];

  while (stack.length) {
    const { file, chain } = stack.pop();
    if (seen.has(file)) continue;
    seen.add(file);

    for (const spec of importsOf(file)) {
      if (SERVER_ONLY.includes(spec)) return { spec, chain: [...chain] };
      if (!spec.startsWith(".")) continue;
      const next = resolveLocal(file, spec);
      if (next) stack.push({ file: next, chain: [...chain, next] });
    }
  }
  return null;
}

const isClientFile = (f) =>
  /^\s*["']use client["']/m.test(readFileSync(f, "utf8"));

/** Client files anywhere in the repo that import a package's BARREL (not a
 *  subpath). A type-only import is erased at build time and creates no runtime
 *  edge, so it is not a break. */
function clientImportersOfBarrel(pkg) {
  const hits = [];
  for (const app of readdirSync(APPS)) {
    const src = join(APPS, app, "src");
    if (!existsSync(src)) continue;
    for (const f of walk(src)) {
      if (!isClientFile(f)) continue;
      const text = readFileSync(f, "utf8");
      const re = new RegExp(
        `import\\s+(?!type\\b)[^;]*?from\\s+["']@elkdonis/${pkg}["']`
      );
      if (re.test(text)) hits.push(f.replace(ROOT + "/", ""));
    }
  }
  return hits;
}

const problems = [];

for (const pkg of readdirSync(PACKAGES)) {
  const src = join(PACKAGES, pkg, "src");
  const barrel = join(src, "index.ts");
  if (!existsSync(barrel)) continue;

  const reach = findServerReach(barrel);
  if (!reach) continue;

  const files = walk(src);
  const ownClient = files.filter(isClientFile);
  const breaking = clientImportersOfBarrel(pkg);

  // A package with no client code anywhere near it may expose what it likes.
  if (ownClient.length === 0 && breaking.length === 0) continue;

  problems.push({ pkg, ...reach, ownClient: ownClient.length, breaking });
}

const breaking = problems.filter((p) => p.breaking.length > 0);
const latent = problems.filter((p) => p.breaking.length === 0);

if (problems.length === 0) {
  console.log("✓ no barrel exposes server-only code to client consumers");
  process.exit(0);
}

for (const p of breaking) {
  console.error(`\n✗ BREAKING — @elkdonis/${p.pkg} barrel reaches ${p.spec}`);
  for (const [i, f] of p.chain.entries()) {
    console.error(`    ${"  ".repeat(i)}${i === 0 ? "" : "→ "}${f.replace(ROOT + "/", "")}`);
  }
  console.error("  imported by these client components:");
  for (const f of p.breaking) console.error(`    ${f}`);
  console.error(`  fix: subpath export in packages/${p.pkg}/package.json`);
}

for (const p of latent) {
  console.log(`\n· at risk — @elkdonis/${p.pkg} barrel reaches ${p.spec}`);
  console.log(`  ${p.ownClient} client component(s) in this package; no client importer of the barrel yet.`);
  console.log("  not breaking today — becomes a build failure the moment one appears.");
}

// Latent risk is worth printing, not worth failing a build over.
process.exit(breaking.length > 0 ? 1 : 0);
