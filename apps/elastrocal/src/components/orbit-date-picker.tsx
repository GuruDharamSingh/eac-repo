"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { OrbitDial, parseISO, toISO } from "./orbit-dial";
import "./orbit-date-picker.css";

/**
 * A date field with the orbit dial behind it.
 *
 * The field stays typeable, in ISO order — a dial is a lovely way to browse
 * and a terrible way to enter a date you already know — and the button opens
 * the dial in a popover, where changes are a draft until confirmed. The dial
 * itself is <OrbitDial>, which the home page mounts open beside a live chart.
 */
export function OrbitDatePicker({
  id,
  value,
  onChange,
  required,
  minYear,
  maxYear,
}: {
  id: string;
  /** ISO "YYYY-MM-DD", or "" while empty. */
  value: string;
  onChange: (next: string) => void;
  required?: boolean;
  minYear?: number;
  maxYear?: number;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value);
  const wrap = useRef<HTMLDivElement>(null);
  const labelId = useId();

  // Falls back to today, so an empty field opens onto something rather than a
  // blank ring.
  const selected = useMemo(() => parseISO(value) ?? parseISO(toISO(new Date())) ?? new Date(), [value]);
  const [draft, setDraft] = useState<Date>(selected);

  useEffect(() => setText(value), [value]);
  useEffect(() => {
    if (open) setDraft(selected);
  }, [open, selected]);

  const close = (apply: boolean) => {
    if (apply) {
      onChange(toISO(draft));
      setText(toISO(draft));
    }
    setOpen(false);
  };

  // Dismiss on outside click and Escape, like every other menu on the site.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="odp" ref={wrap}>
      <div className="odp-field">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="bday"
          placeholder="YYYY-MM-DD"
          required={required}
          value={text}
          aria-describedby={`${labelId}-hint`}
          onChange={(e) => {
            setText(e.target.value);
            const parsed = parseISO(e.target.value);
            if (parsed) onChange(toISO(parsed));
          }}
          onBlur={() => {
            // A half-typed date reverts rather than silently staying wrong.
            if (!parseISO(text)) setText(value);
          }}
          className={cn(
            "h-9 w-full rounded-md border border-input bg-card px-3 pr-10 text-sm shadow-xs outline-none",
            "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
            text && !parseISO(text) && "border-destructive",
          )}
        />
        <button
          type="button"
          className="odp-open"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={open ? "Close the orbit picker" : "Pick the date on the orbit"}
          onClick={() => setOpen((v) => !v)}
        >
          <svg viewBox="0 0 20 20" aria-hidden>
            <circle cx="10" cy="10" r="3.1" />
            <ellipse cx="10" cy="10" rx="8.6" ry="4.2" transform="rotate(-22 10 10)" />
            <circle cx="17.1" cy="7" r="1.4" className="odp-open-dot" />
          </svg>
        </button>
      </div>
      <p id={`${labelId}-hint`} className="sr-only">
        Type the date as four-digit year, month, day. Or open the orbit picker and drag the Earth around the
        Sun — dragging further from the centre gives finer control, and there are buttons for stepping a
        single day.
      </p>

      {open && (
        <div className="odp-pop" role="dialog" aria-label="Pick a date">
          <OrbitDial value={draft} onChange={setDraft} minYear={minYear} maxYear={maxYear} />
          <div className="odp-actions">
            <button type="button" className="odp-btn odp-btn-quiet" onClick={() => close(false)}>
              Cancel
            </button>
            <button type="button" className="odp-btn odp-btn-primary" onClick={() => close(true)}>
              Use this date
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
