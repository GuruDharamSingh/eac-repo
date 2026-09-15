"use client";

import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

/** The units the chart can be stepped by. */
export const STEP_UNITS = [
  { unit: "hour", label: "Hour" },
  { unit: "day", label: "Day" },
  { unit: "week", label: "Week" },
  { unit: "month", label: "Month" },
  { unit: "year", label: "Year" },
] as const;

export type StepUnit = (typeof STEP_UNITS)[number]["unit"];

const selectClass =
  "h-9 shrink-0 rounded-md border border-input bg-card px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

const btn =
  "flex h-9 items-center gap-1.5 rounded-md border border-input bg-card px-2.5 text-sm shadow-xs transition-colors hover:border-ring/60 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50";

/**
 * The buttons that move the moment: what to step by, which way, back to now,
 * and run it. The dial underneath scrubs the date; these are for the small
 * deliberate moves the dial is bad at — an hour, one day, exactly a year.
 */
export function MomentControls({
  unit,
  setUnit,
  onStep,
  onNow,
  playing,
  setPlaying,
  isNow,
  className,
}: {
  unit: StepUnit;
  setUnit: (u: StepUnit) => void;
  onStep: (amount: number) => void;
  onNow: () => void;
  playing: boolean;
  setPlaying: (v: boolean) => void;
  isNow: boolean;
  className?: string;
}) {
  const label = STEP_UNITS.find((u) => u.unit === unit)?.label.toLowerCase() ?? unit;
  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-1.5", className)}>
      <label htmlFor="step-unit" className="sr-only">
        Step by
      </label>
      <select
        id="step-unit"
        className={selectClass}
        value={unit}
        onChange={(e) => setUnit(e.target.value as StepUnit)}
      >
        {STEP_UNITS.map((u) => (
          <option key={u.unit} value={u.unit}>
            {u.label}
          </option>
        ))}
      </select>

      <button type="button" className={btn} onClick={() => onStep(-1)} title={`Back one ${label}`}>
        <ChevronLeft className="size-4" />
        <span className="sr-only">Back one {label}</span>
      </button>
      <button type="button" className={btn} onClick={() => onStep(1)} title={`Forward one ${label}`}>
        <ChevronRight className="size-4" />
        <span className="sr-only">Forward one {label}</span>
      </button>

      <button type="button" className={btn} onClick={onNow} disabled={isNow && !playing}>
        <RotateCcw className="size-3.5" />
        Now
      </button>

      <span className="mx-0.5 h-5 w-px shrink-0 bg-border" aria-hidden />

      <button
        type="button"
        className={cn(btn, playing && "border-ring bg-accent")}
        onClick={() => setPlaying(!playing)}
        aria-pressed={playing}
        title={playing ? "Pause" : `Run forward by the ${label}`}
      >
        {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        <span className="sr-only">{playing ? "Pause" : "Play"}</span>
      </button>
    </div>
  );
}
