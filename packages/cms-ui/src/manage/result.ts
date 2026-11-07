// Pure helpers shared by both entries (no React, no Next): what a /manage
// action returns, which tab is current, and how the toast stack is kept.
// Public from the server-safe entry "@elkdonis/cms-ui/manage" only; the client
// entry uses them internally.

/** What a /manage server action returns, in either shape the apps use: katie's { ok, message } or elktours' { ok, error }. */
export interface ActionResult {
  ok: boolean;
  message?: unknown;
  error?: unknown;
}

export interface ToastMessage {
  ok: boolean;
  message: string;
}

const FALLBACK_OK = "Done.";
const FALLBACK_FAIL = "That didn't work. Please try again.";

function text(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v instanceof Error) return v.message.trim();
  return "";
}

/**
 * One toast from an action's result. A failure prefers `error`, a success
 * `message`; the first non-blank of the two wins, else a plain sentence.
 * A missing result (null / undefined, e.g. a thrown action caught as null)
 * is a failure. Only `ok === true` is a success.
 */
export function normaliseResult(r: ActionResult | null | undefined): ToastMessage {
  const ok = r?.ok === true;
  const order = ok ? [r?.message, r?.error] : [r?.error, r?.message];
  const message = order.map(text).find((s) => s.length > 0);
  return { ok, message: message ?? (ok ? FALLBACK_OK : FALLBACK_FAIL) };
}

// -- tabs -----------------------------------------------------------------

export interface ManageTab {
  href: string;
  label: string;
  /** Current only on this exact path. Default: true for the index tab (the shortest path, e.g. /manage). */
  exact?: boolean;
}

/** The path part of an href or pathname: no query, no hash, no trailing slash ("/" stays "/"). */
export function tabPath(href: string): string {
  const p = href.split(/[?#]/, 1)[0] || "/";
  return p.length > 1 ? p.replace(/\/+$/, "") || "/" : p;
}

/**
 * The tab to mark current for a pathname: of the tabs whose path equals it,
 * or (unless exact) is a parent of it, the longest. So with tabs /manage,
 * /manage/tours and /manage/tours/new, /manage/tours/12 marks "Tours". A tab
 * with a query (/manage/orders?status=paid) matches on its path.
 */
export function currentTabIndex(tabs: readonly ManageTab[], pathname: string | null | undefined): number {
  const here = tabPath(pathname ?? "");
  const paths = tabs.map((t) => tabPath(t.href));
  const base = paths.reduce<string | null>((a, p) => (a === null || p.length < a.length ? p : a), null);
  let best = -1;
  tabs.forEach((t, i) => {
    const p = paths[i]!;
    const exact = t.exact ?? (p === base && paths.some((o, j) => j !== i && o !== p));
    const hit = here === p || (!exact && here.startsWith(p === "/" ? "/" : `${p}/`));
    if (hit && (best < 0 || p.length > paths[best]!.length)) best = i;
  });
  return best;
}

// -- the toast stack --------------------------------------------------------

export interface StackedToast extends ToastMessage {
  id: number;
}

/** Successes on screen at once; the oldest goes first. Failures stay until dismissed. */
export const MAX_OK_TOASTS = 3;

/** The stack after a push: every failure kept, successes capped (oldest evicted first). */
export function pushToast(stack: readonly StackedToast[], t: StackedToast, maxOk = MAX_OK_TOASTS): StackedToast[] {
  const next = [...stack, t];
  let oks = next.filter((x) => x.ok).length;
  return next.filter((x) => {
    if (!x.ok || oks <= maxOk) return true;
    oks--;
    return false;
  });
}
