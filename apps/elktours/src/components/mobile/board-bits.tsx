"use client";

import type { ReactNode } from "react";
import "@/blocks/mobile/flow.css";
import "@/blocks/mobile/people.css";
import "./board-forms.css";
import { BackButton } from "./back-button";
import { formatDeparture, formatWallDate, wallClock } from "@/lib/tour-format";

// Small shared pieces of the phone board forms (G7b). Styles: board-forms.css.

export function FormTop({ href, kicker, title }: { href: string; kicker: string; title: string }) {
  return (
    <div className="m-flow-top">
      <BackButton href={href} />
      <div className="m-flow-top-text">
        <span className="m-kicker">{kicker}</span>
        <span className="m-flow-top-title">{title}</span>
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="bf-field">
      <span className="bf-label">{label}</span>
      {children}
    </div>
  );
}

export function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} className="bf-sw" onClick={() => onChange(!on)} />;
}

export function Stepper({ value, label, onMinus, onPlus }: { value: string; label: string; onMinus: () => void; onPlus: () => void }) {
  return (
    <div className="bf-stepper">
      <button type="button" aria-label={`Less ${label}`} onClick={onMinus}>−</button>
      <output aria-label={label}>{value}</output>
      <button type="button" aria-label={`More ${label}`} onClick={onPlus}>+</button>
    </div>
  );
}

// From numeric parts (lib/tour-format.ts): Intl's weekday patterns differ between Node and the browser (React #418).
export const whenLabel = (iso: string) => formatDeparture(iso);
export const dayLabel = (iso: string) => formatWallDate(wallClock(iso));
export const clockLabel = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
