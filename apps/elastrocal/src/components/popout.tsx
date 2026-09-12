"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A button that opens a panel over the page, anchored to itself.
 *
 * Why not the shared surface: a surface is registered once by the provider and
 * builds its own content, which suits a subject that can be fetched by id. The
 * houses and aspects tables read the *live* chart the page is holding — it
 * changes on every step and every frame of playback — so the panel has to be
 * rendered by the component that owns that state. This is the small local
 * version of the same gesture: click to expand, Escape or a click outside to
 * dismiss.
 */
export function Popout({
  label,
  count,
  children,
  className,
}: {
  label: string;
  count?: number;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  return (
    <div ref={wrap} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={id}
        className={cn(
          "flex h-9 items-center gap-1.5 rounded-md border border-input bg-card px-3 text-sm shadow-xs transition-colors",
          "hover:border-ring/60 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
          open && "border-ring bg-accent",
        )}
      >
        {label}
        {count !== undefined && <span className="text-xs tabular-nums text-muted-foreground">{count}</span>}
        <span aria-hidden className={cn("text-[10px] text-muted-foreground transition-transform", open && "rotate-180")}>
          ▾
        </span>
      </button>

      {open && (
        <div
          id={id}
          // Rises from the button, which sits low on the page — so the panel
          // opens upward and is capped to the viewport rather than pushing
          // the page taller.
          className="absolute bottom-full left-0 z-40 mb-2 max-h-[70vh] w-[min(30rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-lg"
        >
          {children}
        </div>
      )}
    </div>
  );
}
