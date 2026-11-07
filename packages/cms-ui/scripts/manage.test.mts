/**
 * Runtime checks for the manage kit (@elkdonis/cms-ui/manage and ./manage/client).
 * cms-ui has no test runner (no tsx dependency of its own), so this is a
 * tracked script run with the workspace's tsx, from packages/cms-ui:
 *
 *   node /app/node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/cli.mjs scripts/manage.test.mts
 *   (in a one-off container:  docker compose run --rm --no-deps -w /app/packages/cms-ui admin node ... )
 *
 * Covers: normaliseResult, tab matching, the toast stack, and the markup of
 * the server-safe components and the toast regions.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import {
  normaliseResult,
  currentTabIndex,
  tabPath,
  pushToast,
  MAX_OK_TOASTS,
  PageHeader,
  Toolbar,
  EmptyState,
  Notice,
  type StackedToast,
} from "../src/manage/index.js";
import { ToastProvider, ManageTabs } from "../src/manage/client.js";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// ── normaliseResult ─────────────────────────────────────────────────────────
console.log("\nnormaliseResult");
check("{ok,message}", same(normaliseResult({ ok: true, message: "Saved." }), { ok: true, message: "Saved." }));
check("{ok:false,error} (elktours)", same(normaliseResult({ ok: false, error: "No access." }), { ok: false, message: "No access." }));
check("failure prefers error", normaliseResult({ ok: false, message: "m", error: "e" }).message === "e");
check("success prefers message", normaliseResult({ ok: true, message: "m", error: "e" }).message === "m");
check("blank error falls through to message", normaliseResult({ ok: false, error: "  ", message: "Try again later." }).message === "Try again later.");
check("null is a failure with a sentence", same(normaliseResult(null), { ok: false, message: "That didn't work. Please try again." }));
check("undefined is a failure", normaliseResult(undefined).ok === false);
check("success with nothing says Done.", same(normaliseResult({ ok: true }), { ok: true, message: "Done." }));
check("non-string message coerced", normaliseResult({ ok: true, message: 3 }).message === "3");
check("Error object coerced", normaliseResult({ ok: false, error: new Error("Boom") }).message === "Boom");
check("object message ignored", normaliseResult({ ok: false, error: { x: 1 } }).message === "That didn't work. Please try again.");
check("only ok === true is success", normaliseResult({ ok: "yes" as unknown as boolean, message: "x" }).ok === false);
check("trims", normaliseResult({ ok: true, message: "  Saved.  " }).message === "Saved.");

// ── tabs ────────────────────────────────────────────────────────────────────
console.log("\ntabs");
check("tabPath strips query, hash, trailing slash", tabPath("/manage/orders/?status=paid#x") === "/manage/orders" && tabPath("/") === "/" && tabPath("") === "/");
const tabs = [
  { href: "/manage", label: "Overview" },
  { href: "/manage/tours", label: "Tours" },
  { href: "/manage/tours/new", label: "New tour" },
  { href: "/manage/orders?status=paid", label: "To ship" },
];
const cur = (p: string | null, t = tabs) => (currentTabIndex(t, p) >= 0 ? t[currentTabIndex(t, p)]!.label : "none");
check("index tab on its own path", cur("/manage") === "Overview");
check("index tab with trailing slash", cur("/manage/") === "Overview");
check("index tab is auto-exact", cur("/manage/people") === "none");
check("child path marks its section", cur("/manage/tours/12") === "Tours");
check("the longer tab wins on its own path", cur("/manage/tours/new") === "New tour");
check("section on its own path", cur("/manage/tours") === "Tours");
check("a tab with a query matches on its path", cur("/manage/orders") === "To ship");
check("no match", cur("/elsewhere") === "none" && cur(null) === "none");
check("exact: true is honoured", cur("/manage/tours/12", [{ href: "/manage", label: "O" }, { href: "/manage/tours", label: "Tours", exact: true }]) === "none");
check("exact: false on the index", cur("/manage/people", [{ href: "/manage", label: "O", exact: false }, { href: "/manage/x", label: "X" }]) === "O");
check("a single tab is not auto-exact", cur("/manage/a", [{ href: "/manage", label: "Only" }]) === "Only");

// ── the toast stack ─────────────────────────────────────────────────────────
console.log("\ntoast stack");
let stack: StackedToast[] = [];
let id = 0;
const add = (ok: boolean) => (stack = pushToast(stack, { id: ++id, ok, message: String(id) }));
add(false); add(true); add(true); add(true); add(true); add(false); add(true);
check(`successes capped at ${MAX_OK_TOASTS}`, stack.filter((t) => t.ok).length === MAX_OK_TOASTS);
check("every failure kept", stack.filter((t) => !t.ok).map((t) => t.id).join() === "1,6");
check("oldest successes evicted first", stack.filter((t) => t.ok).map((t) => t.id).join() === "4,5,7", stack.map((t) => t.id).join());
check("order preserved", stack.map((t) => t.id).join() === "1,4,5,6,7");
for (let i = 0; i < 10; i++) add(false);
check("failures never evicted", stack.filter((t) => !t.ok).length === 12);

// ── markup ──────────────────────────────────────────────────────────────────
console.log("\nmarkup");
const ph = renderToStaticMarkup(createElement(PageHeader, { title: "Orders", description: "One line.", actions: createElement("a", { href: "/x" }, "New") }));
check("PageHeader h2 by default", ph.startsWith('<header class="mg-pagehead"><div><h2 class="mg-pagehead-title">Orders</h2><p class="mg-pagehead-desc">One line.</p></div><div class="mg-actions">'), ph);
check("PageHeader level 1", renderToStaticMarkup(createElement(PageHeader, { title: "T", level: 1 })).includes('<h1 class="mg-pagehead-title">T</h1>'));
check("PageHeader without description/actions", renderToStaticMarkup(createElement(PageHeader, { title: "T" })) === '<header class="mg-pagehead"><div><h2 class="mg-pagehead-title">T</h2></div></header>');
const tb = renderToStaticMarkup(createElement(Toolbar, { label: "Filters" }, "x"));
check("Toolbar is a labelled group", tb === '<div class="mg-toolbar" role="group" aria-label="Filters">x</div>', tb);
check("Toolbar without label", !renderToStaticMarkup(createElement(Toolbar, null, "x")).includes("aria-label"));
check("EmptyState", renderToStaticMarkup(createElement(EmptyState, { title: "Nothing yet", body: "b" })) === '<section class="mg-empty"><p class="mg-empty-title">Nothing yet</p><p class="mg-empty-body">b</p></section>');
check("Notice tone + status", renderToStaticMarkup(createElement(Notice, { tone: "warn" }, "n")) === '<p class="mg-notice" data-tone="warn" role="status">n</p>');
check("Notice default tone info", renderToStaticMarkup(createElement(Notice, null, "n")).includes('data-tone="info"'));
const tp = renderToStaticMarkup(createElement(ToastProvider, null, "body"));
check("toast regions drawn while empty (polite + assertive)", tp === 'body<div class="mg-toasts"><div aria-live="polite" aria-atomic="false"></div><div aria-live="assertive" aria-atomic="false"></div></div>', tp);
check("sink: no built-in regions", renderToStaticMarkup(createElement(ToastProvider, { sink: () => {} }, "body")) === "body");
try {
  const nav = renderToStaticMarkup(createElement(ManageTabs, { tabs: tabs.slice(0, 2), label: "Manage" }));
  check("ManageTabs outside a router: no current tab, labelled nav", nav.startsWith('<nav class="mg-tabs" aria-label="Manage">') && !nav.includes("aria-current"), nav);
} catch (e) {
  check("ManageTabs renders outside Next", false, String(e));
}

console.log(failures ? `\n${failures} failed` : "\nall manage checks passed");
process.exit(failures ? 1 : 0);
