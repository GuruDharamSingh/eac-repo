"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button, Input, Label } from "@elkdonis/primitives";
import { saveTourBookingDefaults } from "@/lib/slot-actions";
import { setTourTypeAction } from "@/lib/tour-type-actions";
import { TOUR_TYPES, TOUR_TYPE_LABELS, type TourType } from "@/lib/tour-type";

interface Defaults { minToRun: number | null; closeBeforeMinutes: number; waitlistCap: number | null }

/**
 * "Tour type" and "Booking rules" for the tour form (G3b). Each group saves on its own button (the form's own
 * Save does not carry them): the type through setTourTypeAction, the rules through saveTourBookingDefaults.
 * Kept out of the form's submit: its inputs have no names and Enter does nothing.
 */
export function TourBookingRules({ tourId, type, defaults }: { tourId: string; type: TourType | null; defaults: Defaults | null }) {
  const [t, setT] = useState<string>(type ?? "");
  const [min, setMin] = useState(defaults?.minToRun != null ? String(defaults.minToRun) : "");
  const [hours, setHours] = useState(defaults ? String(Math.round(defaults.closeBeforeMinutes / 60)) : "0");
  const [pending, start] = useTransition();
  const noEnter = (e: React.KeyboardEvent) => { if (e.key === "Enter") e.preventDefault(); };

  return (
    <div className="space-y-6 border-t border-border pt-4">
      <div>
        <Label htmlFor="tourType">Tour type</Label>
        <div className="mt-1 flex gap-2">
          <select id="tourType" value={t} onChange={(e) => setT(e.target.value)} className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-sm">
            <option value="">Not set</option>
            {TOUR_TYPES.map((k) => <option key={k} value={k}>{TOUR_TYPE_LABELS[k]}</option>)}
          </select>
          <Button type="button" variant="outline" disabled={pending} onClick={() => start(async () => {
            const r = await setTourTypeAction(tourId, (t || null) as TourType | null);
            r.ok ? toast.success("Type saved") : toast.error(r.error);
          })}>Save</Button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Used by the filters on the phone Tours page.</p>
      </div>

      <div>
        <p className="text-sm font-medium">Booking rules</p>
        <div className="mt-2 grid gap-3">
          <div>
            <Label htmlFor="minToRun">Minimum to run</Label>
            <Input id="minToRun" type="number" min={1} max={500} value={min} onChange={(e) => setMin(e.target.value)} onKeyDown={noEnter} placeholder="No minimum" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="closeHours">Booking closes (hours before the start)</Label>
            <Input id="closeHours" type="number" min={0} max={720} value={hours} onChange={(e) => setHours(e.target.value)} onKeyDown={noEnter} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="waitlistCap">Waitlist places</Label>
            <Input id="waitlistCap" value={defaults?.waitlistCap != null ? String(defaults.waitlistCap) : ""} disabled placeholder="After launch" className="mt-1" />
            <p className="mt-1 text-xs text-muted-foreground">The waitlist opens after launch; until then a full date shows as Full.</p>
          </div>
          <div>
            <Button type="button" variant="outline" disabled={pending} onClick={() => start(async () => {
              const r = await saveTourBookingDefaults(tourId, { minToRun: min.trim() ? Number(min) : null, closeBeforeMinutes: Math.max(0, Math.round(Number(hours) || 0)) * 60 });
              r.ok ? toast.success("Booking rules saved") : toast.error(r.error);
            })}>Save booking rules</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
