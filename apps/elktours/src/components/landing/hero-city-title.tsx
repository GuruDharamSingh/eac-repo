"use client";

import { useEffect, useId, useRef, useState } from "react";
import "./hero-city-title.css";

/**
 * Desktop landing heading: "See [Paris v] with Local Artists." (2026-11-20 as one centred line with a pill; 2026-11-21
 * left-aligned in the hero's text column, the city as plain bold text with a brass underline and a chevron). Toronto and L.A. are listed as "coming 2027" and cannot be chosen; Paris is the only live city, so
 * choosing it just closes the menu.
 *
 * The menu is made of spans (role listbox/option) because it sits inside the h1, which allows phrasing content only.
 */
const CITIES: Array<{ name: string; soon: boolean }> = [
  { name: "Paris", soon: false },
  { name: "Toronto", soon: true },
  { name: "L.A.", soon: true },
];

export function HeroCityTitle({ before = "See", after = "with Local Artists." }: { before?: string; after?: string }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLSpanElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    list.current?.focus();
    const away = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  };

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); close(true); }
    else if (e.key === "Tab") setOpen(false);
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(CITIES.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(CITIES.length - 1); }
    else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!CITIES[active]?.soon) close(true);
    }
  };

  return (
    <span className="hct">
      {before}{" "}
      <span className="hct-wrap" ref={root}>
        <button
          ref={button}
          type="button"
          className="hct-btn"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => { setActive(0); setOpen((v) => !v); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && !open) { e.preventDefault(); setActive(0); setOpen(true); }
          }}
        >
          <span>Paris</span>
          <svg className="hct-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="M5 9l7 7 7-7" /></svg>
          <span className="hct-sr">, choose a city</span>
        </button>
        {open && (
          <span
            ref={list}
            id={id}
            role="listbox"
            tabIndex={-1}
            aria-label="City"
            aria-activedescendant={`${id}-${active}`}
            className="hct-menu"
            onKeyDown={onListKey}
          >
            {CITIES.map((c, i) => (
              <span
                key={c.name}
                id={`${id}-${i}`}
                role="option"
                aria-selected={!c.soon}
                aria-disabled={c.soon || undefined}
                data-active={i === active || undefined}
                className="hct-opt"
                onMouseEnter={() => setActive(i)}
                onClick={() => { if (!c.soon) close(true); }}
              >
                <span className="hct-name">{c.name}</span>
                {c.soon ? <span className="hct-soon">coming 2027</span> : <span className="hct-tick" aria-hidden="true">✓</span>}
              </span>
            ))}
          </span>
        )}
      </span>{" "}
      {after}
    </span>
  );
}
