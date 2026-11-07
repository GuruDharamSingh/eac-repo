import type { ReactNode } from "react";

// ============================================================================
// @elkdonis/cms-ui/manage — the page anatomy of a site's back office
// (/manage), extracted from katie-the-potter (2026-11-06). Server-safe: no
// hooks here; the client half is "@elkdonis/cms-ui/manage/client".
//
//   import "@elkdonis/cms-ui/manage.css";
//   import { PageHeader, Toolbar, EmptyState, Notice } from "@elkdonis/cms-ui/manage";
//   import { ManageTabs, ToastProvider, useToast } from "@elkdonis/cms-ui/manage/client";
//
//   <ManageTabs tabs label="Manage" />           the console's tab bar (layout)
//   <ToastProvider> ... </ToastProvider>         around the page body (layout)
//   <PageHeader title description actions />     every page: title, one line
//                                                of purpose, its primary action
//   <Toolbar label> filters / secondary actions </Toolbar>
//   content: the app's own cards and lists
//   <EmptyState title body action />             when there is nothing yet
//   <Notice tone>                                a standing note (not feedback)
//
// Feedback from an action is a toast (useToast), never an alert dialog.
// Primitives only, not a kit: @elkdonis/org-site's shared /manage routes
// (docs/open/ORG_SITE_KIT_BRIEF_2026-11-06.md, phase 4) are meant to draw
// their pages and kit layout with these, and an app's own /manage pages use
// the same ones, so both read as one console. Plain CSS, `mg-` classes, on
// the shadcn HSL triplets (--border, --foreground, --muted-foreground,
// --primary, --radius...). Guide: docs/reference/manage-ui.md.
// ============================================================================

// Pure helpers: import them from HERE (this entry), in server and client code
// alike. The client entry does not re-export them.
export {
  normaliseResult,
  currentTabIndex,
  tabPath,
  pushToast,
  MAX_OK_TOASTS,
  type ActionResult,
  type ToastMessage,
  type ManageTab,
  type StackedToast,
} from "./result";

/** A page's title row. `level` 2 (default) under the console's own h1; 1 when the page has no other heading. */
export function PageHeader({ title, description, actions, level = 2 }: { title: string; description?: ReactNode; actions?: ReactNode; level?: 1 | 2 }) {
  const Title = level === 1 ? "h1" : "h2";
  return (
    <header className="mg-pagehead">
      <div>
        <Title className="mg-pagehead-title">{title}</Title>
        {description ? <p className="mg-pagehead-desc">{description}</p> : null}
      </div>
      {actions ? <div className="mg-actions">{actions}</div> : null}
    </header>
  );
}

/**
 * A row of filters and secondary actions: a labelled group (not an ARIA
 * toolbar, which would promise arrow-key navigation). If the content is
 * already a labelled landmark (a <nav aria-label>), leave `label` out so it is
 * not announced twice.
 */
export function Toolbar({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div className="mg-toolbar" role="group" aria-label={label}>
      {children}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <section className="mg-empty">
      <p className="mg-empty-title">{title}</p>
      {body ? <p className="mg-empty-body">{body}</p> : null}
      {action ? <div className="mg-actions">{action}</div> : null}
    </section>
  );
}

export type NoticeTone = "info" | "warn";

/** A standing note on a page ("You can look, but..."). Announced politely when it appears. */
export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: NoticeTone }) {
  return (
    <p className="mg-notice" data-tone={tone} role="status">
      {children}
    </p>
  );
}
