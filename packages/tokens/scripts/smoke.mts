/**
 * Runtime checks for the DTCG importer.
 *
 * The fixture is deliberately a BAD file as well as a good one: it contains an
 * alias chain, a dangling alias, an alias cycle, a deprecated token, a colour
 * space we do not recognise, a font stack that cannot be stored, and a token
 * with no type anywhere. An importer is only useful if it survives all of that
 * and can say what happened, so each of those is asserted rather than hoped for.
 *
 *   pnpm --filter @elkdonis/tokens test
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { importDtcg, linkHooks, STORABLE_NAME, STORABLE_VALUE, varNameFor } from "../src/index.js";
import type { DtcgFile } from "../src/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const file = JSON.parse(
  readFileSync(join(here, "../fixtures/sample.tokens.json"), "utf8")
) as DtcgFile;

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

const r = importDtcg(file, { prefix: "eac" });
console.log(
  `\n${r.counts.tokens} tokens → ${r.counts.vars} variables, ${r.counts.dropped} dropped, ${r.issues.length} issues\n`
);

const issueFor = (path: string) => r.issues.filter((i) => i.path === path);
const v = (name: string) => r.vars[name];

// ── Naming ──────────────────────────────────────────────────────────────────
check("path becomes a kebab name", varNameFor(["color", "brand", "saffron"], "eac") === "--eac-color-brand-saffron", varNameFor(["color", "brand", "saffron"], "eac"));
check("camelCase segments split", varNameFor(["colorBrand", "onPrimary"]) === "--color-brand-on-primary", varNameFor(["colorBrand", "onPrimary"]));

// ── Colour spaces ───────────────────────────────────────────────────────────
check("hsl", v("--eac-color-brand-saffron") === "hsl(45 79% 52%)", v("--eac-color-brand-saffron"));
// DTCG stores sRGB 0–1; CSS rgb() wants 0–255. Getting this wrong yields a
// black swatch, which is the kind of bug that looks like a data problem.
check("srgb scales 0-1 to 0-255 and rounds", v("--eac-color-brand-oxide") === "rgb(152 63 47)", v("--eac-color-brand-oxide"));
check("alpha becomes a slash", v("--eac-color-brand-veil") === "rgb(0 0 0 / 0.25)", v("--eac-color-brand-veil"));
check("display-p3 uses color()", v("--eac-color-brand-wide") === "color(display-p3 0.9 0.7 0.1)", v("--eac-color-brand-wide"));
// An unknown space is exactly what the hex fallback is for.
check("unknown space falls back to hex", v("--eac-color-brand-future") === "#445566", v("--eac-color-brand-future"));

// ── Aliases ─────────────────────────────────────────────────────────────────
check("alias resolves to the target value", v("--eac-color-semantic-accent") === "hsl(45 79% 52%)", v("--eac-color-semantic-accent"));
check("alias chain resolves", v("--eac-color-semantic-accent-again") === "hsl(45 79% 52%)", v("--eac-color-semantic-accent-again"));
check("an alias inherits its target's type", v("--eac-color-semantic-accent") !== undefined);
check("dangling alias is dropped", v("--eac-color-semantic-missing") === undefined);
check("...and says so", issueFor("color.semantic.missing")[0]?.kind === "unresolved-alias", JSON.stringify(issueFor("color.semantic.missing")[0]));

// A cycle must be reported, not recursed into.
check("alias cycle is dropped", v("--eac-color-loop-a") === undefined && v("--eac-color-loop-b") === undefined);
check("...and is named a cycle", r.issues.some((i) => i.kind === "alias-cycle"), r.issues.filter(i => i.kind === "alias-cycle").map(i => i.message).join(" | "));

// ── Deprecation ─────────────────────────────────────────────────────────────
check("deprecated tokens are left out", v("--eac-color-semantic-retired") === undefined);
check("...with the reason from the file", !!issueFor("color.semantic.retired")[0]?.message.includes("Use accent instead"), JSON.stringify(issueFor("color.semantic.retired")[0]));
const withDeprecated = importDtcg(file, { prefix: "eac", includeDeprecated: true });
check("...unless asked for", withDeprecated.vars["--eac-color-semantic-retired"] !== undefined);

// ── Dimensions, type, motion ────────────────────────────────────────────────
check("px dimension", v("--eac-space-tight") === "4px", v("--eac-space-tight"));
check("rem dimension", v("--eac-radius-control") === "0.625rem", v("--eac-radius-control"));
check("plain font stack is kept unquoted", v("--eac-font-body") === "Georgia, serif", v("--eac-font-body"));
check("transition is duration, timing, delay in CSS order", v("--eac-motion-quick") === "120ms cubic-bezier(0.4, 0, 0.2, 1) 0ms", v("--eac-motion-quick"));
check("shadow", v("--eac-elevation-card") === "0px 2px 8px 0px rgb(0 0 0 / 0.15)", v("--eac-elevation-card"));
check("gradient positions become percentages", !!v("--eac-chrome-band")?.includes("0%") && !!v("--eac-chrome-band")?.includes("100%"), v("--eac-chrome-band"));

// A composite expands into several properties rather than one shorthand, so
// a heading's size can be overridden without restating its family.
check("typography expands", v("--eac-font-heading-font-size") === "1.5rem", v("--eac-font-heading-font-size"));
check("...into every part present", ["font-family", "font-size", "font-weight", "line-height"].every((p) => v(`--eac-font-heading-${p}`) !== undefined));
check("...and not into a single value", v("--eac-font-heading") === undefined);

// ── The storage boundary ────────────────────────────────────────────────────
// A quoted family is valid CSS and unstorable here. Silence would be the bug.
check("unstorable font stack is dropped", v("--eac-font-display") === undefined);
const displayIssue = issueFor("font.display")[0];
check("...reported as unstorable", displayIssue?.kind === "unstorable", JSON.stringify(displayIssue));
check("...explaining it is the quote mark", !!displayIssue?.message.includes("quote"), displayIssue?.message);

check("untyped token is dropped", v("--eac-untyped-mystery") === undefined);
check("...as unknown-type", issueFor("untyped.mystery")[0]?.kind === "unknown-type");

// Everything that survived must actually be storable, or the whole exercise is
// theatre: the caller is entitled to pass `vars` straight to saveSiteTheme.
const bad = Object.entries(r.vars).filter(([n, val]) => !STORABLE_NAME.test(n) || !STORABLE_VALUE.test(val));
check("every emitted var is storable as-is", bad.length === 0, JSON.stringify(bad.slice(0, 3)));

// ── Hook linking ────────────────────────────────────────────────────────────
const linked = linkHooks(r, {
  "--eac-control-accent": "color.semantic.accent",
  "--eac-control-radius": "radius.control",
  "--eac-control-accent-on": "color.brand.nope",
});
check("a hook points at the imported var", linked.vars["--eac-control-accent"] === "var(--eac-color-semantic-accent)", linked.vars["--eac-control-accent"]);
check("...by reference, not by copied value", !Object.values(linked.vars).some((x) => x.startsWith("hsl(")));
check("a hook onto a dropped token is reported", linked.issues.length === 1 && linked.vars["--eac-control-accent-on"] === undefined, JSON.stringify(linked.issues));

// ── Drift guard ─────────────────────────────────────────────────────────────
// This package cannot import @elkdonis/services (it must stay database-free),
// so the storage rules are duplicated. Duplication without a guard is drift, and
// drift here means we promise something is storable and it silently is not.
const svc = readFileSync(join(here, "../../services/src/themes.ts"), "utf8");
const svcName = /const NAME_RE = (\/.*\/[a-z]*);/.exec(svc)?.[1];
const svcValue = /const VALUE_RE = (\/.*\/[a-z]*);/.exec(svc)?.[1];
check("found the service's rules", !!svcName && !!svcValue);
check("name rule still matches the service", svcName === String(STORABLE_NAME), `${svcName} vs ${String(STORABLE_NAME)}`);
check("value rule still matches the service", svcValue === String(STORABLE_VALUE), `${svcValue} vs ${String(STORABLE_VALUE)}`);

// ── Malformed input ─────────────────────────────────────────────────────────
for (const [label, input] of [["null", null], ["an array", []], ["a string", "nope"]] as const) {
  const out = importDtcg(input as never);
  check(`${label} is refused without throwing`, out.counts.vars === 0 && out.issues.length === 1);
}

console.log(failures === 0 ? "\nall checks passed\n" : `\n${failures} FAILED\n`);
process.exit(failures === 0 ? 0 : 1);
