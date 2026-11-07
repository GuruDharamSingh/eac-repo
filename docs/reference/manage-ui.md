# Manage UI: `@elkdonis/cms-ui/manage`

The page anatomy of a site's back office (`/manage`), so every console reads
as one thing. Extracted on 2026-11-06 from katie-the-potter's
`components/manage/{ui,toast,manage-nav}.tsx`; katie now imports it.
Source: `packages/cms-ui/src/manage/`. Checks:
`packages/cms-ui/scripts/manage.test.mts` (cms-ui has no test runner; the
header of that file has the command).

Primitives, not a kit. `@elkdonis/org-site`
(`docs/open/ORG_SITE_KIT_BRIEF_2026-11-06.md`, phase 4) plans the shared
`/manage` routes and the kit layout (gate + tabs from its route table); those
routes should draw their pages with these primitives, and an app's own
`/manage` files use the same ones, so kit pages and app pages match.

## Entries

| Entry | Runs | Exports |
|---|---|---|
| `@elkdonis/cms-ui/manage` | server-safe (no hooks) | `PageHeader`, `Toolbar`, `EmptyState`, `Notice`, and the pure helpers `normaliseResult`, `currentTabIndex`, `tabPath`, `pushToast`, `MAX_OK_TOASTS`, types `ActionResult`, `ToastMessage`, `ManageTab` |
| `@elkdonis/cms-ui/manage/client` | `"use client"` | `ManageTabs`, `ToastProvider`, `useToast`, types `PushToast`, `ToastSink` |
| `@elkdonis/cms-ui/manage.css` | plain CSS, `mg-` classes, already inside `@layer components` | import it plainly, before the app's own sheet |

Import the pure helpers from the server-safe entry, in server and client code
alike; the client entry does not re-export them, so server code never pulls a
client reference.

```tsx
// app/manage/layout.tsx: an async SERVER component (it runs the gate)
import { ManageTabs, ToastProvider } from "@elkdonis/cms-ui/manage/client";
import "@elkdonis/cms-ui/manage.css";       // layered: no layer(...) on the import
import "./manage.css";                       // the app's adjustments on mg- classes (unlayered, so they win)

<ManageTabs label="Manage" tabs={[{ href: "/manage", label: "Overview" }, { href: "/manage/orders", label: "Orders" }]} />
<ToastProvider>{children}</ToastProvider>
```

```tsx
// a page
import { EmptyState, Notice, PageHeader, Toolbar } from "@elkdonis/cms-ui/manage";

<PageHeader title="Orders" description="Confirm payments, mark orders shipped." actions={<Link href="/manage/orders/new">New</Link>} />
<Toolbar label="Filter orders">...</Toolbar>
{readOnly ? <Notice>You can look, but only the owner can settle orders.</Notice> : null}
{rows.length ? <OrderList rows={rows} /> : <EmptyState title="No orders yet" body="When someone buys, it appears here." />}
```

```tsx
// a client action button
const toast = useToast();
startTransition(async () => toast(await saveAction(input).catch(() => null)));   // { ok, message }, { ok, error } or null
```

### Routing toasts to the app's own toaster (`sink`)

A function cannot cross from a server component into a client one, and the
manage layout is an async server component, so `sink` is set in a tiny client
wrapper the app owns. elktours (sonner):

```tsx
// apps/elktours/src/components/manage/manage-toasts.tsx
"use client";

import type { ReactNode } from "react";
import { toast } from "sonner";
import { ToastProvider, type ToastSink } from "@elkdonis/cms-ui/manage/client";

const toSonner: ToastSink = (t) => (t.ok ? toast.success(t.message) : toast.error(t.message));

export function ManageToasts({ children }: { children: ReactNode }) {
  return <ToastProvider sink={toSonner}>{children}</ToastProvider>;
}

// app/manage/layout.tsx (server):  <ManageToasts>{children}</ManageToasts>
```

With a sink the built-in regions are not drawn; `useToast()` in any page
below still works, and `{ ok, error }` results reach sonner already
normalised.

## API

- `PageHeader({ title, description?, actions?, level? })`: the title (`<h2>`;
  `level={1}` for an `<h1>` when the page has no other heading), one line of
  purpose, the page's primary action on the right.
- `Toolbar({ label?, children })`: a row of filters and secondary actions,
  `role="group"` with `aria-label` (not an ARIA toolbar: that promises
  arrow-key navigation). If the content is already a labelled `<nav>`, leave
  `label` out so the name is not announced twice.
- `EmptyState({ title, body?, action? })`: dashed box for "nothing yet".
- `Notice({ tone?: "info" | "warn", children })`: a standing note
  (`role="status"`). Feedback from an action is a toast, never a notice or an
  alert dialog.
- `ManageTabs({ tabs: { href, label, exact? }[], label? })`: `usePathname`,
  one tab gets `aria-current="page"`. Hrefs and the pathname are compared as
  paths (no query, hash or trailing slash), so `/manage/orders?status=paid`
  matches on `/manage/orders`. Of the tabs whose path equals the pathname or
  is a parent of it, the longest wins: with `/manage/tours` and
  `/manage/tours/new`, `/manage/tours/12` marks "Tours". The index tab (the
  shortest path, `/manage`) matches only exactly; `exact` overrides either
  way. Only the active tab is client state; the gate stays in the layout (and
  in every page and action). The pure matcher is `currentTabIndex(tabs, pathname)`.
- `ToastProvider({ children, sink? })` and `useToast()`: push an action's
  result as it came back. Two live regions (polite for successes, assertive
  for failures) stay in the page even when empty, so the outcome is heard
  without moving focus. A success fades after 5 s and at most three show (the
  oldest goes first); a failure stays until dismissed and is never evicted.
  Each toast carries a visible mark (✓ or !) and a spoken "Done:" / "Problem:",
  so the two are not told apart by colour alone. The empty regions do not take
  clicks. Outside a provider `useToast()` is a no-op. `sink`: see above.
- `normaliseResult(r)` -> `{ ok, message }`: takes `{ ok, message?, error? }`,
  `null` or `undefined`. Only `ok === true` is a success; a missing result is a
  failure. A failure prefers `error`, a success `message`; the first non-blank
  of the two wins (numbers and `Error`s are read as text), else a plain
  sentence ("Done." / "That didn't work. Please try again."). This is what
  lets elktours' `{ ok, error }` actions and katie's `{ ok, message }` share
  one toast, and why a call site needs no `r ?? {...}` fallback.

## CSS

`mg-pagehead`, `mg-pagehead-title`, `mg-pagehead-desc`, `mg-actions`,
`mg-toolbar`, `mg-empty`, `mg-empty-title`, `mg-empty-body`, `mg-notice`
(`[data-tone="warn"]`), `mg-tabs`, `mg-toasts`, `mg-toast` (`[data-ok]`),
`mg-toast-mark`, `mg-toast-text`, `mg-sr`. All inside `@layer components`, so
a Tailwind utility passed through `className` and any unlayered app rule win
(css-ui rule: shared sheets sit under the utilities). Built on the shadcn HSL
triplets (`--foreground`, `--background`, `--muted-foreground`, `--border`,
`--input`, `--primary`, `--accent`, `--secondary`, `--destructive`, `--ring`,
`--radius`), each with a neutral fallback. Focus rings on tabs and the dismiss
button; the toast entrance stops under `prefers-reduced-motion`; tabs become
one scrolling line under 760px and take their corners from `--radius`.

The console's own frame (width, header, body gaps, the space above the tabs,
cards, lists) stays the app's. An app adjusts type and colour with its own
rules on the `mg-` classes; katie: `.mg-tabs { margin-top: 1.25rem }`,
Fraunces italic for `.mg-empty-title`, weight 400 on titles, its terracotta
for links in notices and descriptions
(`apps/katie-the-potter/src/app/manage/manage.css`).

## Users

- katie-the-potter: every `/manage` page, `components/manage/*` (toasts).
- Not migrated: elktours (sonner; would use the `sink` wrapper above), the
  other apps' copied `/manage` pages (org-site phase 4).
