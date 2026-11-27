"use client";

import * as React from "react";

/** A value remembered in this browser for this viewer. Reads after mount (so the first paint matches the server); never throws. */
export function useStored<T extends string>(key: string, initial: T, allowed?: readonly T[]): [T, (v: T) => void] {
  const [v, setV] = React.useState<T>(initial);
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null && (!allowed || (allowed as readonly string[]).includes(raw))) setV(raw as T);
    } catch { /* private window or blocked storage: keep the default */ }
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = React.useCallback((n: T) => {
    setV(n);
    try { window.localStorage.setItem(key, n); } catch { /* ignore */ }
  }, [key]);
  return [v, set];
}

/**
 * The one framed box used for every region: a border, a rounded corner, a header strip with the title (and anything the
 * region wants on the right), and a body. With `collapsible` the header carries Close / Open, which folds THIS box only;
 * the choice is remembered per viewer under `storeKey`.
 */
export function Frame({ title, level = 3, aside, className = "", bodyClassName = "", collapsible = false, storeKey, children, label }: {
  title: React.ReactNode; level?: 2 | 3; aside?: React.ReactNode; className?: string; bodyClassName?: string;
  collapsible?: boolean; storeKey?: string; children: React.ReactNode; label?: string;
}) {
  const id = React.useId();
  const [state, setState] = useStored<"open" | "closed">(`ws-frame:${storeKey ?? id}`, "open", ["open", "closed"]);
  const open = !collapsible || state === "open";
  const H = level === 2 ? "h2" : "h3";
  return (
    <section className={`ws-frame${open ? "" : " is-collapsed"} ${className}`.trim()} aria-label={label}>
      <header className="ws-frame-head">
        <H className="ws-frame-title">{title}</H>
        {aside ? <div className="ws-frame-aside">{aside}</div> : null}
        {collapsible ? (
          <button type="button" className="ws-frame-toggle" aria-expanded={open} aria-controls={`${id}-body`} onClick={() => setState(open ? "closed" : "open")}>
            {open ? "Close" : "Open"}
          </button>
        ) : null}
      </header>
      {open ? <div id={`${id}-body`} className={`ws-frame-body ${bodyClassName}`.trim()}>{children}</div> : null}
    </section>
  );
}
