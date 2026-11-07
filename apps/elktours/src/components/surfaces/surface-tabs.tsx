"use client";

import * as React from "react";

/**
 * A pill tab strip for elktours' own popups (tour, experience, place).
 *
 * cms-ui's ThreadSurface has no tabs and is not edited in this pass, so this
 * mirrors the hand-built strip in cms-ui ProfileSurface: the same pills, the
 * same arrow-key behaviour, the surface's own colour variables.
 */
export function SurfaceTabs<T extends string>({
  id,
  label,
  tabs,
  current,
  onSelect,
}: {
  /** Prefix for element ids; unique per popup kind. */
  id: string;
  label: string;
  tabs: Array<{ key: T; label: string }>;
  current: T;
  onSelect: (key: T) => void;
}) {
  if (tabs.length < 2) return null;
  const keys = tabs.map((t) => t.key);
  return (
    <div
      role="tablist"
      aria-label={label}
      className="sticky top-0 z-10 -mx-1 -mt-1 flex gap-2 overflow-x-auto bg-[color:var(--sf-bg)] px-0.5 pb-2 pt-1 [scrollbar-width:none]"
    >
      {tabs.map((t) => {
        const on = t.key === current;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`${id}-tab-${t.key}`}
            aria-selected={on}
            aria-controls={`${id}-panel`}
            tabIndex={on ? 0 : -1}
            onClick={() => onSelect(t.key)}
            onKeyDown={(e) => {
              if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
              e.preventDefault();
              const i = keys.indexOf(t.key) + (e.key === "ArrowRight" ? 1 : -1);
              const next = keys[(i + keys.length) % keys.length];
              onSelect(next);
              document.getElementById(`${id}-tab-${next}`)?.focus();
            }}
            className={
              "shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[0.85rem] font-medium transition-colors " +
              (on
                ? "border-[color:var(--sf-fg)] bg-[color:var(--sf-fg)] text-[color:var(--sf-bg)]"
                : "border-[color:var(--sf-line)] text-[color:var(--sf-muted)] hover:border-[color:var(--sf-fg)] hover:text-[color:var(--sf-fg)]")
            }
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/** The panel a SurfaceTabs strip controls. */
export function SurfaceTabPanel({
  id,
  current,
  children,
}: {
  id: string;
  current: string;
  children: React.ReactNode;
}) {
  return (
    <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${current}`} className="grid gap-4">
      {children}
    </div>
  );
}

/** Fetch JSON for a popup; `null` while loading, `{ error }` on failure. */
export function usePopupData<T>(url: string | null): { data: T | null; error: string | null } {
  const [state, setState] = React.useState<{ data: T | null; error: string | null }>({ data: null, error: null });
  React.useEffect(() => {
    if (!url) return;
    let live = true;
    setState({ data: null, error: null });
    fetch(url, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(res.status === 404 ? "Not found." : "Could not load this.");
        return (await res.json()) as T;
      })
      .then((data) => live && setState({ data, error: null }))
      .catch((err: unknown) => live && setState({ data: null, error: err instanceof Error ? err.message : "Could not load this." }));
    return () => {
      live = false;
    };
  }, [url]);
  return state;
}
