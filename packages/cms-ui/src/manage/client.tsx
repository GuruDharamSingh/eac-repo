"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { currentTabIndex, normaliseResult, pushToast, type ActionResult, type ManageTab, type StackedToast, type ToastMessage } from "./result";

// ============================================================================
// @elkdonis/cms-ui/manage/client — the console's client half: the tab bar and
// toasts. See ./index.tsx for the page anatomy and the pairing with
// @elkdonis/org-site. The pure helpers (normaliseResult, currentTabIndex,
// types) are exported from the server-safe "@elkdonis/cms-ui/manage"; import
// them from there, also in server code.
// ============================================================================

export type { ManageTab, ToastMessage } from "./result";

/** The console's tab bar. Only the active tab is client state; the gate stays in the app's layout. */
export function ManageTabs({ tabs, label = "Manage" }: { tabs: readonly ManageTab[]; label?: string }) {
  const current = currentTabIndex(tabs, usePathname());
  return (
    <nav className="mg-tabs" aria-label={label}>
      {tabs.map((t, i) => (
        <Link key={t.href} href={t.href} aria-current={i === current ? "page" : undefined}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

// -- toasts -------------------------------------------------------------------
// For the result every /manage action returns. One polite live region
// (successes) and one assertive (failures), so a screen reader hears the
// outcome without the focus moving. A success fades after 5 s and at most
// three show (the oldest goes first); a failure stays until dismissed,
// because it usually asks the person to do something.

/** Push a toast: an action's result as it came back ({ ok, message }, { ok, error }, or null when it threw). */
export type PushToast = (r: ActionResult | null | undefined) => void;

/** Where toasts go instead of the built-in regions (e.g. the app's sonner toaster). */
export type ToastSink = (t: ToastMessage) => void;

const ToastContext = createContext<PushToast | null>(null);
const noop: PushToast = () => {};

/** Push a toast. Outside the provider (e.g. a page outside /manage) it is a no-op. */
export function useToast(): PushToast {
  return useContext(ToastContext) ?? noop;
}

/**
 * Around the console's body. `sink` routes every toast to the app's own
 * toaster instead, and the built-in regions are not drawn. A function cannot
 * be passed from a server component, so a sink needs a small client wrapper
 * in the app (see docs/reference/manage-ui.md):
 *
 *   "use client";
 *   export const ManageToasts = ({ children }) => (
 *     <ToastProvider sink={(t) => (t.ok ? toast.success : toast.error)(t.message)}>{children}</ToastProvider>
 *   );
 */
export function ToastProvider({ children, sink }: { children: ReactNode; sink?: ToastSink }) {
  const [toasts, setToasts] = useState<StackedToast[]>([]);
  const seq = useRef(0);
  const sinkRef = useRef(sink);
  useEffect(() => {
    sinkRef.current = sink;
  }, [sink]);
  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);
  const push = useCallback<PushToast>((r) => {
    const t = normaliseResult(r);
    if (sinkRef.current) return sinkRef.current(t);
    const id = ++seq.current;
    setToasts((all) => pushToast(all, { id, ...t }));
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      {sink ? null : (
        // The regions stay in the page even when empty, so a later toast is announced.
        <div className="mg-toasts">
          <div aria-live="polite" aria-atomic="false">
            {toasts.filter((t) => t.ok).map((t) => (
              <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
            ))}
          </div>
          <div aria-live="assertive" aria-atomic="false">
            {toasts.filter((t) => !t.ok).map((t) => (
              <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
            ))}
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: StackedToast; onDismiss: (id: number) => void }) {
  useEffect(() => {
    if (!toast.ok) return;
    const t = setTimeout(() => onDismiss(toast.id), 5000);
    return () => clearTimeout(t);
  }, [toast, onDismiss]);
  return (
    <div className="mg-toast" data-ok={toast.ok ? "true" : undefined}>
      {/* Not by colour alone: a mark you can see, and a word a screen reader hears. */}
      <span className="mg-toast-mark" aria-hidden="true">
        {toast.ok ? "✓" : "!"}
      </span>
      <span className="mg-toast-text">
        <span className="mg-sr">{toast.ok ? "Done: " : "Problem: "}</span>
        {toast.message}
      </span>
      <button type="button" onClick={() => onDismiss(toast.id)} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}
