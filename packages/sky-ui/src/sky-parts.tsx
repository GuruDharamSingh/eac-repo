"use client";

import { ChevronLeft, ChevronRight, FastForward, LocateFixed, Pause, Rewind, RotateCcw } from "lucide-react";
import { SkyButton } from "./button";
import { cn } from "./utils";
import { PLACES, RATES, STEP_UNITS, type SkyApi } from "./use-sky";

/** Shared control styling: compact, so a whole row fits a phone. */
const selectClass =
  "h-8 shrink-0 rounded-md border border-input bg-card px-1.5 text-xs shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:h-9 sm:px-2.5 sm:text-sm";

/** "12 Sep 14:05 UTC" — the face has no room for the full form. */
function shortMoment(at: Date): string {
  const [, d, mon, , time] = at.toUTCString().split(" ");
  return `${d} ${mon} ${time.slice(0, 5)} UTC`;
}

/**
 * The moment and the place, always on one line — the date shrinks rather than
 * pushing the picker onto a second row.
 *
 * `readOnly` is for a face: everything inside a SurfaceCard is inert to the
 * pointer (a click anywhere opens the surface), so a select there would look
 * interactive without being it.
 */
export function SkyHeader({
  sky,
  className,
  readOnly,
}: {
  sky: SkyApi;
  className?: string;
  readOnly?: boolean;
}) {
  if (readOnly) {
    return (
      <div className={cn("flex items-center justify-center gap-1.5 whitespace-nowrap", className)}>
        <span className="font-display" suppressHydrationWarning>
          {shortMoment(sky.at)}
        </span>
        <span className="text-muted-foreground">· {sky.place.name}</span>
      </div>
    );
  }
  return (
    <div className={cn("flex items-center justify-center gap-2 whitespace-nowrap", className)}>
      <span
        className="min-w-0 truncate font-display text-[13px] sm:text-base"
        title={sky.local ?? undefined}
        suppressHydrationWarning
      >
        {sky.at.toUTCString().replace("GMT", "UTC")}
      </span>
      <label className="flex shrink-0 items-center gap-1 text-muted-foreground">
        <LocateFixed className="size-3.5 sm:size-4" aria-hidden />
        <select
          value={sky.placeValue}
          onChange={(e) => sky.choosePlace(e.target.value)}
          className={selectClass}
          aria-label="Place the houses are cast for"
        >
          {PLACES.map((p) => (
            <option key={p.key} value={p.key}>
              {p.name}
            </option>
          ))}
          <option value="here">{sky.place.key === "here" ? "My location" : "My location…"}</option>
        </select>
      </label>
    </div>
  );
}

/**
 * Every time control on one row — step unit, back, forward, Now, rewind,
 * play — with the speed dial on its own line beneath.
 *
 * `floating` is for the bare surface, where the controls sit on the backdrop
 * with no panel under them: the row gets its own translucent pill so the
 * buttons stay legible over whatever page is showing through.
 */
export function SkyControls({
  sky,
  className,
  floating,
}: {
  sky: SkyApi;
  className?: string;
  floating?: boolean;
}) {
  const unitLabel = STEP_UNITS.find((u) => u.unit === sky.unit)?.label.toLowerCase() ?? sky.unit;
  return (
    <div className={cn("space-y-2", floating && "eac-sky-floatbar", className)}>
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <label htmlFor="step-unit" className="sr-only">
          Step by
        </label>
        <select
          id="step-unit"
          value={sky.unit}
          onChange={(e) => sky.setUnit(e.target.value as SkyApi["unit"])}
          className={selectClass}
        >
          {STEP_UNITS.map((u) => (
            <option key={u.unit} value={u.unit}>
              {u.label}
            </option>
          ))}
        </select>
        <SkyButton variant="outline" className="px-2" onClick={() => sky.step(-1)} title={`Back one ${unitLabel}`}>
          <ChevronLeft className="size-4" />
          <span className="sr-only">Back one {unitLabel}</span>
        </SkyButton>
        <SkyButton variant="outline" className="px-2" onClick={() => sky.step(1)} title={`Forward one ${unitLabel}`}>
          <ChevronRight className="size-4" />
          <span className="sr-only">Forward one {unitLabel}</span>
        </SkyButton>
        <SkyButton
          variant="soft"
          className="px-2.5"
          disabled={sky.isNow && !sky.playing}
          onClick={sky.goNow}
        >
          <RotateCcw className="size-3.5" />
          Now
        </SkyButton>

        <span className="mx-0.5 h-5 w-px shrink-0 bg-border" aria-hidden />

        <SkyButton
          variant={sky.playing === -1 ? "solid" : "outline"}
          className="px-2"
          onClick={() => sky.setPlaying(sky.playing === -1 ? null : -1)}
          aria-pressed={sky.playing === -1}
          title="Rewind"
        >
          {sky.playing === -1 ? <Pause className="size-4" /> : <Rewind className="size-4" />}
          <span className="sr-only">Rewind</span>
        </SkyButton>
        <SkyButton
          variant={sky.playing === 1 ? "solid" : "outline"}
          className="px-2"
          onClick={() => sky.setPlaying(sky.playing === 1 ? null : 1)}
          aria-pressed={sky.playing === 1}
          title="Play"
        >
          {sky.playing === 1 ? <Pause className="size-4" /> : <FastForward className="size-4" />}
          <span className="sr-only">Play</span>
        </SkyButton>
      </div>

      <label htmlFor="speed" className="flex items-center justify-center gap-2 text-xs">
        <span className="uppercase tracking-[0.18em] text-muted-foreground">Speed</span>
        <input
          id="speed"
          type="range"
          min={0}
          max={RATES.length - 1}
          step={1}
          value={sky.rate}
          onChange={(e) => sky.setRate(Number(e.target.value))}
          className="h-2 w-28 cursor-pointer accent-primary sm:w-36"
          aria-valuetext={RATES[sky.rate].label}
        />
        <span className="w-20 text-left tabular-nums sm:w-24">{RATES[sky.rate].label}</span>
      </label>

      {sky.error && <p className="text-center text-sm text-destructive">{sky.error}</p>}
    </div>
  );
}
