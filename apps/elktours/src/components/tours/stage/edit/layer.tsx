"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** A dialog over the page for the edit panels (portaled out of the stage's clipped box). Escape or Close leaves it. */
export function Layer({ title, onClose, wide, children }: { title: string; onClose: () => void; wide?: boolean; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    box.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="tse-layer tse-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={box} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className={`tse-sheet${wide ? " tse-sheet--wide" : ""}`}>
        <header className="tse-sheet__head">
          <h2 className="tse-sheet__title">{title}</h2>
          <button type="button" className="tse-btn" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="tse-sheet__body">{children}</div>
      </div>
    </div>,
    document.body
  );
}
